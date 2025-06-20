import { ToolExecutor } from "@/utils/agents/tools/ToolExecutor";
import { removeToolCalls } from "@/utils/agents/tools/ToolParser";
import type { ToolRegistry } from "@/utils/agents/tools/ToolRegistry";
import { type NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import type NDK from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";

const agentLogger = logger.forModule("agent");
import { SystemPromptComposer } from "../../prompts";
import type {
  AgentConfig,
  AgentResponse,
  ConversationSignal,
  ConversationStore,
  EventContext,
  LLMConfig,
  LLMProvider,
  Message,
  NostrPublisher,
} from "../core/types";

export class Agent {
  protected signer: NDKPrivateKeySigner;
  protected pubkey: string;
  private isActiveSpeaker = false;
  protected teamSize = 1; // Default to single agent

  constructor(
    protected config: AgentConfig,
    protected llm: LLMProvider,
    protected store: ConversationStore,
    protected publisher: NostrPublisher,
    protected ndk: NDK,
    protected toolRegistry?: ToolRegistry
  ) {
    this.signer = new NDKPrivateKeySigner(config.nsec);
    this.pubkey = this.signer.pubkey;
  }

  setTeamSize(size: number): void {
    this.teamSize = size;
  }

  async initialize(): Promise<void> {
    // Get actual pubkey from signer
    const user = await this.signer.user();
    this.pubkey = user.pubkey;
  }

  getName(): string {
    return this.config.name;
  }

  getRole(): string {
    return this.config.role;
  }

  getInstructions(): string {
    return this.config.instructions;
  }

  setActiveSpeaker(active: boolean): void {
    this.isActiveSpeaker = active;
  }

  isActive(): boolean {
    return this.isActiveSpeaker;
  }

  getPublicKey(): string {
    return this.pubkey;
  }

  getLLMConfig(): LLMConfig | undefined {
    return this.config.llmConfig;
  }

  getSigner(): NDKPrivateKeySigner {
    return this.signer;
  }

  async handleEvent(event: NDKEvent, context: EventContext): Promise<void> {
    if (!this.isActiveSpeaker) {
      agentLogger.debug(`Agent ${this.config.name} ignoring event - not active speaker`, "verbose");
      return;
    }

    // CRITICAL: Never respond to our own events
    if (event.pubkey === this.pubkey) {
      agentLogger.warning(
        `Agent ${this.config.name} attempted to respond to its own event - ignoring`
      );
      return;
    }

    const response = await this.generateResponse(event, context);

    // Check if response contains tool calls that need execution
    if (response.toolCalls || response.hasNativeToolCalls) {
      // Publish the initial response immediately (without tool results)
      const initialResponse = {
        content: removeToolCalls(response.content),
        signal: response.signal,
        metadata: response.metadata,
      };
      await this.publisher.publishResponse(initialResponse, context, this.signer, this.config.name);

      // Execute tools and publish results as a follow-up
      await this.executeToolsAndPublishResults(response, context);
    } else {
      // No tools, publish normally
      await this.publisher.publishResponse(response, context, this.signer, this.config.name);
    }
  }

  async generateResponse(event: NDKEvent, context: EventContext): Promise<AgentResponse> {
    // Build conversation history
    const messages = await this.buildConversationContext(event, context);

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(context);

    // Add system prompt with signal instructions
    messages.unshift({
      role: "system",
      content: systemPrompt,
    });
    
    // Extract user prompt from the event
    const userPrompt = event.content;

    // Publish typing start indicator
    try {
      await this.publisher.publishTypingIndicator(
        this.config.name,
        true,
        context,
        this.signer,
        {
          systemPrompt,
          userPrompt,
        }
      );
    } catch (error) {
      // Don't fail the LLM call if typing indicator fails
      agentLogger.debug(`Failed to publish typing start indicator: ${error}`, "verbose");
    }

    try {
      // Generate response
      const completion = await this.llm.complete({
        messages,
        context: {
          agentName: this.config.name,
          rootEventId: context.rootEventId,
          eventId: event.id,
          originalEvent: context.originalEvent,
          projectId: context.projectId,
          projectEvent: context.projectEvent,
          ndk: this.ndk,
          agent: this,
          immediateResponse: true, // Tell ToolEnabledProvider to return immediately
          typingIndicator: async (content: string) => {
            await this.publisher.publishTypingIndicator(
              this.config.name,
              true,
              context,
              this.signer,
              { message: content }
            );
          },
        },
      });

      // Parse response and extract signal
      const { content, signal } = this.parseResponse(completion.content);

      // Save to conversation history
      await this.store.appendMessage(context.rootEventId, {
        id: `${Date.now()}-${this.config.name}`,
        agentName: this.config.name,
        content,
        timestamp: Date.now(),
        signal,
      });

      // Build metadata from completion
      const metadata: import("../core/types").LLMMetadata = {
        model: completion.model,
        provider: this.config.llmConfig?.provider,
        systemPrompt,
        userPrompt: event.content,
        rawResponse: completion.content,
        usage: completion.usage
          ? {
              promptTokens: completion.usage.promptTokens,
              completionTokens: completion.usage.completionTokens,
              totalTokens: completion.usage.totalTokens,
              cacheCreationTokens: completion.usage.cacheCreationTokens,
              cacheReadTokens: completion.usage.cacheReadTokens,
              cost: completion.usage.cost,
            }
          : undefined,
      };

      // Return response with tool-related properties if they exist
      return {
        content,
        signal,
        metadata,
        // Preserve tool-related properties from completion
        ...(completion.toolCalls && { toolCalls: completion.toolCalls }),
        ...(completion.hasNativeToolCalls && {
          hasNativeToolCalls: completion.hasNativeToolCalls,
        }),
      };
    } finally {
      // Always publish typing stop indicator
      try {
        await this.publisher.publishTypingIndicator(
          this.config.name,
          false,
          context,
          this.signer
        );
      } catch (error) {
        // Don't fail if typing stop fails
        agentLogger.debug(`Failed to publish typing stop indicator: ${error}`, "verbose");
      }
    }
  }

  public getSystemPrompt(): string {
    return this.buildSystemPrompt();
  }

  protected buildSystemPrompt(context?: import("../core/types").EventContext): string {
    return SystemPromptComposer.composeAgentPrompt({
      name: this.config.name,
      role: this.config.role,
      instructions: this.config.instructions,
      teamSize: this.teamSize,
      toolDescriptions: this.toolRegistry?.generateSystemPrompt(),
      availableSpecs: context?.availableSpecs,
      availableAgents: context?.availableAgents,
    });
  }

  protected async buildConversationContext(
    event: NDKEvent,
    context: EventContext
  ): Promise<Message[]> {
    const messages: Message[] = [];

    // Get conversation history
    const history = await this.store.getMessages(context.rootEventId);

    // Build messages from history
    for (const msg of history) {
      messages.push({
        role: "assistant",
        content: `[${msg.agentName}]: ${msg.content}`,
      });
    }

    // Add the current user message
    messages.push({
      role: "user",
      content: event.content,
    });

    return messages;
  }

  protected parseResponse(content: string): { content: string; signal?: ConversationSignal } {
    // Look for signal JSON in the response
    const signalMatch = content.match(/<!-- SIGNAL: ({.*?}) -->/);
    if (signalMatch && signalMatch[1]) {
      try {
        const signal = JSON.parse(signalMatch[1]) as ConversationSignal;
        // Remove signal from content
        const cleanContent = content.replace(signalMatch[0], "").trim();
        return { content: cleanContent, signal };
      } catch (error) {
        agentLogger.warning("Failed to parse signal JSON", "normal", error);
      }
    }

    return { content };
  }

  private async executeToolsAndPublishResults(
    response: AgentResponse,
    context: EventContext
  ): Promise<void> {
    if (!response.toolCalls || !this.toolRegistry) {
      return;
    }

    const executor = new ToolExecutor(this.toolRegistry);

    // Create tool context with all necessary information
    const toolContext = {
      agentName: this.config.name,
      rootEventId: context.rootEventId,
      eventId: context.eventId,
      originalEvent: context.originalEvent,
      projectId: context.projectId,
      projectEvent: context.projectEvent,
      ndk: this.ndk,
      agent: this,
      publisher: this.publisher,
    };

    const toolResponses = await executor.executeTools(response.toolCalls, toolContext);

    // Build tool results content
    let toolResultsContent = "### Tool Results\n\n";
    for (const toolResponse of toolResponses) {
      const toolCall = response.toolCalls.find((tc) => tc.id === toolResponse.tool_call_id);
      if (toolCall) {
        toolResultsContent += `**${toolCall.name}**:\n${toolResponse.output}\n\n`;
      }
    }

    // Publish tool results as a follow-up message
    const toolResultResponse: AgentResponse = {
      content: toolResultsContent.trim(),
      metadata: {
        isToolResult: true,
      },
    };

    await this.publisher.publishResponse(
      toolResultResponse,
      context,
      this.signer,
      this.config.name
    );
  }
}
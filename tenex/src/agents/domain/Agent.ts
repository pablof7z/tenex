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
import { enhanceWithTypingIndicators } from "../infrastructure/LLMProviderAdapter";

export class Agent {
  protected signer: NDKPrivateKeySigner;
  protected pubkey: string;
  private isActiveSpeaker = false;
  protected teamSize = 1; // Default to single agent
  private typingAwareLLM: LLMProvider;

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

    // Enhance LLM provider with typing indicators
    this.typingAwareLLM = enhanceWithTypingIndicators(llm, publisher, config.name, this.signer);
  }

  setTeamSize(size: number): void {
    this.teamSize = size;
  }

  async initialize(): Promise<void> {
    // Get actual pubkey from signer
    const user = await this.signer.user();
    this.pubkey = user.pubkey;
    agentLogger.info(`Initialized agent ${this.config.name} with pubkey ${this.pubkey}`);
  }

  getName(): string {
    return this.config.name;
  }

  getSigner(): NDKPrivateKeySigner {
    return this.signer;
  }

  getPubkey(): string {
    return this.pubkey;
  }

  getConfig(): AgentConfig {
    return this.config;
  }

  setActiveSpeaker(active: boolean): void {
    this.isActiveSpeaker = active;
    agentLogger.debug(`Agent ${this.config.name} active speaker: ${active}`, "verbose");
  }

  async handleEvent(event: NDKEvent, context: EventContext): Promise<void> {
    // Only respond if we're an active speaker
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
    // Generate response (typing indicators are handled automatically by typingAwareLLM)
    const completion = await this.typingAwareLLM.complete({
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
      ...(completion.hasNativeToolCalls && { hasNativeToolCalls: completion.hasNativeToolCalls }),
      ...(completion.tool_calls && { tool_calls: completion.tool_calls }),
    };
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

    // Add recent history (last 10 messages for context)
    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
      messages.push({
        role: "assistant",
        content: `${msg.agentName}: ${msg.content}`,
      });
    }

    // Add current user message
    messages.push({
      role: "user",
      content: event.content,
    });

    return messages;
  }

  protected parseResponse(rawContent: string): { content: string; signal?: ConversationSignal } {
    const lines = rawContent.split("\n");
    const content = [];
    let signal: ConversationSignal | undefined;
    let inSignalSection = false;

    for (const line of lines) {
      if (line.startsWith("SIGNAL:")) {
        inSignalSection = true;
        const signalType = line.replace("SIGNAL:", "").trim() as ConversationSignal["type"];
        signal = { type: signalType };
      } else if (inSignalSection && line.startsWith("REASON:")) {
        if (signal) {
          signal.reason = line.replace("REASON:", "").trim();
        }
      } else if (!inSignalSection) {
        content.push(line);
      }
    }

    return {
      content: content.join("\n").trim(),
      signal,
    };
  }

  private async executeToolsAndPublishResults(
    response: AgentResponse,
    context: EventContext
  ): Promise<void> {
    if (!this.toolRegistry) {
      agentLogger.warning("No tool registry available for executing tools");
      return;
    }

    const executor = new ToolExecutor(this.toolRegistry);
    const toolCalls = response.toolCalls || [];

    // Convert native tool calls if present
    if (response.hasNativeToolCalls && response.tool_calls) {
      for (const tc of response.tool_calls) {
        toolCalls.push({
          id: tc.id,
          name: tc.function.name,
          arguments:
            typeof tc.function.arguments === "string"
              ? JSON.parse(tc.function.arguments)
              : tc.function.arguments,
        });
      }
    }

    if (toolCalls.length === 0) {
      return;
    }

    // Execute tools
    const toolContext = {
      agentName: this.config.name,
      rootEventId: context.rootEventId,
      eventId: context.originalEvent.id,
      projectId: context.projectId,
      projectEvent: context.projectEvent,
      ndk: this.ndk,
      agent: this,
      publisher: this.publisher,
    };

    const toolResults = await executor.executeTools(toolCalls, toolContext);

    // Format tool results as a follow-up message
    let resultContent = "Here are the results:\n\n";
    for (const result of toolResults) {
      const toolCall = toolCalls.find((tc) => tc.id === result.tool_call_id);
      if (toolCall) {
        resultContent += `**${toolCall.name}:**\n${result.output}\n\n`;
      }
    }

    // Save tool results to conversation history
    await this.store.appendMessage(context.rootEventId, {
      id: `${Date.now()}-${this.config.name}-tools`,
      agentName: this.config.name,
      content: resultContent.trim(),
      timestamp: Date.now(),
    });

    // Publish tool results as a follow-up response
    const toolResponse: AgentResponse = {
      content: resultContent.trim(),
      metadata: {
        isToolResult: true,
        model: response.metadata?.model,
        provider: response.metadata?.provider,
      },
    };

    await this.publisher.publishResponse(toolResponse, context, this.signer, this.config.name);
  }
}

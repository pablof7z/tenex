import { ToolExecutor } from "@/utils/agents/tools/ToolExecutor";
import { parseToolCalls, removeToolCalls } from "@/utils/agents/tools/ToolParser";
import type { ToolRegistry } from "@/utils/agents/tools/ToolRegistry";
import type { ToolCall } from "@/utils/agents/tools/types";
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
    
    // Check if the incoming event has a claude-session-id tag
    const sessionIdTag = event.tags?.find(tag => tag[0] === "claude-session-id");
    const extraTags = sessionIdTag ? [sessionIdTag] : undefined;
    
    await this.publisher.publishResponse(response, context, this.signer, this.config.name, extraTags);
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
      await this.publisher.publishTypingIndicator(this.config.name, true, context, this.signer, {
        systemPrompt,
        userPrompt,
      });
    } catch (error) {
      // Don't fail the LLM call if typing indicator fails
      agentLogger.debug(`Failed to publish typing start indicator: ${error}`, "verbose");
    }

    try {
      // Get initial LLM response
      const initialResponse = await this.llm.complete({
        messages,
        context: {
          agentName: this.config.name,
          rootEventId: context.rootEventId,
          eventId: event.id,
          originalEvent: context.originalEvent,
          projectEvent: context.projectEvent,
          ndk: this.ndk,
          agent: this,
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

      // Check for tool calls in the response
      const toolCalls = parseToolCalls(initialResponse.content);

      // If no tool calls, return the response as-is
      if (toolCalls.length === 0) {
        // Parse response and extract signal
        const { content, signal } = this.parseResponse(initialResponse.content);

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
          model: initialResponse.model,
          provider: this.config.llmConfig?.provider,
          systemPrompt,
          userPrompt: event.content,
          rawResponse: initialResponse.content,
          usage: initialResponse.usage
            ? {
                promptTokens: initialResponse.usage.promptTokens,
                completionTokens: initialResponse.usage.completionTokens,
                totalTokens: initialResponse.usage.totalTokens,
                cacheCreationTokens: initialResponse.usage.cacheCreationTokens,
                cacheReadTokens: initialResponse.usage.cacheReadTokens,
                cost: initialResponse.usage.cost,
              }
            : undefined,
        };

        return {
          content,
          signal,
          metadata,
        };
      }

      // Check if we have tool registry before attempting to execute tools
      if (!this.toolRegistry) {
        agentLogger.error(
          `Agent ${this.config.name} generated tool calls but has no tool registry. Tool calls: ${JSON.stringify(toolCalls)}`
        );
        
        // Return error response
        const errorContent = `I attempted to use tools but no tool registry is configured. This is a configuration error. Original response contained tool calls that could not be executed.`;
        
        return {
          content: errorContent,
          metadata: {
            model: initialResponse.model,
            provider: this.config.llmConfig?.provider,
            systemPrompt,
            userPrompt: event.content,
            rawResponse: initialResponse.content
          }
        };
      }

      // Execute tools
      const toolResults = await this.executeTools(toolCalls, context);

      // Build messages for final response
      const finalMessages = [
        ...messages,
        { role: "assistant" as const, content: initialResponse.content },
        ...toolResults.map((result) => ({
          role: "tool" as const,
          content: result.output,
        })),
      ];

      // Get final response after tool execution
      const finalResponse = await this.llm.complete({
        messages: finalMessages,
        context: {
          agentName: this.config.name,
          rootEventId: context.rootEventId,
          eventId: event.id,
          originalEvent: context.originalEvent,
          projectEvent: context.projectEvent,
          ndk: this.ndk,
          agent: this,
        },
      });

      // Parse response and extract signal
      const { content, signal } = this.parseResponse(finalResponse.content);

      // Save complete interaction to conversation history
      await this.store.appendMessage(context.rootEventId, {
        id: `${Date.now()}-${this.config.name}`,
        agentName: this.config.name,
        content: removeToolCalls(initialResponse.content),
        timestamp: Date.now(),
      });

      // Save tool results
      for (const result of toolResults) {
        const toolCall = toolCalls.find((tc) => tc.id === result.tool_call_id);
        if (toolCall) {
          await this.store.appendMessage(context.rootEventId, {
            id: `${Date.now()}-tool-${toolCall.name}`,
            agentName: `${this.config.name} (tool: ${toolCall.name})`,
            content: result.output,
            timestamp: Date.now(),
          });
        }
      }

      // Save final response
      await this.store.appendMessage(context.rootEventId, {
        id: `${Date.now()}-${this.config.name}-final`,
        agentName: this.config.name,
        content,
        timestamp: Date.now(),
        signal,
      });

      // Build metadata combining both responses
      const metadata: import("../core/types").LLMMetadata = {
        model: finalResponse.model || initialResponse.model,
        provider: this.config.llmConfig?.provider,
        systemPrompt,
        userPrompt: event.content,
        rawResponse: finalResponse.content,
        usage: {
          promptTokens:
            (initialResponse.usage?.promptTokens || 0) + (finalResponse.usage?.promptTokens || 0),
          completionTokens:
            (initialResponse.usage?.completionTokens || 0) +
            (finalResponse.usage?.completionTokens || 0),
          totalTokens:
            (initialResponse.usage?.totalTokens || 0) + (finalResponse.usage?.totalTokens || 0),
          cacheCreationTokens:
            (initialResponse.usage?.cacheCreationTokens || 0) +
            (finalResponse.usage?.cacheCreationTokens || 0),
          cacheReadTokens:
            (initialResponse.usage?.cacheReadTokens || 0) +
            (finalResponse.usage?.cacheReadTokens || 0),
          cost: (initialResponse.usage?.cost || 0) + (finalResponse.usage?.cost || 0),
        },
      };

      return {
        content,
        signal,
        metadata,
      };
    } finally {
      // Always publish typing stop indicator
      try {
        await this.publisher.publishTypingIndicator(this.config.name, false, context, this.signer);
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
    // Look for signal in the format specified in prompts:
    // SIGNAL: <signal_type>
    // REASON: <optional reason>
    // Must be at the very end of the content
    const lines = content.split('\n');
    let signalLineIndex = -1;
    
    // Find the last occurrence of SIGNAL: at the start of a line
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i]?.trim().startsWith('SIGNAL:')) {
        signalLineIndex = i;
        break;
      }
    }
    
    if (signalLineIndex === -1) {
      return { content };
    }
    
    // Extract signal type
    const signalLine = lines[signalLineIndex];
    const signalTypeMatch = signalLine?.match(/SIGNAL:\s*(\w+)/);
    if (!signalTypeMatch) {
      return { content };
    }
    
    const signalType = signalTypeMatch[1]?.toLowerCase();
    
    // Check if next line is REASON:
    let reason: string | undefined;
    if (signalLineIndex + 1 < lines.length && lines[signalLineIndex + 1]?.trim().startsWith('REASON:')) {
      // Collect all lines from REASON: to the end
      const reasonLines = lines.slice(signalLineIndex + 1).join('\n');
      const reasonMatch = reasonLines.match(/REASON:\s*([\s\S]*)/);
      if (reasonMatch) {
        reason = reasonMatch[1]?.trim();
      }
    }
    
    // Validate signal type
    const validSignals = ["continue", "ready_for_transition", "need_input", "blocked", "complete"];
    if (signalType && validSignals.includes(signalType)) {
      const signal: ConversationSignal = {
        type: signalType as ConversationSignal["type"],
        ...(reason && { reason })
      };
      
      // Remove signal section from content
      const cleanContent = lines.slice(0, signalLineIndex).join('\n').trim();
      return { content: cleanContent, signal };
    } else {
      agentLogger.warning(`Invalid signal type: ${signalType}`, "normal");
    }

    return { content };
  }

  private async executeTools(
    toolCalls: ToolCall[],
    context: EventContext
  ): Promise<{ tool_call_id: string; output: string }[]> {
    if (!this.toolRegistry || toolCalls.length === 0) {
      return [];
    }

    const executor = new ToolExecutor(this.toolRegistry);

    // Extract claude-session-id from the original event if present
    const sessionIdTag = context.originalEvent.tags?.find(tag => tag[0] === "claude-session-id");
    const claudeSessionId = sessionIdTag?.[1];

    // Create tool context with all necessary information
    const toolContext = {
      agentName: this.config.name,
      rootEventId: context.rootEventId,
      eventId: context.eventId,
      originalEvent: context.originalEvent,
      projectEvent: context.projectEvent,
      ndk: this.ndk,
      agent: this,
      publisher: this.publisher,
      claudeSessionId,
    };

    return executor.executeTools(toolCalls, toolContext);
  }
}

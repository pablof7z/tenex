import type { Agent } from "@/agents/types";
import { getTotalExecutionTimeSeconds } from "@/conversations/executionTime";
import type { Conversation } from "@/conversations/types";
import { EVENT_KINDS } from "@/llm/types";
import { getNDK } from "@/nostr";
import { EXECUTION_TAGS } from "@/nostr/tags";
import type { LLMMetadata } from "@/nostr/types";
import { getProjectContext } from "@/services";
import type { ContinueFlow, YieldBack, EndConversation } from "@/tools/types";
import { logger } from "@/utils/logger";
import type NDK from "@nostr-dev-kit/ndk";
import {
  NDKEvent,
  type NDKPrivateKeySigner,
  type NDKProject,
  type NDKTag,
} from "@nostr-dev-kit/ndk";

// Tool execution status interface (from ToolExecutionPublisher)
export interface ToolExecutionStatus {
  tool: string;
  status: "starting" | "running" | "completed" | "failed";
  args?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  duration?: number;
}

// Context passed to publisher on creation
export interface NostrPublisherContext {
  conversation: Conversation;
  agent: Agent;
  triggeringEvent: NDKEvent;
}

// Options for publishing responses
export interface ResponseOptions {
  content: string;
  llmMetadata?: LLMMetadata;
  continueMetadata?: ContinueFlow;
  completeMetadata?: YieldBack | EndConversation;
  additionalTags?: NDKTag[];
}

// Metadata for finalizing stream
export interface FinalizeMetadata {
  llmMetadata?: LLMMetadata;
  continueMetadata?: ContinueFlow;
  completeMetadata?: YieldBack | EndConversation;
}

export class NostrPublisher {
  constructor(public readonly context: NostrPublisherContext) {}

  async publishResponse(options: ResponseOptions): Promise<NDKEvent> {
    try {
      const reply = this.createBaseReply();

      // Use the continue message if available, otherwise use the content
      // This ensures the next agent receives the actual instruction, not a placeholder
      if (options.continueMetadata?.routing?.message) {
        reply.content = options.continueMetadata.routing.message;
      } else if (options.completeMetadata?.type === "yield_back") {
        // If we have yield_back metadata with a response, use it
        reply.content = options.completeMetadata.completion.response;
      } else if (options.completeMetadata?.type === "end_conversation") {
        // If we have end_conversation metadata with a response, use it
        reply.content = options.completeMetadata.result.response;
      } else {
        reply.content = options.content;
      }

      // Add metadata tags
      this.addLLMMetadata(reply, options.llmMetadata);
      this.addRoutingMetadata(reply, options.continueMetadata);

      // Debug logging for metadata
      logger.debug("Adding metadata to response", {
        hasLLMMetadata: !!options.llmMetadata,
        llmModel: options.llmMetadata?.model,
        llmCost: options.llmMetadata?.cost,
        hasContinueMetadata: !!options.continueMetadata,
        hasCompleteMetadata: !!options.completeMetadata,
      });

      // Handle routing
      if (options.continueMetadata?.routing?.destinations) {
        // Add p-tags for all destination agents
        const destinations = options.continueMetadata.routing.destinations;
        for (const pubkey of destinations) {
          reply.tag(["p", pubkey]);
        }
      } else if (options.completeMetadata?.type === "yield_back") {
        // Handle yield_back routing
        reply.tag(["p", options.completeMetadata.completion.nextAgent]);
      }

      // Add any additional tags
      if (options.additionalTags) {
        for (const tag of options.additionalTags) {
          reply.tag(tag);
        }
      }

      // Sign and publish
      await reply.sign(this.context.agent.signer);
      await reply.publish();

      logger.debug("Published agent response", {
        eventId: reply.id,
        contentLength: options.content.length,
        agent: this.context.agent.name,
        phase: this.context.conversation.phase,
      });

      return reply;
    } catch (error) {
      logger.error("Failed to publish response", {
        agent: this.context.agent.name,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async publishError(message: string): Promise<NDKEvent> {
    try {
      const reply = this.createBaseReply();
      reply.content = message;
      reply.tag(["error", "system"]);

      await reply.sign(this.context.agent.signer);
      await reply.publish();

      logger.debug("Published error notification", {
        eventId: reply.id,
        error: message,
        agent: this.context.agent.name,
      });

      return reply;
    } catch (error) {
      logger.error("Failed to publish error", {
        agent: this.context.agent.name,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async publishTypingIndicator(state: "start" | "stop"): Promise<NDKEvent> {
    try {
      const { agent } = this.context;

      const event = new NDKEvent(getNDK());
      event.kind =
        state === "start" ? EVENT_KINDS.TYPING_INDICATOR : EVENT_KINDS.TYPING_INDICATOR_STOP;
      event.content = state === "start" ? `${agent.name} is typing` : "";

      // Add base tags (project, phase)
      this.addBaseTags(event);

      // Add conversation references
      event.tag(["e", this.context.conversation.id]);

      await event.sign(this.context.agent.signer);
      await event.publish();

      logger.debug(`Published typing indicator ${state}`, {
        conversationId: this.context.conversation.id,
        author: event.pubkey,
        agent: this.context.agent.name,
      });

      return event;
    } catch (error) {
      logger.error(`Failed to publish typing indicator ${state}`, {
        agent: this.context.agent.name,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async publishToolStatus(status: ToolExecutionStatus): Promise<NDKEvent> {
    try {
      const event = this.context.triggeringEvent.reply();

      // Add base tags
      this.addBaseTags(event);

      // Add tool-specific tags
      event.tag(["tool", status.tool]);
      event.tag(["status", status.status]);

      // Build human-readable content (keeping existing format)
      const contentParts: string[] = [];

      switch (status.status) {
        case "starting":
          contentParts.push(`🔧 Preparing to run ${status.tool}...`);
          if (status.args) {
            contentParts.push(`Parameters: ${JSON.stringify(status.args, null, 2)}`);
          }
          break;

        case "running":
          contentParts.push(`🏃 Running ${status.tool}...`);
          break;

        case "completed":
          contentParts.push(`✅ ${status.tool} completed`);
          if (status.duration) {
            contentParts.push(`Duration: ${status.duration}ms`);
          }
          break;

        case "failed":
          contentParts.push(`❌ ${status.tool} failed`);
          if (status.error) {
            contentParts.push(`Error: ${status.error}`);
          }
          break;
      }

      event.content = contentParts.join("\n");

      await event.sign(this.context.agent.signer);
      // await event.publish();

      logger.debug("Published tool execution status", {
        tool: status.tool,
        status: status.status,
        eventId: event.id,
        agent: this.context.agent.name,
      });

      return event;
    } catch (error) {
      logger.error("Failed to publish tool execution status", {
        tool: status.tool,
        status: status.status,
        agent: this.context.agent.name,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  createStreamPublisher(): StreamPublisher {
    return new StreamPublisher(this);
  }

  // Private helper methods
  public createBaseReply(): NDKEvent {
    const reply = this.context.triggeringEvent.reply();

    // When the triggering event has the same E and e tags and the author of the triggering event is the author of the thread, we want to mock a chat interface, where
    // we don't reply in threads. This is a custom behavior; do not change it
    const PTag = this.context.triggeringEvent.tagValue("P");
    const ETag = this.context.triggeringEvent.tagValue("E");
    const eTag = this.context.triggeringEvent.tagValue("e");
    const pubkey = this.context.triggeringEvent.pubkey;

    // if (PTag === pubkey && ETag === eTag && ETag) {
    if (ETag) {
      reply.removeTag("e");
      reply.tags.push(["e", ETag]);
    }
    // } else {
    //     console.log("not replying to root event", { PTag, pubkey, ETag, eTag });
    //     console.log('event', this.context.triggeringEvent.inspect)
    // }

    reply.tags.push(["triggering-event-id", this.context.triggeringEvent.id]);
    reply.tags.push([
      "triggering-event-content",
      this.context.triggeringEvent.content.substring(0, 50),
    ]);

    this.addBaseTags(reply);
    this.cleanPTags(reply);
    return reply;
  }

  private addBaseTags(event: NDKEvent): void {
    // Always add project tag
    const { project } = getProjectContext();
    event.tag(project);

    // Always add current phase tag
    event.tag(["phase", this.context.conversation.phase]);

    // Always add execution time tag
    const totalSeconds = getTotalExecutionTimeSeconds(this.context.conversation);
    event.tag([EXECUTION_TAGS.NET_TIME, totalSeconds.toString()]);
  }

  private cleanPTags(event: NDKEvent): void {
    // Remove all p-tags added by NDK's reply() method to ensure clean routing
    event.tags = event.tags.filter((tag) => tag[0] !== "p");
  }

  private addLLMMetadata(event: NDKEvent, metadata?: LLMMetadata): void {
    if (!metadata) return;

    event.tag(["llm-model", metadata.model]);
    event.tag(["llm-cost-usd", metadata.cost.toString()]);
    event.tag(["llm-prompt-tokens", metadata.promptTokens.toString()]);
    event.tag(["llm-completion-tokens", metadata.completionTokens.toString()]);
    event.tag(["llm-total-tokens", metadata.totalTokens.toString()]);

    if (metadata.contextWindow) {
      event.tag(["llm-context-window", metadata.contextWindow.toString()]);
    }
    if (metadata.maxCompletionTokens) {
      event.tag(["llm-max-completion-tokens", metadata.maxCompletionTokens.toString()]);
    }
    if (metadata.systemPrompt) {
      event.tag(["llm-system-prompt", metadata.systemPrompt]);
    }
    if (metadata.userPrompt) {
      event.tag(["llm-user-prompt", metadata.userPrompt]);
    }
    if (metadata.rawResponse) {
      event.tag(["llm-raw-response", metadata.rawResponse]);
    }
  }

  private addRoutingMetadata(event: NDKEvent, continueMetadata?: ContinueFlow): void {
    if (!continueMetadata?.routing) return;

    const { routing } = continueMetadata;

    // Add phase information
    if (routing.phase) {
      event.tag(["new-phase", routing.phase]);
    }
    
    // Only add phase-transition tag if phase is actually changing
    const isPhaseTransition =
      routing.phase &&
      routing.phase !== this.context.conversation.phase;
    if (isPhaseTransition) {
      event.tag(["phase-from", this.context.conversation.phase]);
    }

    // Add routing reason
    if (routing.reason) {
      event.tag(["routing-reason", routing.reason]);
    }

    // Add routing message (instructions for next agent)
    if (routing.message) {
      event.tag(["routing-message", routing.message]);
    }

    // Add routing context summary if provided
    if (routing.context && typeof routing.context.summary === "string") {
      event.tag(["routing-summary", routing.context.summary]);
    }

    // Add destinations as a tag for debugging/tracing
    if (routing.destinations && routing.destinations.length > 0) {
      event.tag(["routing-destinations", routing.destinations.join(",")]);
    }
  }
}

export class StreamPublisher {
  private pendingContent = ""; // Content waiting to be published
  private sequence = 0;
  private hasFinalized = false;
  private flushTimeout: NodeJS.Timeout | null = null;
  private scheduledContent = "";
  private static readonly FLUSH_DELAY_MS = 100; // Delay before actually publishing

  constructor(private readonly publisher: NostrPublisher) {}

  addContent(content: string): void {
    // If we have scheduled content and new content is arriving,
    // immediately publish the scheduled content to prioritize low latency
    if (this.flushTimeout && this.scheduledContent) {
      this.cancelScheduledFlush();
      // Fire-and-forget to avoid blocking new content. The method handles its own errors.
      this.publishScheduledContent().catch((error) => {
        logger.error("Failed to publish scheduled content on new content arrival", {
          error: error instanceof Error ? error.message : String(error),
          agent: this.publisher.context.agent.name,
        });
      });
    }

    this.pendingContent += content;
  }

  async flush(): Promise<void> {
    // Skip if no content to flush or already finalized
    if (!this.pendingContent.trim() || this.hasFinalized) {
      logger.debug("Skipping flush - no content or already finalized", {
        hasContent: !!this.pendingContent.trim(),
        hasFinalized: this.hasFinalized,
        sequence: this.sequence,
      });
      return;
    }

    // If there's already a scheduled flush, we need to handle it
    if (this.flushTimeout) {
      // If a flush is already scheduled, publish it immediately and schedule the new content.
      // This prioritizes latency for the first batch while still batching subsequent content.
      this.cancelScheduledFlush();
      if (this.scheduledContent) {
        await this.publishScheduledContent();
      }
    }

    // Schedule this content to be published after a delay
    // This balances between network efficiency (batching) and user experience (low latency)
    this.scheduledContent = this.pendingContent;
    this.pendingContent = "";

    logger.debug("Scheduling flush", {
      contentLength: this.scheduledContent.length,
      delay: StreamPublisher.FLUSH_DELAY_MS,
      agent: this.publisher.context.agent.name,
    });

    this.flushTimeout = setTimeout(async () => {
      if (!this.hasFinalized && this.scheduledContent) {
        await this.publishScheduledContent();
      }
      this.flushTimeout = null;
    }, StreamPublisher.FLUSH_DELAY_MS);
  }

  async finalize(metadata: FinalizeMetadata): Promise<NDKEvent> {
    if (this.hasFinalized) {
      throw new Error("Stream already finalized");
    }

    try {
      // Cancel any pending flush timeout
      if (this.flushTimeout) {
        this.cancelScheduledFlush();
      }

      // Move any scheduled content back to pending
      if (this.scheduledContent) {
        this.pendingContent = this.scheduledContent + this.pendingContent;
        this.scheduledContent = "";
      }

      // Always publish the final event with metadata
      const finalEvent = await this.publisher.publishResponse({
        content: this.pendingContent,
        ...metadata,
      });

      logger.debug("Finalized streaming response", {
        totalSequences: this.sequence,
        agent: this.publisher.context.agent.name,
      });

      this.hasFinalized = true;

      return finalEvent;
    } catch (error) {
      logger.error("Failed to finalize streaming response", {
        agent: this.publisher.context.agent.name,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  isFinalized(): boolean {
    return this.hasFinalized;
  }

  getSequenceNumber(): number {
    return this.sequence;
  }

  // Private helper methods
  private cancelScheduledFlush(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
  }

  private async publishScheduledContent(): Promise<void> {
    // Capture the state into local variables immediately
    const contentToPublish = this.scheduledContent;

    if (!contentToPublish.trim() || this.hasFinalized) {
      // Clear scheduled state even if we return early
      this.scheduledContent = "";
      return;
    }

    // Clear the shared state *before* the async operation
    this.scheduledContent = "";

    try {
      const reply = this.publisher.createBaseReply();

      // Add streaming tags
      this.sequence++;
      reply.tag(["streaming", "true"]);
      reply.tag(["partial", "true"]);
      reply.tag(["sequence", this.sequence.toString()]);

      reply.content = contentToPublish;

      await reply.sign(this.publisher.context.agent.signer);
      await reply.publish();

      logger.debug("Published scheduled streaming content", {
        sequence: this.sequence,
        contentLength: contentToPublish.length,
        agent: this.publisher.context.agent.name,
      });
    } catch (error) {
      // On failure, prepend content to the start of the pending buffer to be retried
      this.pendingContent = contentToPublish + this.pendingContent;
      this.sequence--; // Roll back sequence number on failure

      logger.error("Failed to publish scheduled content, content queued for retry", {
        sequence: this.sequence + 1,
        agent: this.publisher.context.agent.name,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

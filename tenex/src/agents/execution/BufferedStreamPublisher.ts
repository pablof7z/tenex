import type { Agent } from "@/agents/types";
import { publishAgentResponse } from "@/nostr/ConversationPublisher";
import type { LLMMetadata } from "@/nostr/types";
import { logger } from "@/utils/logger";
import type { NDKEvent } from "@nostr-dev-kit/ndk";

export class BufferedStreamPublisher {
  private contentBuffer = "";
  private eventToReply: NDKEvent | undefined;
  private agent: Agent;
  private messageCount = 0;

  constructor(eventToReply: NDKEvent | undefined, agent: Agent) {
    this.eventToReply = eventToReply;
    this.agent = agent;
  }

  /**
   * Add content to the buffer
   */
  addContent(content: string): void {
    this.contentBuffer += content;
  }

  /**
   * Flush the buffer and publish as a partial response
   */
  async flush(isToolCall = false): Promise<void> {
    if (!this.contentBuffer || !this.eventToReply || !this.agent.signer) {
      return;
    }

    try {
      this.messageCount++;

      // Publish the buffered content as a partial response
      await publishAgentResponse(
        this.eventToReply,
        this.contentBuffer,
        "", // No next responder for partial messages
        this.agent.signer,
        undefined, // No LLM metadata for partial messages
        [
          ["streaming", "true"],
          ["partial", "true"],
          ["sequence", this.messageCount.toString()],
          ["trigger", isToolCall ? "tool_call" : "manual"],
        ]
      );

      logger.debug("Published partial streaming response", {
        agent: this.agent.name,
        contentLength: this.contentBuffer.length,
        sequence: this.messageCount,
        trigger: isToolCall ? "tool_call" : "manual",
        preview: `${this.contentBuffer.substring(0, 50)}...`,
      });

      // Clear the buffer
      this.contentBuffer = "";
    } catch (error) {
      logger.error("Failed to publish partial streaming response", {
        agent: this.agent.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get the current buffer content without clearing it
   */
  getBuffer(): string {
    return this.contentBuffer;
  }

  /**
   * Check if there's content in the buffer
   */
  hasContent(): boolean {
    return this.contentBuffer.length > 0;
  }
}

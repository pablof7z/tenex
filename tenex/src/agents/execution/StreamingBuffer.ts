import { publishAgentResponse } from "@/nostr/ConversationPublisher";
import type { LLMMetadata } from "@/nostr/types";
import { logger } from "@/utils/logger";
import type NDK from "@nostr-dev-kit/ndk";
import type { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";

export class StreamingBuffer {
  private contentBuffer = "";

  constructor(
    private ndk: NDK,
    private eventToReply: NDKEvent | undefined,
    private signer: NDKPrivateKeySigner | undefined,
    private agentName: string
  ) {}

  /**
   * Add content to the buffer
   */
  append(content: string): void {
    this.contentBuffer += content;
  }

  /**
   * Flush the buffer and publish as a conversation reply
   */
  async flush(llmMetadata?: LLMMetadata): Promise<void> {
    if (!this.contentBuffer || !this.eventToReply || !this.signer) {
      return;
    }

    try {
      await publishAgentResponse(
        this.eventToReply,
        this.contentBuffer,
        "", // No next responder for partial responses
        this.signer,
        llmMetadata
      );

      logger.debug("Published streaming content", {
        agent: this.agentName,
        contentLength: this.contentBuffer.length,
        preview: `${this.contentBuffer.substring(0, 50)}...`,
      });

      this.contentBuffer = "";
    } catch (error) {
      logger.error("Failed to publish streaming content", {
        agent: this.agentName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get the current buffer content without clearing it
   */
  getContent(): string {
    return this.contentBuffer;
  }

  /**
   * Check if buffer has content
   */
  hasContent(): boolean {
    return this.contentBuffer.length > 0;
  }
}

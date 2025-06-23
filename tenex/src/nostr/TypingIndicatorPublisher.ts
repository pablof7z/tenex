import type NDK from "@nostr-dev-kit/ndk";
import { NDKEvent, type NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { EVENT_KINDS } from "@/llm/types";
import { logger } from "@/utils/logger";

/**
 * Handles publishing typing indicators to Nostr
 * Single Responsibility: Only manages typing indicator events
 */
export class TypingIndicatorPublisher {
  constructor(private ndk: NDK) {}

  /**
   * Publish a typing indicator start event
   */
  async publishTypingStart(
    conversationEvent: NDKEvent,
    signer: NDKPrivateKeySigner
  ): Promise<NDKEvent> {
    const typingEvent = new NDKEvent(this.ndk);
    
    typingEvent.kind = EVENT_KINDS.TYPING_INDICATOR;
    typingEvent.content = "";
    
    // Reference the conversation
    typingEvent.tag(["E", conversationEvent.id]);
    
    // Reference the message being replied to
    if (conversationEvent.id) {
      typingEvent.tag(["e", conversationEvent.id]);
    }
    
    await typingEvent.sign(signer);
    await typingEvent.publish();
    
    logger.debug("Published typing indicator start", {
      conversationId: conversationEvent.id,
      author: typingEvent.pubkey,
    });
    
    return typingEvent;
  }

  /**
   * Publish a typing indicator stop event
   */
  async publishTypingStop(
    conversationEvent: NDKEvent,
    signer: NDKPrivateKeySigner
  ): Promise<NDKEvent> {
    const typingEvent = new NDKEvent(this.ndk);
    
    typingEvent.kind = EVENT_KINDS.TYPING_INDICATOR_STOP;
    typingEvent.content = "";
    
    // Reference the conversation
    typingEvent.tag(["E", conversationEvent.id]);
    
    // Reference the message being replied to
    if (conversationEvent.id) {
      typingEvent.tag(["e", conversationEvent.id]);
    }
    
    await typingEvent.sign(signer);
    await typingEvent.publish();
    
    logger.debug("Published typing indicator stop", {
      conversationId: conversationEvent.id,
      author: typingEvent.pubkey,
    });
    
    return typingEvent;
  }
}
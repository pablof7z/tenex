import type NDK from "@nostr-dev-kit/ndk";
import { NDKEvent, type NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { EVENT_KINDS } from "@/llm/types";
import { logger } from "@/utils/logger";

/**
 * Publish a typing indicator start event
 */
export async function publishTypingStart(
    ndk: NDK,
    conversationEvent: NDKEvent,
    signer: NDKPrivateKeySigner
): Promise<NDKEvent> {
    const typingEvent = new NDKEvent(ndk);

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
export async function publishTypingStop(
    ndk: NDK,
    conversationEvent: NDKEvent,
    signer: NDKPrivateKeySigner
): Promise<NDKEvent> {
    const typingEvent = new NDKEvent(ndk);

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

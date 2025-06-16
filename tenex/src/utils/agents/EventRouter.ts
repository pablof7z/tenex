import type { ConversationStorage } from "@/utils/agents/ConversationStorage";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";

/**
 * Handles common event routing and validation logic
 * Extracted from AgentCommunicationHandler to reduce complexity
 */
export class EventRouter {
    constructor(private conversationStorage: ConversationStorage) {}

    /**
     * Check if an event has already been processed
     */
    isEventProcessed(eventId: string): boolean {
        return this.conversationStorage.isEventProcessed(eventId);
    }

    /**
     * Extract conversation ID from an event
     */
    extractConversationId(event: NDKEvent): string {
        // Look for e-tag (reply to specific event)
        const eTag = event.tags.find((tag) => tag[0] === "e");
        if (eTag?.[1]) {
            return eTag[1];
        }

        // Look for root tag (thread root)
        const rootTag = event.tags.find((tag) => tag[0] === "root");
        if (rootTag?.[1]) {
            return rootTag[1];
        }

        // Default to event ID for new conversations
        return event.id;
    }

    /**
     * Log basic event information
     */
    logEventReceived(event: NDKEvent, eventType: string, mentionedPubkeys: string[] = []): void {
        logger.info(`📥 ${eventType.toUpperCase()} EVENT RECEIVED - Processing event ${event.id}`);
        logger.info(`   Author: ${event.author.pubkey}`);
        logger.info(`   Content: "${event.content}"`);
        if (mentionedPubkeys.length > 0) {
            logger.info(`   Mentioned pubkeys: ${JSON.stringify(mentionedPubkeys)}`);
        }
    }

    /**
     * Log conversation tracking information
     */
    logConversationTracking(conversationId: string): void {
        logger.info(`🔗 Conversation ID: ${conversationId}`);
        logger.info("📝 Adding event to all agent conversations...");
    }

    /**
     * Mark event as processed
     */
    async markEventProcessed(eventId: string, timestamp?: number): Promise<void> {
        await this.conversationStorage.markEventProcessed(eventId, timestamp || Date.now() / 1000);
    }
}

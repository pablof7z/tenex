import type { Agent } from "@/utils/agents/Agent";
import type { AgentSelectionService } from "@/utils/agents/AgentSelectionService";
import type { ConversationManager } from "@/utils/agents/ConversationManager";
import type { EventRouter } from "@/utils/agents/EventRouter";
import type { OrchestrationExecutionService } from "@/utils/agents/OrchestrationExecutionService";
import type { ResponseCoordinator } from "@/utils/agents/ResponseCoordinator";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";
import { traceFunction } from "@tenex/shared/services";
import type { LLMConfig } from "@tenex/types/llm";

/**
 * Handles chat event processing specifically
 * Extracted from AgentCommunicationHandler to improve maintainability
 */
export class ChatEventProcessor {
    constructor(
        private eventRouter: EventRouter,
        private conversationManager: ConversationManager,
        private agentSelectionService: AgentSelectionService,
        private responseCoordinator: ResponseCoordinator,
        private orchestrationExecutionService?: OrchestrationExecutionService
    ) {}

    /**
     * Process a chat event through the full pipeline
     */
    async processEvent(
        event: NDKEvent,
        agentName = "code",
        llmName?: string,
        mentionedPubkeys: string[] = []
    ): Promise<void> {
        return traceFunction("event.handler.chat", async (span) => {
            try {
                // Set telemetry attributes
                span?.setAttributes({
                    "event.id": event.id || "unknown",
                    "event.kind": event.kind || 0,
                    "event.author": event.author?.pubkey || "unknown",
                    "event.content_length": event.content?.length || 0,
                    "event.mentioned_pubkeys_count": mentionedPubkeys.length,
                    "event.llm_name": llmName || "default",
                    "event.agent_name": agentName,
                });

                // Log event receipt
                this.eventRouter.logEventReceived(event, "chat", mentionedPubkeys);

                // Check if already processed
                if (this.eventRouter.isEventProcessed(event.id)) {
                    span?.setAttributes({ "event.already_processed": true });
                    logger.info(`⏭️  Skipping already processed chat event ${event.id}`);
                    return;
                }

                // Extract conversation ID
                const conversationId = this.eventRouter.extractConversationId(event);
                span?.setAttributes({ "event.conversation_id": conversationId });
                this.eventRouter.logConversationTracking(conversationId);

                // Add to all agent conversations for context
                await this.conversationManager.addEventToAllAgentConversations(
                    event,
                    conversationId,
                    false // isTaskEvent
                );
                logger.info("✅ Added event to all agent conversations");

                // Determine responding agents
                logger.info("🤖 Determining which agents should respond...");
                const result = await this.agentSelectionService.determineRespondingAgents(
                    event,
                    conversationId,
                    mentionedPubkeys,
                    false // isTaskEvent
                );

                span?.setAttributes({
                    "event.agents_to_respond": result.agents.length,
                    "event.has_orchestration": Boolean(this.orchestrationExecutionService),
                });

                // Process responses through orchestration or direct coordination
                await this.responseCoordinator.coordinateResponses(
                    result,
                    event,
                    conversationId,
                    llmName,
                    false, // isTaskEvent
                    span
                );

                // Mark as processed
                await this.eventRouter.markEventProcessed(
                    event.id,
                    event.created_at || Date.now() / 1000
                );

                span?.setAttributes({ "event.processing_success": true });
            } catch (error) {
                span?.setAttributes({
                    "event.processing_success": false,
                    "event.error_type":
                        error instanceof Error ? error.constructor.name : typeof error,
                    "event.error_message": error instanceof Error ? error.message : String(error),
                });
                this.logEventError(event, error);
                throw error;
            }
        });
    }

    private logEventError(event: NDKEvent, error: unknown): void {
        logger.error(`Failed to handle chat event: ${error}`);
        logger.error(`Error details: ${error instanceof Error ? error.stack : String(error)}`);
        logger.error("Event details:");
        if (typeof event.inspect === "function") {
            logger.error(event.inspect());
        }
    }
}

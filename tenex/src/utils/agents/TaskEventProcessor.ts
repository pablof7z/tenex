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
 * Handles task event processing specifically
 * Extracted from AgentCommunicationHandler to improve maintainability
 */
export class TaskEventProcessor {
    constructor(
        private eventRouter: EventRouter,
        private conversationManager: ConversationManager,
        private agentSelectionService: AgentSelectionService,
        private responseCoordinator: ResponseCoordinator,
        private orchestrationExecutionService?: OrchestrationExecutionService
    ) {}

    /**
     * Process a task event through the full pipeline
     */
    async processEvent(
        event: NDKEvent,
        agentName = "code",
        llmName?: string,
        mentionedPubkeys: string[] = []
    ): Promise<void> {
        return traceFunction("event.handler.task", async (span) => {
            try {
                // Extract task details
                const titleTag = event.tags.find((tag) => tag[0] === "title");
                const title = titleTag ? titleTag[1] : "Untitled Task";
                const taskId = event.id;
                const taskContent = `Task: ${title}\n\nDescription:\n${event.content}`;

                // Set telemetry attributes
                span?.setAttributes({
                    "event.id": event.id || "unknown",
                    "event.kind": event.kind || 0,
                    "event.author": event.author?.pubkey || "unknown",
                    "event.content_length": event.content?.length || 0,
                    "event.mentioned_pubkeys_count": mentionedPubkeys.length,
                    "event.llm_name": llmName || "default",
                    "event.agent_name": agentName,
                    "task.title": title,
                    "task.id": taskId,
                });

                // Check if already processed
                if (this.eventRouter.isEventProcessed(event.id)) {
                    span?.setAttributes({ "event.already_processed": true });
                    logger.info(`Skipping already processed task event ${event.id}`);
                    return;
                }

                // Add to all agent conversations for context
                await this.conversationManager.addTaskToAllAgentConversations(
                    event,
                    taskId,
                    title,
                    taskContent
                );

                // Determine responding agents
                const result = await this.agentSelectionService.determineRespondingAgents(
                    event,
                    taskId,
                    mentionedPubkeys,
                    true // isTaskEvent
                );

                span?.setAttributes({
                    "event.agents_to_respond": result.agents.length,
                    "event.has_orchestration": Boolean(this.orchestrationExecutionService),
                });

                // Process responses through orchestration or direct coordination
                await this.responseCoordinator.coordinateResponses(
                    result,
                    event,
                    taskId,
                    llmName,
                    true, // isTaskEvent
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
        logger.error(`Failed to handle task event: ${error}`);
        logger.error(`Error details: ${error instanceof Error ? error.stack : String(error)}`);
        logger.error("Event details:");
        if (typeof event.inspect === "function") {
            logger.error(event.inspect());
        }
    }
}

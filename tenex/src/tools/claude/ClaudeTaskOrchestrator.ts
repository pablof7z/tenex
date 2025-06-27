import type { SDKMessage } from "@anthropic-ai/claude-code";
import { TaskPublisher } from "@/nostr/TaskPublisher";
import { ClaudeToNostrTranslator } from "./ClaudeToNostrTranslator";
import { ClaudeStreamHandler } from "./ClaudeStreamHandler";
import { logger } from "@/utils/logger";
import type { NDKTask } from "@/types/nostr";
import { startExecutionTime, stopExecutionTime } from "@/conversations/executionTime";
import type { Conversation } from "@/types";

export interface ClaudeTaskOptions {
    prompt: string;
    projectPath: string;
    title: string;
    branch?: string;
    conversationRootEventId?: string;
    conversation?: Conversation;
    abortSignal?: AbortSignal;
}

export interface ClaudeTaskResult {
    task: NDKTask;
    sessionId: string;
    totalCost: number;
    messageCount: number;
    duration: number;
    success: boolean;
    error?: string;
}

/**
 * Orchestrates Claude Code execution with Nostr task tracking
 * Single Responsibility: Coordinate Claude SDK execution with task lifecycle
 */
export class ClaudeTaskOrchestrator {
    constructor(
        private taskPublisher: TaskPublisher,
        private translator: ClaudeToNostrTranslator
    ) {}

    async execute(options: ClaudeTaskOptions): Promise<ClaudeTaskResult> {
        const startTime = Date.now();
        let task: NDKTask | undefined;
        let sessionId: string | undefined;
        let totalCost = 0;
        let messageCount = 0;

        try {
            // Start execution timing
            if (options.conversation) {
                startExecutionTime(options.conversation);
            }

            // Create task
            task = await this.taskPublisher.createTask({
                title: options.title,
                prompt: options.prompt,
                branch: options.branch,
                conversationRootEventId: options.conversationRootEventId,
            });

            // Create abort controller that responds to both timeout and external signal
            const abortController = new AbortController();
            
            // Link external abort signal if provided
            if (options.abortSignal) {
                options.abortSignal.addEventListener('abort', () => {
                    abortController.abort(options.abortSignal!.reason);
                });
            }

            // Use shared stream handler
            const result = await ClaudeStreamHandler.processStream({
                prompt: options.prompt,
                projectPath: options.projectPath,
                abortController,
                onMessage: async (message: SDKMessage) => {
                    // Translate and publish
                    const nostrEvent = this.translator.translateMessage(message);
                    if (nostrEvent && task) {
                        await this.taskPublisher.publishTaskUpdate(task, nostrEvent);
                    }
                }
            });

            // Extract metrics
            sessionId = result.metrics.sessionId;
            totalCost = result.metrics.totalCost;
            messageCount = result.metrics.messageCount;

            // Stop timing
            if (options.conversation) {
                stopExecutionTime(options.conversation);
            }

            const duration = Date.now() - startTime;

            // Complete task
            await this.taskPublisher.completeTask(task, true, {
                sessionId,
                totalCost,
                messageCount,
                duration,
            });

            return {
                task,
                sessionId: sessionId || '',
                totalCost,
                messageCount,
                duration,
                success: true,
            };

        } catch (error) {
            // Stop timing on error
            if (options.conversation) {
                stopExecutionTime(options.conversation);
            }

            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            
            // Mark task as failed
            if (task) {
                await this.taskPublisher.completeTask(task, false, { error: errorMessage });
            }

            logger.error("Claude task execution failed", { error: errorMessage });

            return {
                task: task!,
                sessionId: sessionId || '',
                totalCost,
                messageCount,
                duration: Date.now() - startTime,
                success: false,
                error: errorMessage,
            };
        }
    }
}
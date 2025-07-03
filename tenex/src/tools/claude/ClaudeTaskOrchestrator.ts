import type { SDKMessage } from "@anthropic-ai/claude-code";
import type { TextBlock, ContentBlock } from "@anthropic-ai/sdk/resources/messages/messages";
import type { TaskPublisher } from "@/nostr/TaskPublisher";
import { ClaudeCodeExecutor } from "./ClaudeCodeExecutor";
import { logger } from "@/utils/logger";
import type { NDKTask } from "@nostr-dev-kit/ndk";
import { startExecutionTime, stopExecutionTime } from "@/conversations/executionTime";
import type { Conversation } from "@/conversations/types";

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
    sessionId?: string;
    totalCost: number;
    messageCount: number;
    duration: number;
    success: boolean;
    error?: string;
}

/**
 * Orchestrates Claude Code execution with Nostr task tracking
 * Single Responsibility: Coordinate Claude SDK execution with task lifecycle and Nostr publishing
 */
export class ClaudeTaskOrchestrator {
    constructor(
        private taskPublisher: TaskPublisher
    ) {}

    async execute(options: ClaudeTaskOptions): Promise<ClaudeTaskResult> {
        const startTime = Date.now();

        // Create task
        const task = await this.taskPublisher.createTask({
            title: options.title,
            prompt: options.prompt,
            branch: options.branch,
            conversationRootEventId: options.conversationRootEventId,
        });

        // Create executor
        const executor = new ClaudeCodeExecutor({
            prompt: options.prompt,
            projectPath: options.projectPath,
            abortSignal: options.abortSignal,
        });

        try {
            // Start execution timing
            if (options.conversation) {
                startExecutionTime(options.conversation);
            }

            // Collect all assistant messages for final response
            const assistantMessages: string[] = [];

            // Execute and stream messages
            const generator = executor.execute();
            let result: ClaudeTaskResult | undefined;

            while (true) {
                const { value: message, done } = await generator.next();
                
                if (done) {
                    // The value is the final ClaudeCodeResult
                    const executionResult = message;
                    
                    // Stop timing
                    if (options.conversation) {
                        stopExecutionTime(options.conversation);
                    }

                    // Complete task
                    await this.taskPublisher.completeTask(task, executionResult.success, {
                        sessionId: executionResult.sessionId,
                        totalCost: executionResult.totalCost,
                        messageCount: executionResult.messageCount,
                        duration: executionResult.duration,
                        error: executionResult.error,
                    });

                    result = {
                        task,
                        sessionId: executionResult.sessionId,
                        totalCost: executionResult.totalCost,
                        messageCount: executionResult.messageCount,
                        duration: executionResult.duration,
                        success: executionResult.success,
                        error: executionResult.error,
                    };
                    break;
                }

                // Process SDK message and publish progress updates
                if (message && message.type === 'assistant' && message.message?.content) {
                    const textContent = message.message.content
                        .filter((c: ContentBlock): c is TextBlock => c.type === 'text')
                        .map((c: TextBlock) => c.text)
                        .join('');
                    
                    if (textContent) {
                        assistantMessages.push(textContent);
                        
                        // Publish progress update using TaskPublisher
                        await this.taskPublisher.publishTaskProgress(task, textContent);
                    }
                }
            }

            if (!result) {
                throw new Error("No result returned from ClaudeCodeExecutor");
            }
            return result;

        } catch (error) {
            // Stop timing on error
            if (options.conversation) {
                stopExecutionTime(options.conversation);
            }

            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            
            // Mark task as failed
            await this.taskPublisher.completeTask(task, false, { error: errorMessage });

            logger.error("Claude task execution failed", { error: errorMessage });

            return {
                task,
                totalCost: 0,
                messageCount: 0,
                duration: Date.now() - startTime,
                success: false,
                error: errorMessage,
            };
        }
    }
}
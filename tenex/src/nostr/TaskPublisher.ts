import { getProjectContext } from "@/services";
import type NDK from "@nostr-dev-kit/ndk";
import { NDKTask, type NDKEvent } from "@nostr-dev-kit/ndk";
import type { ClaudeCodeMessage } from "@/utils/claude/ClaudeParser";
import { logger } from "@/utils/logger";
import type { LLMMetadata } from "@/nostr/types";
import { STATUS_TAGS, LLM_TAGS, EXECUTION_TAGS, CLAUDE_TAGS } from "@/nostr/tags";
import { ClaudeCodeExecutor } from "@/tools/claude/ClaudeCodeExecutor";
import type { ClaudeCodeResult } from "@/tools/claude/ClaudeCodeExecutor";

export interface TaskCreationOptions {
    title: string;
    prompt: string;
    branch?: string;
    conversationRootEventId?: string;
}

export interface TaskUpdateOptions {
    status?: "pending" | "in-progress" | "completed" | "failed";
    progress?: number;
    message?: string;
    cost?: number;
    sessionId?: string;
    claudeMessage?: ClaudeCodeMessage;
}

/**
 * Handles publishing NDKTask events and updates
 * Follows direct NDK usage pattern - no unnecessary abstractions
 */
export class TaskPublisher {
    constructor(private ndk: NDK) {}

    /**
     * Create and publish a new NDKTask for code execution
     */
    async createTask(options: TaskCreationOptions): Promise<NDKTask> {
        const projectCtx = getProjectContext();

        // Create NDKTask event
        const task = new NDKTask(this.ndk);
        task.title = options.title;
        task.content = options.prompt;

        // Tag the project
        task.tag(projectCtx.project);

        // Add execution metadata
        if (options.branch) {
            task.tags.push([EXECUTION_TAGS.BRANCH, options.branch]);
        }
        task.tags.push([EXECUTION_TAGS.EXECUTOR, "claude-code"]);
        
        // Add the 'e' tag for the conversation root
        if (options.conversationRootEventId) {
            task.tags.push(["e", options.conversationRootEventId, "", "root"]);
        }

        // Sign and publish
        await task.sign(projectCtx.signer);
        await task.publish();

        logger.info("Published NDKTask", {
            id: task.id,
            title: task.title,
            branch: options.branch,
        });

        return task;
    }

    /**
     * Publish a task update event
     */
    async updateTask(task: NDKTask, update: TaskUpdateOptions): Promise<NDKEvent> {
        // Create a regular event that references the task
        const updateEvent = task.reply();

        // Tag the project
        const projectCtx = getProjectContext();
        updateEvent.tag(projectCtx.project);

        // Add status tags
        if (update.status) {
            updateEvent.tags.push([STATUS_TAGS.STATUS, update.status]);
        }
        if (update.progress !== undefined) {
            updateEvent.tags.push([STATUS_TAGS.PROGRESS, update.progress.toString()]);
        }
        if (update.cost !== undefined) {
            updateEvent.tags.push([LLM_TAGS.COST_USD, update.cost.toString()]);
        }
        if (update.sessionId) {
            updateEvent.tags.push([EXECUTION_TAGS.SESSION_ID, update.sessionId]);
        }

        // Handle Claude message if provided
        if (update.claudeMessage) {
            const message = update.claudeMessage;
            
            // Build LLM metadata from Claude message
            if (message.message?.model && message.message?.usage) {
                const llmMetadata: LLMMetadata = {
                    model: message.message.model,
                    cost: message.cost_usd || 0,
                    promptTokens: message.message.usage.input_tokens,
                    completionTokens: message.message.usage.output_tokens,
                    totalTokens: message.message.usage.input_tokens + message.message.usage.output_tokens,
                };

                // Add LLM metadata tags
                updateEvent.tags.push([LLM_TAGS.MODEL, llmMetadata.model]);
                updateEvent.tags.push([LLM_TAGS.COST_USD, llmMetadata.cost.toString()]);
                updateEvent.tags.push([LLM_TAGS.PROMPT_TOKENS, llmMetadata.promptTokens.toString()]);
                updateEvent.tags.push([LLM_TAGS.COMPLETION_TOKENS, llmMetadata.completionTokens.toString()]);
                updateEvent.tags.push([LLM_TAGS.TOTAL_TOKENS, llmMetadata.totalTokens.toString()]);
                
                // Add context window metadata if available
                if (llmMetadata.contextWindow) {
                    updateEvent.tags.push([LLM_TAGS.CONTEXT_WINDOW, llmMetadata.contextWindow.toString()]);
                }
                if (llmMetadata.maxCompletionTokens) {
                    updateEvent.tags.push([LLM_TAGS.MAX_COMPLETION_TOKENS, llmMetadata.maxCompletionTokens.toString()]);
                }
            }

            // Add Claude-specific metadata (for backwards compatibility)
            updateEvent.tags.push([CLAUDE_TAGS.MESSAGE_TYPE, message.type]);
            if (message.message?.id) {
                updateEvent.tags.push([CLAUDE_TAGS.MESSAGE_ID, message.message.id]);
            }
            if (message.session_id) {
                updateEvent.tags.push([CLAUDE_TAGS.SESSION_ID, message.session_id]);
            }

            // Set content from Claude message
            if (message.type === "assistant" && message.message?.content?.[0]?.text) {
                updateEvent.content = message.message.content[0].text;
            }
        } else {
            // Set content from update message
            updateEvent.content = update.message || `Task update: ${update.status || "in-progress"}`;
        }

        // Sign and publish
        await updateEvent.sign(projectCtx.signer);
        await updateEvent.publish();

        logger.debug("Published task update", {
            taskId: task.id,
            updateId: updateEvent.id,
            status: update.status,
            isClaudeMessage: !!update.claudeMessage,
        });

        return updateEvent;
    }

    /**
     * Publish Claude Code message as task update
     */
    async publishClaudeMessage(task: NDKTask, message: ClaudeCodeMessage): Promise<void> {
        // Only publish meaningful messages
        if (message.type !== "assistant") {
            return;
        }

        // Use updateTask with claudeMessage option
        await this.updateTask(task, { claudeMessage: message });
    }

    /**
     * Mark task as completed with final results
     */
    async completeTask(
        task: NDKTask,
        success: boolean,
        result: {
            sessionId?: string;
            totalCost?: number;
            messageCount?: number;
            duration?: number;
            error?: string;
        }
    ): Promise<NDKEvent> {
        const update: TaskUpdateOptions = {
            status: success ? "completed" : "failed",
            progress: 100,
            message: success
                ? `Task completed successfully. Session: ${result.sessionId}`
                : `Task failed: ${result.error || "Unknown error"}`,
            cost: result.totalCost,
            sessionId: result.sessionId,
        };

        // Include execution stats in message
        if (success && result.messageCount && result.duration) {
            update.message += `\nProcessed ${result.messageCount} messages in ${Math.round(result.duration / 1000)}s`;
        }

        return this.updateTask(task, update);
    }

    /**
     * Execute Claude Code with full NDK task tracking
     * This consolidates the common pattern used by both TaskExecutor and AgentExecutor
     */
    async executeWithTask(options: {
        prompt: string;
        projectPath: string;
        title: string;
        branch?: string;
        conversationRootEventId?: string;
    }): Promise<{
        task: NDKTask;
        result: ClaudeCodeResult;
    }> {
        let task: NDKTask | undefined;
        
        try {
            // Create NDKTask
            task = await this.createTask({
                title: options.title,
                prompt: options.prompt,
                branch: options.branch,
                conversationRootEventId: options.conversationRootEventId
            });
            
            // Update task status to in-progress
            await this.updateTask(task, {
                status: "in-progress",
                progress: 0,
                message: "Starting Claude Code execution..."
            });
            
            // Create ClaudeCodeExecutor with message callbacks
            const executor = new ClaudeCodeExecutor({
                prompt: options.prompt,
                projectPath: options.projectPath,
                onMessage: async (claudeMessage) => {
                    // Publish Claude messages as task replies
                    if (task) {
                        await this.publishClaudeMessage(task, claudeMessage);
                    }
                },
                onError: (error) => {
                    logger.error("Claude Code execution error", { 
                        error: error.message,
                        taskId: task?.id 
                    });
                }
            });
            
            // Execute and get result
            const result = await executor.execute();
            
            // Complete the task
            await this.completeTask(
                task,
                result.success,
                {
                    sessionId: result.sessionId,
                    totalCost: result.totalCost,
                    messageCount: result.messageCount,
                    duration: result.duration,
                    error: result.error
                }
            );
            
            return { task, result };
        } catch (error) {
            // If task was created, mark it as failed
            if (task) {
                await this.completeTask(
                    task,
                    false,
                    { error: error instanceof Error ? error.message : 'Unknown error' }
                );
            }
            throw error;
        }
    }
}

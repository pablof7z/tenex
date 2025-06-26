import { createExecutionBranch } from "@/utils/git/createExecutionBranch";
import { TaskPublisher, getNDK } from "@/nostr";
import { PromptBuilder } from "@/prompts";
import type { NDKTask } from "@nostr-dev-kit/ndk";
import { logger } from "@/utils/logger";

export interface TaskExecutionOptions {
    prompt: string;
    createBranch?: boolean;
}

export interface TaskExecutionResult {
    success: boolean;
    task: NDKTask;
    sessionId?: string;
    totalCost?: number;
    messageCount?: number;
    duration?: number;
    error?: string;
    branch?: string;
}

/**
 * Orchestrates standalone task execution using Claude Code
 * Integrates NDKTask creation, execution, and progress updates
 */
export class TaskExecutor {
    private taskPublisher: TaskPublisher;

    constructor() {
        const ndk = getNDK();
        this.taskPublisher = new TaskPublisher(ndk);
    }

    /**
     * Execute a standalone task with the given prompt
     */
    async execute(options: TaskExecutionOptions): Promise<TaskExecutionResult> {
        const startTime = Date.now();
        let branch: string | undefined;

        try {
            // 1. Create git branch if requested
            if (options.createBranch !== false) {
                const branchResult = createExecutionBranch(
                    options.prompt.substring(0, 30)
                );
                if (branchResult.created) {
                    branch = branchResult.branchName;
                }
            }

            // 2. Prepare prompt with task context
            const prompt = new PromptBuilder()
                .add("execute-task-prompt", {
                    instruction: options.prompt,
                })
                .build();

            // 3. Execute Claude Code with full task tracking
            const { task, result } = await this.taskPublisher.executeWithTask({
                prompt,
                projectPath: process.cwd(),
                title: this.generateTaskTitle(options.prompt),
                branch,
                // No conversationRootEventId for standalone execution
            });

            return {
                success: result.success,
                task,
                sessionId: result.sessionId,
                totalCost: result.totalCost,
                messageCount: result.messageCount,
                duration: Date.now() - startTime,
                error: result.error,
                branch,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            logger.error("Task execution failed", { error: errorMessage });
            throw new Error(errorMessage);
        }
    }

    /**
     * Generate a concise task title from the prompt
     */
    private generateTaskTitle(prompt: string): string {
        // Take first sentence or line, truncate to reasonable length
        const firstLine = prompt.split(/[\n.!?]/)[0]?.trim() || prompt.trim();
        return firstLine.length > 60 ? `${firstLine.substring(0, 57)}...` : firstLine;
    }
}

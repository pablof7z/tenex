import { ExecutionService } from "./ExecutionService";
import { TaskPublisher, getNDK } from "@/nostr";
import { PromptBuilder } from "@/prompts";
import type { NDKTask } from "@nostr-dev-kit/ndk";
import type { ClaudeCodeMessage } from "@/utils/claude/ClaudeParser";
import { logger } from "@/utils/logger";

export interface TaskExecutionOptions {
  prompt: string;
  createBranch?: boolean;
  timeout?: number;
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
    let task: NDKTask | null = null;
    let branch: string | undefined;

    try {
      // 1. Create git branch if requested
      if (options.createBranch !== false) {
        const branchResult = ExecutionService.createExecutionBranch(
          options.prompt.substring(0, 30)
        );
        if (branchResult.created) {
          branch = branchResult.branchName;
        }
      }

      // 2. Create and publish NDKTask
      task = await this.taskPublisher.createTask({
        title: this.generateTaskTitle(options.prompt),
        prompt: options.prompt,
        branch,
      });

      // 3. Update task status to in-progress
      await this.taskPublisher.updateTask(task, {
        status: "in-progress",
        progress: 0,
        message: "Starting Claude Code execution...",
      });

      // 4. Prepare prompt with task context
      const prompt = new PromptBuilder()
        .add("execute-task-prompt", { 
          instruction: options.prompt,
          taskId: task.id,
        })
        .build();

      // 5. Execute Claude Code with Nostr publishing callbacks
      const result = await ExecutionService.executeClaudeCode({
        prompt,
        projectPath: process.cwd(),
        timeout: options.timeout || 600000, // Default 10 minutes for tasks
        onMessage: async (message: ClaudeCodeMessage) => {
          // Publish Claude messages to Nostr
          if (task) {
            await this.taskPublisher.publishClaudeMessage(task, message);
            
            // Log progress
            if (message.type === "assistant") {
              logger.info("Task execution progress", {
                taskId: task.id,
                messageId: message.message?.id,
                sessionId: message.session_id,
              });
            }
          }
        },
        onError: (error: Error) => {
          if (task) {
            logger.error("Task execution error", { 
              taskId: task.id, 
              error: error.message,
            });
          }
        },
        onComplete: async (claudeResult) => {
          if (task) {
            logger.info("Claude Code execution completed for task", {
              taskId: task.id,
              sessionId: claudeResult.sessionId,
              totalCost: claudeResult.totalCost,
              duration: claudeResult.duration,
            });
          }
        },
      });

      // 6. Mark task as completed
      await this.taskPublisher.completeTask(task, result.success, result);

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

      // Mark task as failed if it was created
      if (task) {
        await this.taskPublisher.completeTask(task, false, {
          error: errorMessage,
          duration: Date.now() - startTime,
        });
      }

      // If no task was created, throw the error
      if (!task) {
        throw new Error(errorMessage);
      }

      return {
        success: false,
        task,
        error: errorMessage,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Generate a concise task title from the prompt
   */
  private generateTaskTitle(prompt: string): string {
    // Take first sentence or line, truncate to reasonable length
    const firstLine = prompt.split(/[\n.!?]/)[0]?.trim() || prompt.trim();
    return firstLine.length > 60 
      ? firstLine.substring(0, 57) + "..." 
      : firstLine;
  }
}
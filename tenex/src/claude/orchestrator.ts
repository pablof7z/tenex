import { startExecutionTime, stopExecutionTime } from "@/conversations/executionTime";
import type { Conversation } from "@/conversations/types";
import type { TaskPublisher } from "@/nostr/TaskPublisher";
import { logger } from "@/utils/logger";
import type { ContentBlock, TextBlock } from "@anthropic-ai/sdk/resources/messages/messages";
import type { NDKTask } from "@nostr-dev-kit/ndk";
import { ClaudeCodeExecutor } from "./executor";

export interface ClaudeTaskOptions {
  prompt: string;
  systemPrompt?: string;
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
  finalResponse?: string;
}

/**
 * Orchestrates Claude Code execution with Nostr task tracking
 * Single Responsibility: Coordinate Claude SDK execution with task lifecycle and Nostr publishing
 */
export class ClaudeTaskOrchestrator {
  constructor(private taskPublisher: TaskPublisher) {}

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
      systemPrompt: options.systemPrompt,
      projectPath: options.projectPath,
      abortSignal: options.abortSignal,
    });

    try {
      // Start execution timing
      if (options.conversation) {
        startExecutionTime(options.conversation);
      }

      // Track the last assistant message for final response
      let lastAssistantMessage: string = "";

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

          console.log("completing task", executionResult);

          // Complete task
          await this.taskPublisher.completeTask(executionResult.success, {
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
            finalResponse: lastAssistantMessage,
          };
          break;
        }

        // Process SDK message and publish progress updates
        if (message && message.type === "assistant" && message.message?.content) {
          const textContent = message.message.content
            .filter((c: ContentBlock): c is TextBlock => c.type === "text")
            .map((c: TextBlock) => c.text)
            .join("");

          if (textContent) {
            lastAssistantMessage = textContent;

            // Publish progress update using TaskPublisher
            await this.taskPublisher.publishTaskProgress(textContent);
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
      await this.taskPublisher.completeTask(false, { error: errorMessage });

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
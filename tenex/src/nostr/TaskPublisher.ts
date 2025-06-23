import { getProjectContext } from "@/services";
import type NDK from "@nostr-dev-kit/ndk";
import { NDKTask, NDKEvent } from "@nostr-dev-kit/ndk";
import type { ClaudeCodeMessage } from "@/utils/claude/ClaudeParser";
import { logger } from "@/utils/logger";

export interface TaskCreationOptions {
  title: string;
  prompt: string;
  branch?: string;
}

export interface TaskUpdateOptions {
  status?: "pending" | "in-progress" | "completed" | "failed";
  progress?: number;
  message?: string;
  cost?: number;
  sessionId?: string;
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
    task.content = `Executing: ${options.prompt}`;
    
    // Tag the project
    task.tag(projectCtx.project);
    
    // Add execution metadata
    if (options.branch) {
      task.tags.push(["branch", options.branch]);
    }
    task.tags.push(["prompt", options.prompt]);
    task.tags.push(["executor", "claude-code"]);

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
    const updateEvent = new NDKEvent(this.ndk);
    updateEvent.kind = 1; // Regular text note
    
    // Reference the task
    updateEvent.tags.push(["e", task.id]);
    updateEvent.tags.push(["a", task.tagAddress()]);
    
    // Tag the project
    const projectCtx = getProjectContext();
    updateEvent.tag(projectCtx.project);

    // Add status tags
    if (update.status) {
      updateEvent.tags.push(["status", update.status]);
    }
    if (update.progress !== undefined) {
      updateEvent.tags.push(["progress", update.progress.toString()]);
    }
    if (update.cost !== undefined) {
      updateEvent.tags.push(["cost-usd", update.cost.toString()]);
    }
    if (update.sessionId) {
      updateEvent.tags.push(["session-id", update.sessionId]);
    }

    // Set content
    updateEvent.content = update.message || `Task update: ${update.status || 'in-progress'}`;

    // Sign and publish
    await updateEvent.sign(projectCtx.signer);
    await updateEvent.publish();

    logger.debug("Published task update", {
      taskId: task.id,
      updateId: updateEvent.id,
      status: update.status,
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

    const updateEvent = new NDKEvent(this.ndk);
    updateEvent.kind = 1;
    
    // Reference the task
    updateEvent.tags.push(["e", task.id]);
    updateEvent.tags.push(["a", task.tagAddress()]);
    
    // Tag the project
    const projectCtx = getProjectContext();
    updateEvent.tag(projectCtx.project);

    // Add message metadata
    updateEvent.tags.push(["claude-message-type", message.type]);
    if (message.message?.id) {
      updateEvent.tags.push(["claude-message-id", message.message.id]);
    }
    if (message.session_id) {
      updateEvent.tags.push(["claude-session-id", message.session_id]);
    }
    if (message.message?.model) {
      updateEvent.tags.push(["claude-model", message.message.model]);
    }
    if (message.message?.usage) {
      const totalTokens = message.message.usage.input_tokens + message.message.usage.output_tokens;
      updateEvent.tags.push(["claude-tokens", totalTokens.toString()]);
    }

    // Set content based on message type
    if (message.type === "assistant" && message.message?.content?.[0]?.text) {
      updateEvent.content = message.message.content[0].text;
    } else {
      return; // Skip if no text content
    }

    // Sign and publish
    await updateEvent.sign(projectCtx.signer);
    await updateEvent.publish();

    logger.debug("Published Claude message as task update", {
      taskId: task.id,
      messageType: message.type,
      messageId: message.message_id,
    });
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
}
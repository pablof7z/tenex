import { getProjectContext } from "@/services";
import type NDK from "@nostr-dev-kit/ndk";
import { NDKTask, NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@/utils/logger";

export interface TaskCreationOptions {
    title: string;
    prompt: string;
    branch?: string;
    conversationRootEventId?: string;
}

export interface TaskCompletionOptions {
    sessionId?: string;
    totalCost?: number;
    messageCount?: number;
    duration?: number;
    error?: string;
}

/**
 * Publishes NDKTask events to Nostr
 * Single Responsibility: Create and update task events on Nostr
 */
export class TaskPublisher {
    constructor(private ndk: NDK) {}

    async createTask(options: TaskCreationOptions): Promise<NDKTask> {
        const projectCtx = getProjectContext();

        const task = new NDKTask(this.ndk);
        task.title = options.title;
        task.content = options.prompt;
        
        // Tag the project
        task.tag(projectCtx.project);

        // Add branch tag if provided
        if (options.branch) {
            task.tags.push(["branch", options.branch]);
        }

        // Link to conversation if provided
        if (options.conversationRootEventId) {
            task.tags.push(["e", options.conversationRootEventId, "", "reply"]);
        }

        // Add tool and status tags
        task.tags.push(
            ["tool", "claude_code"],
            ["status", "pending"]
        );

        await task.publish();
        logger.info("Published task", { taskId: task.id, title: task.title });
        
        return task;
    }

    async publishTaskUpdate(task: NDKTask, event: any): Promise<void> {
        // Create reply event to the task
        const reply = new NDKEvent(this.ndk);
        reply.kind = event.kind || 1;
        reply.content = event.content || '';
        reply.tags = [
            ["e", task.id, "", "reply"],
            ...event.tags
        ];

        await reply.publish();
    }

    async completeTask(task: NDKTask, success: boolean, options: TaskCompletionOptions): Promise<void> {
        // Update task status
        task.tags = task.tags.filter(tag => tag[0] !== "status");
        task.tags.push(["status", success ? "completed" : "failed"]);

        // Add completion metadata
        if (options.sessionId) {
            task.tags.push(["claude-session", options.sessionId]);
        }
        if (options.totalCost !== undefined) {
            task.tags.push(["cost", options.totalCost.toString()]);
        }
        if (options.duration !== undefined) {
            task.tags.push(["duration", options.duration.toString()]);
        }
        if (options.error) {
            task.tags.push(["error", options.error]);
        }

        await task.publish();
        logger.info("Task completed", {
            taskId: task.id,
            success,
            sessionId: options.sessionId,
            cost: options.totalCost,
            duration: options.duration,
        });
    }
}
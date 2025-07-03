import { z } from "zod";
import { TaskPublisher } from "@/nostr/TaskPublisher";
import { ClaudeTaskOrchestrator } from "@/tools/claude/ClaudeTaskOrchestrator";
import { getNDK } from "@/nostr/ndkClient";
import type { Tool, ToolExecutionContext, ToolResult } from "../types";
import { parseToolParams } from "../utils";

const ClaudeCodeArgsSchema = z.object({
    prompt: z.string().min(1, "prompt must be a non-empty string"),
    mode: z.enum(["run", "plan"]).optional(),
});

export const claudeCodeTool: Tool = {
    name: "claude_code",
    description: "Use Claude Code to perform complex coding tasks",
    parameters: [
        {
            name: "prompt",
            type: "string",
            description: "The task or coding request for Claude Code to perform",
            required: true,
        },
        {
            name: "mode",
            type: "string",
            description:
                'Execution mode: "run" (default) executes immediately, "plan" creates a plan without executing',
            required: false,
            enum: ["run", "plan"],
        },
    ],

    async execute(
        params: Record<string, unknown>,
        context: ToolExecutionContext
    ): Promise<ToolResult> {
        try {
            const parseResult = parseToolParams(ClaudeCodeArgsSchema, params);
            if (!parseResult.success) {
                return parseResult.errorResult;
            }

            const { prompt, mode = "run" } = parseResult.data;

            // Create instances
            const ndk = getNDK();
            const taskPublisher = new TaskPublisher(ndk, context.agent);
            const orchestrator = new ClaudeTaskOrchestrator(taskPublisher);

            // Get conversation metadata
            const branch = context.conversation?.metadata?.branch;
            const conversationRootEventId = context.conversation?.history[0]?.id;

            // Execute
            const result = await orchestrator.execute({
                prompt,
                projectPath: context.projectPath,
                title: `Claude Code ${mode === "plan" ? "Planning" : "Execution"} (via ${context.agent.name})`,
                branch,
                conversationRootEventId,
                conversation: context.conversation,
            });

            // Convert result
            if (result.success) {
                return {
                    success: true,
                    output: "Claude Code execution completed",
                    metadata: {
                        sessionId: result.sessionId,
                        totalCost: result.totalCost,
                        messageCount: result.messageCount,
                        duration: result.duration,
                        taskId: result.task.id,
                    },
                };
            }
            
            return {
                success: false,
                error: result.error || "Claude Code execution failed",
                metadata: {
                    sessionId: result.sessionId,
                    taskId: result.task.id,
                },
            };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            return { success: false, error: message };
        }
    },
};
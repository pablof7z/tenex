import { TaskPublisher } from "@/nostr/TaskPublisher";
import { getNDK } from "@/nostr/ndkClient";
import { ClaudeTaskOrchestrator } from "@/tools/claude/ClaudeTaskOrchestrator";
import { z } from "zod";
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

      // Enhance prompt for run mode to request comprehensive report
      const enhancedPrompt = mode === "run" 
        ? `${prompt}\n\nIMPORTANT: When you complete this task, provide a comprehensive report of everything you accomplished, including:\n- What files were created or modified\n- What functionality was implemented\n- Any key decisions made\n- The current state of the implementation`
        : prompt;

      // Execute
      const result = await orchestrator.execute({
        prompt: enhancedPrompt,
        projectPath: context.projectPath,
        title: `Claude Code ${mode === "plan" ? "Planning" : "Execution"} (via ${context.agent.name})`,
        branch,
        conversationRootEventId,
        conversation: context.conversation,
      });

      // Convert result
      if (result.success) {
        // For now, we'll return a success message with the task details
        // The actual Claude Code output is published via Nostr task updates
        const output = `Claude Code ${mode === "plan" ? "planning" : "execution"} completed successfully. Task ID: ${result.task.id}`;
        
        return {
          success: true,
          output,
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

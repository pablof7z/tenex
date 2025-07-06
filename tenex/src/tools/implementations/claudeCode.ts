import { TaskPublisher } from "@/nostr/TaskPublisher";
import { getNDK } from "@/nostr/ndkClient";
import { ClaudeTaskOrchestrator } from "@/tools/claude/ClaudeTaskOrchestrator";
import { z } from "zod";
import type { Tool } from "../types";
import { createZodSchema } from "../types";

const ClaudeCodeArgsSchema = z.object({
  prompt: z.string().min(1, "prompt must be a non-empty string"),
  mode: z.enum(["run", "plan"]).optional(),
});

interface ClaudeCodeInput {
  prompt: string;
  mode?: "run" | "plan";
}

interface ClaudeCodeOutput {
  message: string;
  sessionId: string | undefined;
  totalCost: number;
  messageCount: number;
  duration: number;
  taskId: string;
}

export const claudeCodeTool: Tool<ClaudeCodeInput, ClaudeCodeOutput> = {
  name: "claude_code",
  description: "Use Claude Code to perform complex coding tasks. The 'mode' parameter accepts either 'run' (for executing/implementing tasks) or 'plan' (for planning tasks). Use 'run' mode to execute implementations, and 'plan' mode when you need to plan before implementation.",

  parameters: createZodSchema(ClaudeCodeArgsSchema),

  execute: async (input, context) => {
      const { prompt, mode = "run" } = input.value;

      // Create instances
      const ndk = getNDK();
      const agent = context.agent;
      const taskPublisher = new TaskPublisher(ndk, agent);
      const orchestrator = new ClaudeTaskOrchestrator(taskPublisher);

      // Get conversation metadata
      const branch = undefined;
      const conversationRootEventId = context.conversation.id;

      // Enhance prompt for run mode to request comprehensive report
      const enhancedPrompt =
        mode === "run"
          ? `${prompt}\n\nIMPORTANT: When you complete this task, provide a comprehensive report of everything you accomplished, including:\n- What files were created or modified\n- What functionality was implemented\n- Any key decisions made\n- The current state of the implementation`
          : prompt;

      try {
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
          const message = `Claude Code ${mode === "plan" ? "planning" : "execution"} completed successfully. Task ID: ${result.task.id}`;

          return {
            ok: true,
            value: {
              message,
              sessionId: result.sessionId,
              totalCost: result.totalCost,
              messageCount: result.messageCount,
              duration: result.duration,
              taskId: result.task.id,
            },
          };
        }

        return {
          ok: false,
          error: {
            kind: "execution" as const,
            tool: "claude_code",
            message: result.error || "Claude Code execution failed",
            cause: {
              sessionId: result.sessionId,
              taskId: result.task.id,
            },
          },
        };
      } catch (error) {
        return {
          ok: false,
          error: {
            kind: "execution" as const,
            tool: "claude_code",
            message: error instanceof Error ? error.message : String(error),
            cause: error,
          },
        };
      }
  },
};

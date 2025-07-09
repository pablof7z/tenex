import { TaskPublisher } from "@/nostr/TaskPublisher";
import { getNDK } from "@/nostr/ndkClient";
import { ClaudeTaskOrchestrator } from "@/tools/claude/ClaudeTaskOrchestrator";
import { z } from "zod";
import type { Tool } from "../types";
import { createZodSchema } from "../types";

const ClaudeCodeArgsSchema = z.object({
  prompt: z.string().min(1, "prompt must be a non-empty string"),
  systemPrompt: z.string().optional(),
});

interface ClaudeCodeInput {
  prompt: string;
  systemPrompt?: string;
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
  description: "Use Claude Code to perform complex coding tasks.",

  parameters: createZodSchema(ClaudeCodeArgsSchema),

  execute: async (input, context) => {
      const { prompt, systemPrompt } = input.value;

      // Create instances
      const ndk = getNDK();
      const agent = context.agent;
      const taskPublisher = new TaskPublisher(ndk, agent);
      const orchestrator = new ClaudeTaskOrchestrator(taskPublisher);

      // Get conversation metadata
      const branch = undefined;
      const conversationRootEventId = context.conversation.id;

      // Enhance prompt to request comprehensive report
      const enhancedPrompt = `${prompt}\n\nIMPORTANT: When you complete this task, provide a comprehensive report of everything you accomplished, including:\n- What files were created or modified\n- What functionality was implemented\n- Any key decisions made\n- The current state of the implementation`;

      try {
        // Execute
        const result = await orchestrator.execute({
          prompt: enhancedPrompt,
          systemPrompt,
          projectPath: context.projectPath,
          title: `Claude Code Execution (via ${context.agent.name})`,
          branch,
          conversationRootEventId,
          conversation: context.conversation,
        });

        // Convert result
        if (result.success) {
          const message = `Claude Code execution completed successfully. Task ID: ${result.task.id}`;

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

import { TaskPublisher } from "@/nostr/TaskPublisher";
import { getNDK } from "@/nostr/ndkClient";
import { ClaudeTaskOrchestrator } from "@/tools/claude/ClaudeTaskOrchestrator";
import { z } from "zod";
import type { EffectTool } from "../types";
import { createZodSchema, suspend } from "../types";

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

export const claudeCodeTool: EffectTool<ClaudeCodeInput, ClaudeCodeOutput> = {
  brand: { _brand: "effect" },
  name: "claude_code",
  description: "Use Claude Code to perform complex coding tasks",
  
  parameters: createZodSchema(ClaudeCodeArgsSchema),

  execute: (input, context) => suspend(async () => {
    const { prompt, mode = "run" } = input.value;

    // Create instances
    const ndk = getNDK();
    const agent = context.agent || { 
      name: context.agentName,
      pubkey: context.agentId,
      role: "Agent",
      signer: context.agentSigner!,
      llmConfig: "default",
      tools: [],
      slug: context.agentName.toLowerCase(),
    };
    const taskPublisher = new TaskPublisher(ndk, agent);
    const orchestrator = new ClaudeTaskOrchestrator(taskPublisher);

    // Get conversation metadata
    // TODO: Need to get conversation from context
    const branch = undefined;
    const conversationRootEventId = context.conversationId;

    // Enhance prompt for run mode to request comprehensive report
    const enhancedPrompt = mode === "run" 
      ? `${prompt}\n\nIMPORTANT: When you complete this task, provide a comprehensive report of everything you accomplished, including:\n- What files were created or modified\n- What functionality was implemented\n- Any key decisions made\n- The current state of the implementation`
      : prompt;

    try {
      // Execute
      const result = await orchestrator.execute({
        prompt: enhancedPrompt,
        projectPath: context.projectPath,
        title: `Claude Code ${mode === "plan" ? "Planning" : "Execution"} (via ${context.agentName})`,
        branch,
        conversationRootEventId,
        conversation: undefined, // TODO: Need to get conversation from context
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
  }),
};
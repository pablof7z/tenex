import type { ToolExecutor, ToolInvocation, ToolExecutionContext, ToolExecutionResult } from "@/tools/types";
import { logger } from "@/utils/logger";
import { configService } from "@/services";

export class PhaseTransitionExecutor implements ToolExecutor {
  name = "phase_transition";

  canExecute(toolName: string): boolean {
    return toolName === "phase_transition";
  }

  async execute(
    invocation: ToolInvocation,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      // Only the boss agent can perform phase transitions
      // Load agent registry to check boss flag
      const agentsConfig = await configService.loadProjectAgents(context.projectPath);
      const agentEntry = agentsConfig[context.agentName];
      
      if (!agentEntry?.boss) {
        return {
          success: false,
          error: "Only the boss agent can perform phase transitions",
          duration: Date.now() - startTime,
        };
      }

      const params = invocation.parameters as Record<string, string | number | boolean>;
      const phase = params.phase as string;
      const reason = params.reason as string | undefined;
      
      if (!phase) {
        return {
          success: false,
          error: "Phase parameter is required",
          duration: Date.now() - startTime,
        };
      }

      // Validate phase
      const validPhases = ["chat", "plan", "execute", "review", "chores"];
      if (!validPhases.includes(phase)) {
        return {
          success: false,
          error: `Invalid phase: ${phase}. Valid phases are: ${validPhases.join(", ")}`,
          duration: Date.now() - startTime,
        };
      }

      // Validate phase transition is allowed
      const validTransitions: Record<string, string[]> = {
        chat: ["plan"],
        plan: ["execute", "chat"],
        execute: ["review", "plan"],
        review: ["execute", "chat", "chores"],
        chores: ["chat"],
      };

      const currentPhase = context.phase;
      if (!validTransitions[currentPhase]?.includes(phase)) {
        return {
          success: false,
          error: `Cannot transition from ${currentPhase} to ${phase}. Valid transitions: ${validTransitions[currentPhase]?.join(", ") || "none"}`,
          duration: Date.now() - startTime,
        };
      }

      // The actual phase transition will be handled by the routing system
      // when it sees the phase tag in the published event
      logger.info("Phase transition requested", {
        fromPhase: currentPhase,
        toPhase: phase,
        agentName: context.agentName,
        reason,
      });

      return {
        success: true,
        output: `Phase transition to '${phase}' requested${reason ? `: ${reason}` : ''}`,
        duration: Date.now() - startTime,
        metadata: {
          requestedPhase: phase,
          currentPhase: context.phase,
          reason,
        },
      };
    } catch (error) {
      logger.error("Phase transition execution failed", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }
}
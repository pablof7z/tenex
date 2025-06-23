import type { Conversation } from "@/conversations/types";
import { getProjectContext } from "@/services";
import { ExecutionService } from "@/services/ExecutionService";
import type { Agent } from "@/agents/types";
import type { Phase } from "@/conversations/types";
import { logger } from "@/utils/logger";
import { PromptBuilder } from "@/prompts";
import type { PhaseInitializationResult, PhaseInitializer } from "./types";
import { handlePhaseError } from "./utils";

/**
 * Execute Phase Initializer
 *
 * In the execute phase, we create a new git branch and trigger
 * Claude Code CLI to implement the plan.
 */
export class ExecutePhaseInitializer implements PhaseInitializer {
  phase: Phase = "execute";

  async initialize(
    conversation: Conversation,
    availableAgents: Agent[]
  ): Promise<PhaseInitializationResult> {
    logger.info("[EXECUTE Phase] Initializing execute phase", {
      conversationId: conversation.id,
      title: conversation.title,
      previousPhase: "plan",
    });

    try {
      const projectCtx = getProjectContext();
      const project = projectCtx.project;

      // Find an agent suitable for execution
      const executionAgent =
        availableAgents.find((agent) => agent.role.toLowerCase().includes("developer")) ||
        availableAgents.find((agent) =>
          ["implementation", "coding", "development"].some((keyword) =>
            agent.role.toLowerCase().includes(keyword.toLowerCase())
          )
        ) ||
        availableAgents[0]; // Fallback to first available agent

      if (!executionAgent) {
        return {
          success: false,
          message: "No suitable agent found for execution phase",
        };
      }

      // Create a new git branch for this execution
      const branchResult = ExecutionService.createExecutionBranch(conversation.title);
      const branchName = branchResult.branchName;

      // Get the plan from previous phase
      const planSummary = conversation.metadata.plan_summary;
      const plan = typeof planSummary === 'string' ? planSummary : "Implement the features as discussed";

      // Trigger Claude Code CLI for implementation
      const claudeCodeTriggered = await this.triggerClaudeCode(
        conversation,
        plan || "Implement the features as discussed",
        "Implement the plan. Make all necessary code changes."
      );

      // Include any metadata that was set during triggerClaudeCode
      const metadata: Record<string, unknown> = {
        claudeCodeTriggered,
        gitBranch: branchName,
        assignedAgent: executionAgent.name,
        agentPubkey: executionAgent.pubkey,
        phase: "execute",
        plan,
      };
      
      // Add execution-specific metadata if it was generated
      if (conversation.metadata.execute_summary) {
        metadata.execute_summary = conversation.metadata.execute_summary;
        metadata.execute_sessionId = conversation.metadata.execute_sessionId;
        metadata.execute_cost = conversation.metadata.execute_cost;
        metadata.implementation_complete = conversation.metadata.implementation_complete;
      }
      
      return {
        success: true,
        message: `Execute phase initialized. Branch '${branchName}' created. Claude Code CLI triggered.`,
        nextAgent: executionAgent.pubkey,
        metadata,
      };
    } catch (error) {
      return handlePhaseError("Execute", error);
    }
  }


  private async triggerClaudeCode(
    conversation: Conversation,
    plan: string,
    instruction: string
  ): Promise<boolean> {
    const projectPath = process.cwd();

    // Prepare the prompt for Claude Code
    const prompt = new PromptBuilder()
      .add("execute-phase-prompt", { plan, instruction })
      .build();

    logger.info("[EXECUTE Phase] Triggering Claude Code CLI for execution", {
      conversationId: conversation.id,
      prompt: prompt,
    });

    const result = await ExecutionService.executeClaudeCode({
      prompt,
      projectPath,
      timeout: 300000, // 5 minutes
      onMessage: async (message) => {
        // Log important messages
        if (message.type === "assistant") {
          logger.debug("[EXECUTE Phase] Claude assistant message", {
            messageId: message.message_id,
            sessionId: message.session_id,
          });
        }
      },
      onError: (error) => {
        logger.error("[EXECUTE Phase] Claude Code execution error", { error });
      },
      onComplete: (result) => {
        logger.info("[EXECUTE Phase] Claude Code execution completed", {
          sessionId: result.sessionId,
          totalCost: result.totalCost,
          messageCount: result.messageCount,
          duration: result.duration,
        });
      },
    });

    if (result.success) {
      // Store session ID in conversation metadata for tracking
      if (result.sessionId) {
        conversation.metadata.executeSessionId = result.sessionId;
      }
      
      // Store execution metadata to be saved by the router
      if (result.assistantMessages && result.assistantMessages.length > 0) {
        const executionSummary = result.assistantMessages.join("\n\n");
        
        // Store execution in conversation metadata for later saving
        conversation.metadata.execute_summary = executionSummary;
        conversation.metadata.execute_sessionId = result.sessionId;
        conversation.metadata.execute_cost = result.totalCost;
        conversation.metadata.implementation_complete = true;
        
        logger.info("[EXECUTE Phase] Prepared execution metadata", {
          conversationId: conversation.id,
          summaryLength: executionSummary.length,
          messageCount: result.assistantMessages.length
        });
      }
    }

    return result.success;
  }
}

import { execSync } from "node:child_process";
import path from "node:path";
import type { ConversationState } from "@/conversations/types";
import { getProjectContext } from "@/runtime";
import { ClaudeCodeExecutor } from "@/tools/claude/ClaudeCodeExecutor";
import type { Agent } from "@/types/agent";
import type { Phase } from "@/types/conversation";
import type NDK from "@nostr-dev-kit/ndk";
import type { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared";
import type { PhaseInitializationResult, PhaseInitializer } from "./types";

/**
 * Execute Phase Initializer
 *
 * In the execute phase, we create a new git branch and trigger
 * Claude Code CLI to implement the plan.
 */
export class ExecutePhaseInitializer implements PhaseInitializer {
  phase: Phase = "execute";

  async initialize(
    conversation: ConversationState,
    availableAgents: Agent[]
  ): Promise<PhaseInitializationResult> {
    logger.info("[EXECUTE Phase] Initializing execute phase", {
      conversationId: conversation.id,
      title: conversation.title,
      previousPhase: "plan",
    });

    try {
      const projectContext = getProjectContext();

      // Find an agent suitable for execution
      const executionAgent =
        availableAgents.find((agent) => agent.role.toLowerCase().includes("developer")) ||
        availableAgents.find((agent) =>
          ["implementation", "coding", "development"].some((keyword) =>
            agent.expertise.toLowerCase().includes(keyword.toLowerCase())
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
      const branchName = await this.createExecutionBranch(conversation);

      // Get the plan from previous phase
      const plan = conversation.metadata.plan_summary || "Implement the features as discussed";

      // Trigger Claude Code CLI for implementation
      const claudeCodeTriggered = await this.triggerClaudeCode(
        conversation,
        plan || "Implement the features as discussed",
        "Implement the plan. Make all necessary code changes."
      );

      return {
        success: true,
        message: `Execute phase initialized. Branch '${branchName}' created. Claude Code CLI triggered.`,
        nextAgent: executionAgent.pubkey,
        metadata: {
          claudeCodeTriggered,
          gitBranch: branchName,
          assignedAgent: executionAgent.name,
          agentPubkey: executionAgent.pubkey,
          phase: "execute",
          plan,
        },
      };
    } catch (error) {
      logger.error("[EXECUTE Phase] Failed to initialize execute phase", { error });
      return {
        success: false,
        message: `Execute phase initialization failed: ${error}`,
      };
    }
  }

  private async createExecutionBranch(conversation: ConversationState): Promise<string> {
    try {
      const projectContext = getProjectContext();
      const projectPath = projectContext.projectPath;

      // Generate branch name from conversation
      const baseName = conversation.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .substring(0, 30);

      const timestamp = Date.now();
      const branchName = `tenex/${baseName}-${timestamp}`;

      // Check if we're in a git repository
      try {
        execSync("git status", {
          cwd: projectPath,
          stdio: "ignore",
        });
      } catch {
        logger.info("[EXECUTE Phase] Not a git repository, skipping branch creation");
        return "no-git";
      }

      // Create and checkout new branch
      execSync(`git checkout -b ${branchName}`, {
        cwd: projectPath,
        stdio: "pipe",
      });

      logger.info("[EXECUTE Phase] Created execution branch", { branchName });
      return branchName;
    } catch (error) {
      logger.error("[EXECUTE Phase] Failed to create git branch", { error });
      // Continue without branch if git operations fail
      return "main";
    }
  }

  private async triggerClaudeCode(
    conversation: ConversationState,
    plan: string,
    instruction: string
  ): Promise<boolean> {
    try {
      const projectContext = getProjectContext();

      // Prepare the prompt for Claude Code
      const prompt = `Current Plan:\n${plan}\n\nInstruction: ${instruction}`;

      logger.info("[EXECUTE Phase] Triggering Claude Code CLI for execution", {
        conversationId: conversation.id,
        promptLength: prompt.length,
      });

      // Create executor with proper separation of concerns
      const executor = new ClaudeCodeExecutor({
        prompt,
        projectPath: projectContext.projectPath,
        timeout: 300000, // 5 minutes
        onMessage: async (message) => {
          // Log important messages
          if (message.type === "assistant") {
            logger.debug("[EXECUTE Phase] Claude assistant message", {
              messageId: message.message_id,
              sessionId: message.session_id,
            });
          }
          
          // The phase initializer can decide to publish to Nostr if needed
          // But for now, we just log the messages
          if (message.type === "error") {
            logger.error("[EXECUTE Phase] Claude error message", { message });
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

      const result = await executor.execute();
      
      if (result.success) {
        // Store session ID in conversation metadata for tracking
        if (result.sessionId) {
          conversation.metadata.executeSessionId = result.sessionId;
        }
      }

      return result.success;
    } catch (error) {
      logger.error("[EXECUTE Phase] Error triggering Claude Code", { error });
      return false;
    }
  }
}

import { execSync } from "node:child_process";
import path from "node:path";
import type { ConversationState } from "@/conversations/types";
import { getProjectContext } from "@/runtime";
import { ClaudeCodeExecutor } from "@/tools";
import type { Agent } from "@/types/agent";
import type { Phase } from "@/types/conversation";
import type NDK from "@nostr-dev-kit/ndk";
import type { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { BasePhaseInitializer } from "./PhaseInitializer";
import type { PhaseInitializationResult } from "./types";

/**
 * Execute Phase Initializer
 *
 * In the execute phase, we create a new git branch and trigger
 * Claude Code CLI to implement the plan.
 */
export class ExecutePhaseInitializer extends BasePhaseInitializer {
  phase: Phase = "execute";

  async initialize(
    conversation: ConversationState,
    availableAgents: Agent[]
  ): Promise<PhaseInitializationResult> {
    this.log("Initializing execute phase", {
      conversationId: conversation.id,
      title: conversation.title,
      previousPhase: "plan",
    });

    try {
      const projectContext = getProjectContext();

      // Find an agent suitable for execution
      const executionAgent =
        this.findAgentByRole(availableAgents, "developer") ||
        this.findAgentByExpertise(availableAgents, ["implementation", "coding", "development"]) ||
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
      this.logError("Failed to initialize execute phase", error);
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
        this.log("Not a git repository, skipping branch creation");
        return "no-git";
      }

      // Create and checkout new branch
      execSync(`git checkout -b ${branchName}`, {
        cwd: projectPath,
        stdio: "pipe",
      });

      this.log("Created execution branch", { branchName });
      return branchName;
    } catch (error) {
      this.logError("Failed to create git branch", error);
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

      // Get signer from project context and NDK from global
      const { getNDK } = await import("@/nostr/ndkClient");
      const ndk = getNDK();
      const signer = projectContext.projectSigner;

      // Get the root event from the conversation
      const rootEvent = conversation.history[0];
      if (!rootEvent) {
        this.logError("No root event found in conversation", new Error("Missing root event"));
        return false;
      }

      // Prepare the prompt for Claude Code
      const prompt = `Current Plan:\n${plan}\n\nInstruction: ${instruction}`;

      this.log("Triggering Claude Code CLI for execution with monitoring", {
        conversationId: conversation.id,
        promptLength: prompt.length,
      });

      // Create and execute Claude Code with monitoring
      const executor = new ClaudeCodeExecutor({
        prompt,
        projectPath: projectContext.projectPath,
        ndk,
        projectContext,
        conversationRootEvent: rootEvent,
        signer,
        title: "Execute Implementation",
        phase: "execute",
      });

      const result = await executor.execute();

      if (result.success) {
        this.log("Claude Code execution completed successfully", {
          sessionId: result.sessionId,
          taskId: result.taskEvent?.id,
          totalCost: result.totalCost,
          messageCount: result.messageCount,
        });

        // Store task ID in conversation metadata for tracking
        if (result.taskEvent) {
          conversation.metadata.executeTaskId = result.taskEvent.id;
        }
      } else {
        this.logError("Claude Code execution failed", result.error);
      }

      return result.success;
    } catch (error) {
      this.logError("Error triggering Claude Code", error);
      return false;
    }
  }
}

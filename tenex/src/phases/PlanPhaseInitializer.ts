import type { Agent } from "@/types/agent";
import type { ConversationState } from "@/conversations/types";
import { getProjectContext } from "@/runtime";
import { ClaudeCodeExecutor } from "@/tools";
import type { Phase } from "@/types/conversation";
import type NDK from "@nostr-dev-kit/ndk";
import type { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { BasePhaseInitializer } from "./PhaseInitializer";
import type { PhaseInitializationResult } from "./types";

/**
 * Plan Phase Initializer
 *
 * In the plan phase, we trigger Claude Code CLI with the conversation
 * context to create a detailed implementation plan.
 */
export class PlanPhaseInitializer extends BasePhaseInitializer {
  phase: Phase = "plan";

  async initialize(
    conversation: ConversationState,
    availableAgents: Agent[]
  ): Promise<PhaseInitializationResult> {
    this.log("Initializing plan phase", {
      conversationId: conversation.id,
      title: conversation.title,
      previousPhase: "chat",
    });

    try {
      const projectContext = getProjectContext();

      // Find an agent suitable for planning
      const planningAgent =
        this.findAgentByRole(availableAgents, "architect") ||
        this.findAgentByExpertise(availableAgents, ["planning", "design", "architecture"]) ||
        availableAgents[0]; // Fallback to first available agent

      if (!planningAgent) {
        return {
          success: false,
          message: "No suitable agent found for planning phase",
        };
      }

      // Prepare context from chat phase
      const chatSummary =
        conversation.metadata.chat_summary ||
        conversation.metadata.summary ||
        "User wants to build a software project";

      // Trigger Claude Code CLI
      const claudeCodeTriggered = await this.triggerClaudeCode(
        conversation,
        chatSummary,
        "Create a detailed implementation plan based on the requirements discussed."
      );

      return {
        success: true,
        message: "Plan phase initialized. Claude Code CLI triggered for planning.",
        nextAgent: planningAgent.pubkey,
        metadata: {
          claudeCodeTriggered,
          assignedAgent: planningAgent.name,
          agentPubkey: planningAgent.pubkey,
          phase: "plan",
          context: chatSummary,
        },
      };
    } catch (error) {
      this.logError("Failed to initialize plan phase", error);
      return {
        success: false,
        message: `Plan phase initialization failed: ${error}`,
      };
    }
  }

  private async triggerClaudeCode(
    conversation: ConversationState,
    context: string,
    instruction: string
  ): Promise<boolean> {
    try {
      const projectContext = getProjectContext();

      // Get NDK and signer from project context
      const ndk = projectContext.ndk;
      const signer = projectContext.projectSigner;

      // Get the root event from the conversation
      const rootEvent = conversation.history[0];
      if (!rootEvent) {
        this.logError("No root event found in conversation");
        return false;
      }

      // Prepare the prompt for Claude Code
      const prompt = `${context}\n\n${instruction}`;

      this.log("Triggering Claude Code CLI with monitoring", {
        conversationId: conversation.id,
        promptLength: prompt.length,
      });

      // Create and execute Claude Code with monitoring
      const executor = new ClaudeCodeExecutor({
        prompt,
        projectPath: projectContext.projectDir,
        ndk,
        projectContext,
        conversationRootEvent: rootEvent,
        signer,
        title: "Create Implementation Plan",
        phase: "plan",
      });

      const result = await executor.execute();

      if (result.success) {
        this.log("Claude Code completed successfully", {
          sessionId: result.sessionId,
          taskId: result.taskEvent?.id,
          totalCost: result.totalCost,
          messageCount: result.messageCount,
        });

        // Store task ID in conversation metadata for tracking
        if (result.taskEvent) {
          conversation.metadata.planTaskId = result.taskEvent.id;
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

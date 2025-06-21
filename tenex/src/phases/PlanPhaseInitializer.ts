import type { ConversationState } from "@/conversations/types";
import { getNDK } from "@/nostr/ndkClient";
import { getProjectContext } from "@/runtime";
import { ClaudeCodeExecutor } from "@/tools";
import type { Agent } from "@/types/agent";
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

      // Prepare context from chat phase - build from actual conversation history
      const chatSummary = this.buildConversationContext(conversation);

      // Extract the actual task from the conversation
      const task = this.extractTaskFromConversation(conversation);

      // Trigger Claude Code CLI
      const claudeCodeTriggered = await this.triggerClaudeCode(conversation, chatSummary, task);

      if (claudeCodeTriggered) {
        return {
          success: true,
          message: "Plan phase initialized. Claude Code is creating the implementation plan.",
          // Don't assign a nextAgent since Claude Code is handling the response
          metadata: {
            claudeCodeTriggered,
            phase: "plan",
            context: chatSummary,
          },
        };
      }

      // If Claude Code failed, fall back to agent-based planning
      return {
        success: true,
        message: "Claude Code unavailable. Falling back to agent-based planning.",
        nextAgent: planningAgent.pubkey,
        metadata: {
          claudeCodeTriggered: false,
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
      const ndk = getNDK();
      const signer = projectContext.projectSigner;

      // Get the root event from the conversation
      const rootEvent = conversation.history[0];
      if (!rootEvent) {
        this.logError("No root event found in conversation", new Error("Missing root event"));
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
        projectPath: projectContext.projectPath,
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

  /**
   * Extract the actual task/requirement from the conversation
   */
  private extractTaskFromConversation(conversation: ConversationState): string {
    // Get user messages to understand what they're asking for
    const userMessages = conversation.history
      .filter((event) => !event.tags.some((tag) => tag[0] === "llm-model"))
      .map((event) => event.content);

    if (userMessages.length === 0) {
      return "Create a detailed implementation plan for the project.";
    }

    // Get the last few user messages to understand the most recent request
    const recentRequests = userMessages.slice(-3).join(" ");

    // Create a clear task description
    const taskDescription = `Based on the user's request: "${recentRequests}"

Create a detailed implementation plan that:
1. Addresses the specific requirements mentioned
2. Includes technical architecture and design decisions
3. Breaks down the work into clear implementation steps
4. Identifies any tools, libraries, or frameworks needed
5. Considers testing and quality assurance

Focus on being actionable and specific rather than asking questions.`;

    return taskDescription;
  }

  /**
   * Build conversation context from the actual message history
   */
  private buildConversationContext(conversation: ConversationState): string {
    // Get all messages from the conversation history
    const messages = conversation.history
      .map((event) => {
        // Skip system messages and phase transitions
        if (event.tags.some((tag) => tag[0] === "phase-transition")) {
          return null;
        }

        // Extract author info
        const authorPubkey = event.pubkey;
        const isUser = !event.tags.some((tag) => tag[0] === "llm-model");
        const author = isUser ? "User" : "Assistant";

        return `${author}: ${event.content}`;
      })
      .filter(Boolean);

    // Join all messages to create context
    const context = messages.join("\n\n");

    // If we have actual conversation content, use it
    // Otherwise fall back to the metadata summary
    return context || conversation.metadata.summary || "User wants to build a software project";
  }
}

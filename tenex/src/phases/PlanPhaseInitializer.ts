import type { ConversationState } from "@/conversations/types";
import { getProjectContext } from "@/runtime";
import { ClaudeCodeExecutor } from "@/tools/claude/ClaudeCodeExecutor";
import type { Agent } from "@/types/agent";
import type { Phase } from "@/types/conversation";
import { logger } from "@tenex/shared";
import type { PhaseInitializationResult, PhaseInitializer } from "./types";

/**
 * Plan Phase Initializer
 *
 * In the plan phase, we trigger Claude Code CLI with the conversation
 * context to create a detailed implementation plan.
 */
export class PlanPhaseInitializer implements PhaseInitializer {
  phase: Phase = "plan";

  async initialize(
    conversation: ConversationState,
    availableAgents: Agent[]
  ): Promise<PhaseInitializationResult> {
    logger.info("[PLAN Phase] Initializing plan phase", {
      conversationId: conversation.id,
      title: conversation.title,
      previousPhase: "chat",
    });

    try {
      const projectContext = getProjectContext();

      // Find an agent suitable for planning
      const planningAgent =
        availableAgents.find((agent) => agent.role.toLowerCase().includes("architect")) ||
        availableAgents.find((agent) => 
          ["planning", "design", "architecture"].some(keyword => 
            agent.expertise.toLowerCase().includes(keyword.toLowerCase())
          )
        ) ||
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
      logger.error("[PLAN Phase] Failed to initialize plan phase", { error });
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

      // Prepare the prompt for Claude Code
      const prompt = `${context}\n\n${instruction}`;

      logger.info("[PLAN Phase] Triggering Claude Code CLI", {
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
            logger.debug("[PLAN Phase] Claude assistant message", {
              messageId: message.message_id,
              sessionId: message.session_id,
            });
          }
          
          // The phase initializer can decide to publish to Nostr if needed
          // But for now, we just log the messages
          if (message.type === "error") {
            logger.error("[PLAN Phase] Claude error message", { message });
          }
        },
        onError: (error) => {
          logger.error("[PLAN Phase] Claude Code execution error", { error });
        },
        onComplete: (result) => {
          logger.info("[PLAN Phase] Claude Code execution completed", {
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
          conversation.metadata.planSessionId = result.sessionId;
        }
      }

      return result.success;
    } catch (error) {
      logger.error("[PLAN Phase] Error triggering Claude Code", { error });
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

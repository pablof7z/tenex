import type { Conversation } from "@/conversations/types";
import { getProjectContext } from "@/services";
import { ClaudeCodeExecutor } from "@/tools/claude/ClaudeCodeExecutor";
import type { Agent } from "@/agents/types";
import type { Phase } from "@/conversations/types";
import { logger } from "@/utils/logger";
import { PromptBuilder } from "@/prompts";
import type { PhaseInitializationResult, PhaseInitializer } from "./types";
import { handlePhaseError } from "./utils";
import { isEventFromUser, isEventFromAgent } from "@/nostr/utils";

/**
 * Plan Phase Initializer
 *
 * In the plan phase, we trigger Claude Code CLI with the conversation
 * context to create a detailed implementation plan.
 */
export class PlanPhaseInitializer implements PhaseInitializer {
  phase: Phase = "plan";

  async initialize(
    conversation: Conversation,
    availableAgents: Agent[]
  ): Promise<PhaseInitializationResult> {
    logger.info("[PLAN Phase] Initializing plan phase", {
      conversationId: conversation.id,
      title: conversation.title,
      previousPhase: "chat",
    });

    try {
      const projectCtx = getProjectContext();
      const project = projectCtx.project;

      // Find an agent suitable for planning
      const planningAgent =
        availableAgents.find((agent) => agent.role.toLowerCase().includes("architect")) ||
        availableAgents.find((agent) =>
          ["planning", "design", "architecture"].some((keyword) =>
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
      return handlePhaseError("Plan", error);
    }
  }

  private async triggerClaudeCode(
    conversation: Conversation,
    context: string,
    instruction: string
  ): Promise<boolean> {
    try {
      const projectCtx = getProjectContext();
      const project = projectCtx.project;

      // Prepare the prompt for Claude Code
      const prompt = new PromptBuilder()
        .add("plan-phase-prompt", { context, instruction })
        .build();

      logger.info("[PLAN Phase] Triggering Claude Code CLI", {
        conversationId: conversation.id,
        promptLength: prompt.length,
      });

      // Create executor with proper separation of concerns
      const executor = new ClaudeCodeExecutor({
        prompt,
        projectPath: process.cwd(),
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
          if (message.is_error || message.subtype === "error") {
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
  private extractTaskFromConversation(conversation: Conversation): string {
    // Get user messages to understand what they're asking for
    const userMessages = conversation.history
      .filter((event) => isEventFromUser(event))
      .map((event) => event.content);

    if (userMessages.length === 0) {
      return "Create a detailed implementation plan for the project.";
    }

    // Get the last few user messages to understand the most recent request
    const recentRequests = userMessages.slice(-3).join(" ");

    // Create a clear task description
    const taskDescription = new PromptBuilder()
      .add("plan-task-description", { recentRequests })
      .build();

    return taskDescription;
  }

  /**
   * Build conversation context from the actual message history
   */
  private buildConversationContext(conversation: Conversation): string {
    // Get all messages from the conversation history
    const messages = conversation.history
      .map((event) => {
        // Skip system messages and phase transitions
        if (event.tags.some((tag) => tag[0] === "phase-transition")) {
          return null;
        }

        // Extract author info
        const authorPubkey = event.pubkey;
        const isUser = isEventFromUser(event);
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

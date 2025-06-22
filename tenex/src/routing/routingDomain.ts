import type { ConversationState } from "@/conversations/types";
import type { Agent } from "@/types/agent";
import type { Phase } from "@/types/conversation";
import { logger } from "@tenex/shared";
import type { RoutingDecision } from "./types";

/**
 * Determine if a phase transition is valid
 */
export function canTransitionPhase(currentPhase: Phase, targetPhase: Phase): boolean {
  const validTransitions: Record<Phase, Phase[]> = {
    chat: ["plan"],
    plan: ["execute", "chat"], // Can go back to chat if more clarification needed
    execute: ["review", "plan"], // Can go back to plan if issues found
    review: ["execute", "chat", "chores"], // Can go back to execute for fixes, chat for new requirements, or chores for maintenance
    chores: ["chat"], // After chores, typically start a new conversation
  };

  return validTransitions[currentPhase]?.includes(targetPhase) ?? false;
}

/**
 * Validate a routing decision
 */
export function validateRoutingDecision(
  decision: RoutingDecision,
  conversation: ConversationState,
  availableAgents: Agent[]
): { valid: boolean; reason?: string } {
  // Validate phase transition if phase is changing
  if (decision.phase !== conversation.phase) {
    if (!canTransitionPhase(conversation.phase, decision.phase)) {
      return {
        valid: false,
        reason: `Invalid phase transition from ${conversation.phase} to ${decision.phase}`,
      };
    }
  }

  // Validate agent assignment if specified
  if (decision.nextAgent) {
    const agentExists = availableAgents.some((agent) => agent.pubkey === decision.nextAgent);
    if (!agentExists) {
      return {
        valid: false,
        reason: `Assigned agent ${decision.nextAgent} not found in available agents`,
      };
    }
  }

  // Validate confidence score if present
  if (decision.confidence !== undefined && (decision.confidence < 0 || decision.confidence > 1)) {
    return {
      valid: false,
      reason: `Invalid confidence score: ${decision.confidence}`,
    };
  }

  return { valid: true };
}

/**
 * Determine if a conversation should be routed to a specific phase based on content
 */
export function inferPhaseFromContent(message: string): Phase | null {
  const lowerMessage = message.toLowerCase();

  // Keywords that suggest specific phases
  const phaseKeywords = {
    plan: ["plan", "design", "architecture", "approach", "strategy"],
    execute: ["implement", "code", "build", "create", "develop"],
    review: ["review", "check", "test", "verify", "validate"],
  };

  for (const [phase, keywords] of Object.entries(phaseKeywords)) {
    if (keywords.some((keyword) => lowerMessage.includes(keyword))) {
      return phase as Phase;
    }
  }

  return null;
}

/**
 * Get the default agent for a phase
 */
export function getDefaultAgentForPhase(phase: Phase, agents: Agent[]): Agent | null {
  // Define phase-to-role mappings
  const phaseRoles: Record<Phase, string[]> = {
    chat: ["Requirements Analyst", "Project Manager"],
    plan: ["Architect", "Technical Lead", "System Designer"],
    execute: ["Developer", "Engineer", "Programmer"],
    review: ["Quality Assurance", "Tester", "Reviewer"],
    chores: ["Maintainer", "DevOps", "System Administrator"],
  };

  const preferredRoles = phaseRoles[phase] || [];

  // Find first agent matching preferred roles
  for (const role of preferredRoles) {
    const agent = agents.find((a) => a.role.toLowerCase().includes(role.toLowerCase()));
    if (agent) return agent;
  }

  // Return first available agent as fallback
  return agents[0] || null;
}

/**
 * Apply business rules to enhance or correct a routing decision
 */
export function applyBusinessRules(
  decision: RoutingDecision,
  conversation: ConversationState,
  availableAgents: Agent[]
): RoutingDecision {
  const enhancedDecision = { ...decision };

  // Rule 1: If no agent assigned for non-chat phases, assign default
  if (!enhancedDecision.nextAgent && enhancedDecision.phase !== "chat") {
    const defaultAgent = getDefaultAgentForPhase(enhancedDecision.phase, availableAgents);
    if (defaultAgent) {
      enhancedDecision.nextAgent = defaultAgent.pubkey;
      logger.info("Applied business rule: assigned default agent", {
        phase: enhancedDecision.phase,
        agent: defaultAgent.name,
      });
    }
  }

  // Rule 2: If confidence is low and we're changing phases, stay in current phase
  if (
    enhancedDecision.confidence !== undefined &&
    enhancedDecision.confidence < 0.7 &&
    enhancedDecision.phase !== conversation.phase
  ) {
    logger.info("Applied business rule: low confidence phase change prevented", {
      originalPhase: enhancedDecision.phase,
      currentPhase: conversation.phase,
      confidence: enhancedDecision.confidence,
    });
    enhancedDecision.phase = conversation.phase;
  }

  // Rule 3: Ensure review phase has a reviewer
  if (enhancedDecision.phase === "review" && !enhancedDecision.nextAgent) {
    const reviewer = availableAgents.find(
      (a) => a.role.toLowerCase().includes("review") || a.role.toLowerCase().includes("quality")
    );
    if (reviewer) {
      enhancedDecision.nextAgent = reviewer.pubkey;
    }
  }

  return enhancedDecision;
}

/**
 * Check if a conversation meets the criteria to transition to a specific phase
 */
export function meetsPhaseTransitionCriteria(
  conversation: ConversationState,
  targetPhase: Phase
): { canTransition: boolean; reason: string } {
  const currentPhase = conversation.phase;

  switch (targetPhase) {
    case "plan":
      // Can transition to plan if requirements are clear (from chat)
      if (currentPhase === "chat") {
        const hasUserMessages = conversation.history.some(
          (event) => !event.tags.some((tag) => tag[0] === "llm-model")
        );
        if (!hasUserMessages) {
          return {
            canTransition: false,
            reason: "No user requirements found to create a plan",
          };
        }
        return {
          canTransition: true,
          reason: "Requirements gathered, ready for planning",
        };
      }
      break;

    case "execute":
      // Can transition to execute if plan exists
      if (currentPhase === "plan") {
        const hasPlanSummary = conversation.metadata.plan_summary;
        if (!hasPlanSummary) {
          return {
            canTransition: false,
            reason: "No plan summary found, cannot proceed to execution",
          };
        }
        return {
          canTransition: true,
          reason: "Plan approved, ready for implementation",
        };
      }
      break;

    case "review":
      // Can transition to review if implementation exists
      if (currentPhase === "execute") {
        const hasExecuteSummary = conversation.metadata.execute_summary;
        if (!hasExecuteSummary) {
          return {
            canTransition: false,
            reason: "No implementation summary found, cannot proceed to review",
          };
        }
        return {
          canTransition: true,
          reason: "Implementation complete, ready for review",
        };
      }
      break;

    case "chat":
      // Can always go back to chat for clarification
      return {
        canTransition: true,
        reason: "Returning to chat for clarification",
      };

    case "chores":
      // Can transition to chores from review phase
      if (currentPhase === "review") {
        const hasReviewSummary = conversation.metadata.review_summary;
        if (!hasReviewSummary) {
          // Still allow transition even without review summary
          return {
            canTransition: true,
            reason: "Proceeding to maintenance tasks",
          };
        }
        return {
          canTransition: true,
          reason: "Review complete, performing maintenance tasks",
        };
      }
      break;
  }

  return {
    canTransition: false,
    reason: `No valid transition path from ${currentPhase} to ${targetPhase}`,
  };
}
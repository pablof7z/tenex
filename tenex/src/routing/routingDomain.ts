import type { Conversation } from "@/conversations/types";
import type { Agent } from "@/agents/types";
import type { Phase } from "@/conversations/types";
import { logger } from "@/utils/logger";
import type { RoutingDecision } from "./types";
import { isEventFromUser } from "@/nostr/utils";
import { evaluatePhaseCompletion } from "./phase-completion";

/**
 * Determine if a phase transition is valid
 */
export function canTransitionPhase(currentPhase: Phase, targetPhase: Phase): boolean {
  const validTransitions: Record<Phase, Phase[]> = {
    chat: ["plan"],
    plan: ["execute", "chat"], // Can go back to chat if more clarification needed
    execute: ["review", "plan", "chat"], // Can go back to plan if issues found or chat for clarification
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
  conversation: Conversation,
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
  conversation: Conversation,
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
  conversation: Conversation,
  targetPhase: Phase
): { canTransition: boolean; reason: string } {
  const currentPhase = conversation.phase;

  // First check if the transition path is valid
  if (!canTransitionPhase(currentPhase, targetPhase)) {
    return {
      canTransition: false,
      reason: `No valid transition path from ${currentPhase} to ${targetPhase}`,
    };
  }

  // Always allow going back to chat for clarification
  if (targetPhase === "chat") {
    return {
      canTransition: true,
      reason: "Returning to chat for clarification",
    };
  }

  // Evaluate if current phase is completed using robust completion logic
  const currentPhaseCompletion = evaluatePhaseCompletion(currentPhase, conversation);

  // Only allow transition if current phase is completed successfully
  if (!currentPhaseCompletion.completed) {
    const incompleteItems = [];
    
    // Extract incomplete criteria based on phase
    const criteria = currentPhaseCompletion.criteria;
    if (criteria.chat) {
      if (!criteria.chat.requirementsCaptured) incompleteItems.push("requirements not captured");
      if (!criteria.chat.userNeedsClarified) incompleteItems.push("user needs not clarified");
      if (!criteria.chat.readyForPlanning) incompleteItems.push("not ready for planning");
    } else if (criteria.plan) {
      if (!criteria.plan.architectureDocumented) incompleteItems.push("architecture not documented");
      if (!criteria.plan.tasksIdentified) incompleteItems.push("tasks not identified");
      if (!criteria.plan.userApproval) incompleteItems.push("user approval not obtained");
    } else if (criteria.execute) {
      if (!criteria.execute.allTasksCompleted) incompleteItems.push("tasks not completed");
      if (!criteria.execute.codeCommitted) incompleteItems.push("code not committed");
    } else if (criteria.review) {
      if (!criteria.review.validationComplete) incompleteItems.push("validation not complete");
    }

    const reason = incompleteItems.length > 0 
      ? `Current phase (${currentPhase}) not complete: ${incompleteItems.join(", ")}`
      : `Current phase (${currentPhase}) not complete`;

    return {
      canTransition: false,
      reason,
    };
  }

  // Phase is complete, allow transition
  return {
    canTransition: true,
    reason: `${currentPhase} phase complete, ready for ${targetPhase}`,
  };
}

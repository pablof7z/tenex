import type { Agent } from "@/types/agent";
import type { Phase } from "@/types/conversation";
import type { AgentSummary } from "@/types/routing";

export interface RoutingContext {
  conversationId: string;
  currentPhase: Phase;
  lastMessage: string;
  phaseHistory: string;
  conversationSummary: string;
}

export interface RoutingDecision {
  phase: Phase;
  reasoning: string;
  confidence: number;
  nextAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface PhaseTransitionDecision {
  shouldTransition: boolean;
  targetPhase?: Phase;
  reasoning: string;
  confidence: number;
  conditions: string[];
}

export interface AgentSelectionDecision {
  selectedAgent: Agent;
  reasoning: string;
  confidence: number;
  alternativeAgents?: Agent[];
}

export interface FallbackRoutingDecision {
  selectedAgent: Agent;
  phase: Phase;
  reasoning: string;
  confidence: number;
  isUncertain: boolean;
}

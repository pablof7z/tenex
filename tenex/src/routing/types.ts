import type { Phase } from "@/types/conversation";
import type { AgentSummary } from "@/types/routing";

export interface RoutingContext {
  conversationId: string;
  currentPhase?: Phase;
  messageContent: string;
  availableAgents: AgentSummary[];
  conversationHistory?: string;
}

export interface RoutingDecision {
  phase: Phase;
  nextAgent?: string; // pubkey of the agent to handle the conversation
  reasoning?: string;
  confidence?: number;
}

export interface PhaseTransitionDecision {
  shouldTransition: boolean;
  targetPhase?: Phase;
  reasoning: string;
}

export interface AgentSelectionDecision {
  agentPubkey: string;
  reasoning: string;
}

export interface FallbackRoutingDecision {
  action: "set_phase" | "ask_user" | "handoff";
  phase?: Phase;
  message?: string;
  agentPubkey?: string;
  reasoning: string;
}

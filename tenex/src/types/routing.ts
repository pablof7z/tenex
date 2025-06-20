import type { Phase } from "./conversation";

export interface RoutingDecision {
  phase: Phase;
  nextAgent: string; // pubkey of the agent to handle the conversation
  reasoning?: string;
  confidence?: number;
}

export interface RoutingContext {
  conversationId: string;
  currentPhase: Phase;
  messageContent: string;
  availableAgents: AgentSummary[];
  conversationHistory?: string; // Summarized history
}

export interface AgentSummary {
  name: string;
  pubkey: string;
  role: string;
  expertise: string;
}

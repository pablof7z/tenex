import type { ConversationState } from "@/conversations/types";
import type { Agent } from "@/agents/types";
import type { Phase } from "@/conversations/types";

export interface PhaseInitializationResult {
  success: boolean;
  message?: string;
  nextAgent?: string; // pubkey of agent to handle the phase
  metadata?: Record<string, unknown>;
}

export interface PhaseInitializer {
  phase: Phase;
  initialize(
    conversation: ConversationState,
    availableAgents: Agent[]
  ): Promise<PhaseInitializationResult>;
}

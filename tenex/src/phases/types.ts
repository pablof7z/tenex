import type { ConversationState } from "@/conversations/types";
import type { Agent } from "@/types/agent";
import type { Phase } from "@/types/conversation";

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

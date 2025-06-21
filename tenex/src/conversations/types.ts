import type { Phase } from "@/types/conversation";
import type { NDKEvent } from "@nostr-dev-kit/ndk";

export interface ConversationState {
  id: string;
  title: string;
  phase: Phase;
  history: NDKEvent[];
  currentAgent?: string; // pubkey of current agent
  phaseStartedAt?: number;
  metadata: ConversationMetadata;
}

export interface ConversationMetadata {
  branch?: string; // Git branch for execution phase
  summary?: string; // Current understanding/summary
  requirements?: string; // Captured requirements
  plan?: string; // Approved plan
  [key: string]: unknown; // Extensible for phase-specific data
}

export interface PhaseContext {
  phase: Phase;
  startedAt: number;
  completedAt?: number;
  summary: string;
}

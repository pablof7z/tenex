import type { NDKEvent } from "@nostr-dev-kit/ndk";

export type Phase = "chat" | "plan" | "execute" | "review" | "chores";

export interface Conversation {
  id: string;
  title: string;
  phase: Phase;
  history: NDKEvent[];
  currentAgent?: string; // pubkey of current agent
  phaseStartedAt?: number;
  metadata: Record<string, any>;
}

export interface PhaseTransition {
  from: Phase;
  to: Phase;
  context: string; // Compacted context for the new phase
  timestamp: number;
  reason?: string;
}

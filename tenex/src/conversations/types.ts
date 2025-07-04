import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type { Phase } from "./phases";

export interface Conversation {
    id: string;
    title: string;
    phase: Phase;
    history: NDKEvent[];
    phaseStartedAt?: number;
    metadata: ConversationMetadata;
    phaseTransitions: PhaseTransition[]; // First-class phase transition history
    
    // Execution time tracking
    executionTime: {
        totalSeconds: number;
        currentSessionStart?: number;
        isActive: boolean;
        lastUpdated: number;
    };
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

export interface PhaseTransition {
    from: Phase;
    to: Phase;
    message: string; // Comprehensive context from the transition
    timestamp: number;
    agentPubkey: string; // Track which agent initiated
    agentName: string; // Human-readable agent name
    reason?: string; // Brief description (optional)
}

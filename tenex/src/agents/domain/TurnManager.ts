import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";

const conversationLogger = logger.forModule("conversation");

export interface TurnManagerConfig {
    stageParticipants: string[];
    primarySpeaker?: string;
}

export class TurnManager {
    private lastSpeaker: string | null = null;
    private currentSpeaker: string | null = null;
    private hasUserSpoken = false;

    constructor(private config: TurnManagerConfig) {}

    selectSpeaker(_event: NDKEvent, isUserMessage: boolean): string | null {
        // Reset on new user message
        if (isUserMessage) {
            this.hasUserSpoken = true;
            this.lastSpeaker = null;

            // Primary speaker goes first if defined
            if (
                this.config.primarySpeaker &&
                this.config.stageParticipants.includes(this.config.primarySpeaker)
            ) {
                conversationLogger.info(
                    `Selected primary speaker: ${this.config.primarySpeaker}`,
                    "verbose"
                );
                return this.config.primarySpeaker;
            }

            // Otherwise first participant
            const speaker = this.config.stageParticipants[0] || null;
            conversationLogger.info(`Selected first participant: ${speaker}`, "verbose");
            return speaker;
        }

        // No speakers for agent messages unless explicitly needed
        conversationLogger.debug("Agent message received, no speaker selected", "verbose");
        return null;
    }

    recordSpeech(speaker: string): void {
        this.lastSpeaker = speaker;
        this.currentSpeaker = null;
        conversationLogger.debug(`Recorded speech from: ${speaker}`, "verbose");
    }

    setCurrentSpeaker(speaker: string | null): void {
        this.currentSpeaker = speaker;
        if (speaker) {
            conversationLogger.debug(`Current speaker set to: ${speaker}`, "verbose");
        }
    }

    getCurrentSpeaker(): string | null {
        return this.currentSpeaker;
    }

    getLastSpeaker(): string | null {
        return this.lastSpeaker;
    }

    updateStageParticipants(participants: string[], primarySpeaker?: string): void {
        this.config.stageParticipants = participants;
        this.config.primarySpeaker = primarySpeaker;
        this.hasUserSpoken = false;
        conversationLogger.info(
            `Updated participants: ${participants.join(", ")}, primary: ${primarySpeaker || "none"}`,
            "verbose"
        );
    }
}

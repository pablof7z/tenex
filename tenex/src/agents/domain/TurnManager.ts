import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";

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
                logger.info(`Selected primary speaker: ${this.config.primarySpeaker}`);
                return this.config.primarySpeaker;
            }

            // Otherwise first participant
            const speaker = this.config.stageParticipants[0] || null;
            logger.info(`Selected first participant: ${speaker}`);
            return speaker;
        }

        // No speakers for agent messages unless explicitly needed
        logger.debug("Agent message received, no speaker selected");
        return null;
    }

    recordSpeech(speaker: string): void {
        this.lastSpeaker = speaker;
        this.currentSpeaker = null;
        logger.debug(`Recorded speech from: ${speaker}`);
    }

    setCurrentSpeaker(speaker: string | null): void {
        this.currentSpeaker = speaker;
        if (speaker) {
            logger.debug(`Current speaker set to: ${speaker}`);
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
        logger.info(
            `Updated participants: ${participants.join(", ")}, primary: ${primarySpeaker || "none"}`
        );
    }
}

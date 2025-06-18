import { NDKEvent } from "@nostr-dev-kit/ndk";
import { beforeEach, describe, expect, it } from "vitest";
import { TurnManager } from "../TurnManager";

describe("TurnManager", () => {
    let turnManager: TurnManager;

    beforeEach(() => {
        turnManager = new TurnManager({
            stageParticipants: ["agent1", "agent2", "agent3"],
            primarySpeaker: "agent2",
        });
    });

    describe("selectSpeaker", () => {
        it("should select primary speaker for user messages when defined", () => {
            const event = new NDKEvent();
            event.content = "User message";

            const speaker = turnManager.selectSpeaker(event, true);
            expect(speaker).toBe("agent2");
        });

        it("should select first participant if no primary speaker", () => {
            turnManager = new TurnManager({
                stageParticipants: ["agent1", "agent2", "agent3"],
            });

            const event = new NDKEvent();
            const speaker = turnManager.selectSpeaker(event, true);
            expect(speaker).toBe("agent1");
        });

        it("should return null for agent messages", () => {
            const event = new NDKEvent();
            const speaker = turnManager.selectSpeaker(event, false);
            expect(speaker).toBeNull();
        });

        it("should return null when no participants", () => {
            turnManager = new TurnManager({
                stageParticipants: [],
            });

            const event = new NDKEvent();
            const speaker = turnManager.selectSpeaker(event, true);
            expect(speaker).toBeNull();
        });
    });

    describe("recordSpeech", () => {
        it("should track last speaker", () => {
            expect(turnManager.getLastSpeaker()).toBeNull();

            turnManager.recordSpeech("agent1");
            expect(turnManager.getLastSpeaker()).toBe("agent1");

            turnManager.recordSpeech("agent2");
            expect(turnManager.getLastSpeaker()).toBe("agent2");
        });

        it("should clear current speaker when recording speech", () => {
            turnManager.setCurrentSpeaker("agent1");
            expect(turnManager.getCurrentSpeaker()).toBe("agent1");

            turnManager.recordSpeech("agent1");
            expect(turnManager.getCurrentSpeaker()).toBeNull();
        });
    });

    describe("updateStageParticipants", () => {
        it("should update participants and primary speaker", () => {
            const event = new NDKEvent();

            // Initial state
            let speaker = turnManager.selectSpeaker(event, true);
            expect(speaker).toBe("agent2");

            // Update participants
            turnManager.updateStageParticipants(["agent4", "agent5"], "agent5");

            // Should select new primary speaker
            speaker = turnManager.selectSpeaker(event, true);
            expect(speaker).toBe("agent5");
        });

        it("should reset user spoken flag on stage update", () => {
            const event = new NDKEvent();

            // User speaks in first stage
            turnManager.selectSpeaker(event, true);

            // Update to new stage
            turnManager.updateStageParticipants(["agent4"], undefined);

            // Should allow speaker selection for new user message
            const speaker = turnManager.selectSpeaker(event, true);
            expect(speaker).toBe("agent4");
        });
    });
});

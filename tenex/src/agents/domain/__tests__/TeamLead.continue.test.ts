import { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import NDK from "@nostr-dev-kit/ndk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentConfig, ConversationStore, LLMProvider, NostrPublisher } from "../../core/types";
import { Agent } from "../Agent";
import { Team } from "../Team";
import { TeamLead } from "../TeamLead";

describe("TeamLead Continue Signal Handling", () => {
    let teamLead: TeamLead;
    let mockStore: ConversationStore;
    let mockPublisher: NostrPublisher;
    let mockLLM: LLMProvider;
    let ndk: NDK;
    let team: Team;
    let mockAgent1: Agent;
    let mockAgent2: Agent;

    beforeEach(() => {
        // Setup mocks
        mockStore = {
            getMessages: vi.fn().mockResolvedValue([]),
            appendMessage: vi.fn(),
            getTeam: vi.fn(),
            saveTeam: vi.fn(),
        };

        mockPublisher = {
            publishResponse: vi.fn(),
            publishTypingIndicator: vi.fn(),
        };

        mockLLM = {
            complete: vi.fn().mockResolvedValue({
                content: "Mock response",
                model: "mock-model",
            }),
        };

        ndk = new NDK();

        // Create team with stages
        team = new Team("team-1", "root-event-1", "lead", ["lead", "agent1", "agent2"], {
            stages: [
                {
                    participants: ["lead", "agent1"],
                    purpose: "Stage 1",
                    expectedOutcome: "Outcome 1",
                    transitionCriteria: "Criteria 1",
                    primarySpeaker: "agent1",
                },
                {
                    participants: ["lead", "agent2"],
                    purpose: "Stage 2",
                    expectedOutcome: "Outcome 2",
                    transitionCriteria: "Criteria 2",
                    primarySpeaker: "agent2",
                },
            ],
            estimatedComplexity: 5,
        });

        const leadConfig: AgentConfig = {
            name: "lead",
            role: "Team Lead",
            instructions: "Lead the team",
            nsec: NDKPrivateKeySigner.generate().privateKey!,
        };

        teamLead = new TeamLead(leadConfig, mockLLM, mockStore, mockPublisher, ndk, team);

        // Mock agents
        mockAgent1 = new Agent(
            {
                name: "agent1",
                role: "Agent 1",
                instructions: "Do stuff",
                nsec: NDKPrivateKeySigner.generate().privateKey!,
            },
            mockLLM,
            mockStore,
            mockPublisher,
            ndk
        );

        mockAgent2 = new Agent(
            {
                name: "agent2",
                role: "Agent 2",
                instructions: "Do other stuff",
                nsec: NDKPrivateKeySigner.generate().privateKey!,
            },
            mockLLM,
            mockStore,
            mockPublisher,
            ndk
        );

        // Mock agent methods
        vi.spyOn(mockAgent1, "handleEvent").mockResolvedValue(undefined);
        vi.spyOn(mockAgent1, "getPubkey").mockReturnValue("agent1-pubkey");
        vi.spyOn(mockAgent2, "handleEvent").mockResolvedValue(undefined);
        vi.spyOn(mockAgent2, "getPubkey").mockReturnValue("agent2-pubkey");

        // Set team agents
        const agents = new Map([
            ["agent1", mockAgent1],
            ["agent2", mockAgent2],
        ]);
        teamLead.setTeamAgents(agents);
    });

    describe("Continue Signal Processing", () => {
        it("should maintain current speaker when continue signal is received", async () => {
            // Mock agent1 signaling continue
            mockStore.getMessages = vi.fn().mockResolvedValue([
                {
                    id: "msg-1",
                    agentName: "agent1",
                    content: "I'll wait for more input",
                    timestamp: Date.now(),
                    signal: { type: "continue", reason: "awaiting user clarification" },
                },
            ]);

            const userEvent1 = new NDKEvent();
            userEvent1.content = "First message";
            userEvent1.pubkey = "user-pubkey";

            const context = {
                rootEventId: "root-event-1",
                projectId: "proj-1",
                originalEvent: userEvent1,
            };

            // First call - agent1 responds and signals continue
            await teamLead.handleEvent(userEvent1, context);
            expect(mockAgent1.handleEvent).toHaveBeenCalledWith(userEvent1, context);

            // Clear mocks
            vi.clearAllMocks();

            // Second user message should still go to agent1
            const userEvent2 = new NDKEvent();
            userEvent2.content = "Follow-up message";
            userEvent2.pubkey = "user-pubkey";

            await teamLead.handleEvent(userEvent2, context);

            // Agent1 should still be the active speaker
            expect(mockAgent1.handleEvent).toHaveBeenCalledWith(userEvent2, context);
            expect(mockAgent2.handleEvent).not.toHaveBeenCalled();
        });

        it("should not transition stages when continue signal is received", async () => {
            const checkForTransitionSpy = vi.spyOn(teamLead as any, "checkForTransition");
            const transitionToNextStageSpy = vi.spyOn(teamLead as any, "transitionToNextStage");

            // Mock agent1 signaling continue
            mockStore.getMessages = vi.fn().mockResolvedValue([
                {
                    id: "msg-1",
                    agentName: "agent1",
                    content: "Processing...",
                    timestamp: Date.now(),
                    signal: { type: "continue" },
                },
            ]);

            const userEvent = new NDKEvent();
            userEvent.content = "User message";
            userEvent.pubkey = "user-pubkey";

            const context = {
                rootEventId: "root-event-1",
                projectId: "proj-1",
                originalEvent: userEvent,
            };

            await teamLead.handleEvent(userEvent, context);

            // checkForTransition should be called
            expect(checkForTransitionSpy).toHaveBeenCalled();
            // But transitionToNextStage should NOT be called
            expect(transitionToNextStageSpy).not.toHaveBeenCalled();

            // Should still be in stage 0
            expect((teamLead as any).currentStageIndex).toBe(0);
        });

        it("should handle multiple agents with mixed signals including continue", async () => {
            // Add agent2 to current stage
            team.plan.stages[0]!.participants = ["lead", "agent1", "agent2"];

            // Mock mixed signals
            mockStore.getMessages = vi.fn().mockResolvedValue([
                {
                    id: "msg-1",
                    agentName: "agent1",
                    content: "I need more info",
                    timestamp: Date.now(),
                    signal: { type: "continue" },
                },
                {
                    id: "msg-2",
                    agentName: "agent2",
                    content: "I'm ready to move on",
                    timestamp: Date.now() + 1,
                    signal: { type: "ready_for_transition" },
                },
            ]);

            const userEvent = new NDKEvent();
            userEvent.content = "User message";
            userEvent.pubkey = "user-pubkey";

            const context = {
                rootEventId: "root-event-1",
                projectId: "proj-1",
                originalEvent: userEvent,
            };

            const transitionSpy = vi.spyOn(teamLead as any, "transitionToNextStage");

            await teamLead.handleEvent(userEvent, context);

            // Should NOT transition because continue takes precedence
            expect(transitionSpy).not.toHaveBeenCalled();
        });
    });

    describe("Single Agent Scenario", () => {
        beforeEach(() => {
            // Create team with only one agent
            team = new Team("team-1", "root-event-1", "lead", ["lead", "agent1"], {
                stages: [
                    {
                        participants: ["lead", "agent1"],
                        purpose: "Single agent stage",
                        expectedOutcome: "Complete task",
                        transitionCriteria: "Task complete",
                        primarySpeaker: "agent1",
                    },
                ],
                estimatedComplexity: 3,
            });

            const leadConfig: AgentConfig = {
                name: "lead",
                role: "Team Lead",
                instructions: "Lead the team",
                nsec: NDKPrivateKeySigner.generate().privateKey!,
            };

            teamLead = new TeamLead(leadConfig, mockLLM, mockStore, mockPublisher, ndk, team);

            const agents = new Map([["agent1", mockAgent1]]);
            teamLead.setTeamAgents(agents);
        });

        it("should allow single agent to continue conversation", async () => {
            // Mock agent1 signaling continue
            mockStore.getMessages = vi.fn().mockResolvedValue([
                {
                    id: "msg-1",
                    agentName: "agent1",
                    content: "Tell me more",
                    timestamp: Date.now(),
                    signal: { type: "continue" },
                },
            ]);

            const userEvent1 = new NDKEvent();
            userEvent1.content = "Initial request";
            userEvent1.pubkey = "user-pubkey";

            const context = {
                rootEventId: "root-event-1",
                projectId: "proj-1",
                originalEvent: userEvent1,
            };

            await teamLead.handleEvent(userEvent1, context);

            vi.clearAllMocks();

            // Follow-up message
            const userEvent2 = new NDKEvent();
            userEvent2.content = "Here's more information";
            userEvent2.pubkey = "user-pubkey";

            await teamLead.handleEvent(userEvent2, context);

            // Agent1 should handle the follow-up
            expect(mockAgent1.handleEvent).toHaveBeenCalledWith(userEvent2, context);
        });

        it("should not get stuck when single agent signals continue", async () => {
            const checkForTransitionSpy = vi.spyOn(teamLead as any, "checkForTransition");

            // Mock agent1 signaling continue
            mockStore.getMessages = vi.fn().mockResolvedValue([
                {
                    id: "msg-1",
                    agentName: "agent1",
                    content: "Waiting for more",
                    timestamp: Date.now(),
                    signal: { type: "continue" },
                },
            ]);

            const userEvent = new NDKEvent();
            userEvent.content = "User message";
            userEvent.pubkey = "user-pubkey";

            const context = {
                rootEventId: "root-event-1",
                projectId: "proj-1",
                originalEvent: userEvent,
            };

            await teamLead.handleEvent(userEvent, context);

            expect(checkForTransitionSpy).toHaveBeenCalled();

            // Verify the active speakers still include agent1
            const activeSpeakers = (teamLead as any).activeSpeakers;
            expect(activeSpeakers.has("agent1")).toBe(true);
        });
    });
});

import { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import NDK from "@nostr-dev-kit/ndk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentConfig, ConversationStore, LLMProvider, NostrPublisher } from "../../core/types";
import { Agent } from "../Agent";
import { Team } from "../Team";
import { TeamLead } from "../TeamLead";

describe("TeamLead Turn-Based Speaking", () => {
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
        team = new Team("team-1", "conv-1", "lead", ["lead", "agent1", "agent2"], {
            stages: [
                {
                    participants: ["lead", "agent1"],
                    purpose: "Stage 1",
                    expectedOutcome: "Outcome 1",
                    transitionCriteria: "Criteria 1",
                    primarySpeaker: "agent1",
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

    describe("Single Speaker Selection", () => {
        it("should only let primary speaker respond to user messages", async () => {
            const userEvent = new NDKEvent();
            userEvent.content = "User message";
            userEvent.pubkey = "user-pubkey";

            const context = {
                conversationId: "conv-1",
                projectId: "proj-1",
                originalEvent: userEvent,
            };

            await teamLead.handleEvent(userEvent, context);

            // Only agent1 (primary speaker) should have been called
            expect(mockAgent1.handleEvent).toHaveBeenCalledWith(userEvent, context);
            expect(mockAgent2.handleEvent).not.toHaveBeenCalled();
        });

        it("should not let agents respond to other agent messages", async () => {
            const agentEvent = new NDKEvent();
            agentEvent.content = "Agent message";
            agentEvent.pubkey = "agent1-pubkey";

            const context = {
                conversationId: "conv-1",
                projectId: "proj-1",
                originalEvent: agentEvent,
            };

            await teamLead.handleEvent(agentEvent, context);

            // No agents should respond to agent messages
            expect(mockAgent1.handleEvent).not.toHaveBeenCalled();
            expect(mockAgent2.handleEvent).not.toHaveBeenCalled();
        });

        it("should select first participant when no primary speaker", async () => {
            // Update team to have no primary speaker
            team.plan.stages[0]!.primarySpeaker = undefined;

            // Recreate TeamLead with updated team
            teamLead = new TeamLead(
                {
                    name: "lead",
                    role: "Team Lead",
                    instructions: "Lead",
                    nsec: NDKPrivateKeySigner.generate().privateKey!,
                },
                mockLLM,
                mockStore,
                mockPublisher,
                ndk,
                team
            );

            const agents = new Map([
                ["agent1", mockAgent1],
                ["agent2", mockAgent2],
            ]);
            teamLead.setTeamAgents(agents);

            const userEvent = new NDKEvent();
            userEvent.content = "User message";
            userEvent.pubkey = "user-pubkey";

            const context = {
                conversationId: "conv-1",
                projectId: "proj-1",
                originalEvent: userEvent,
            };

            await teamLead.handleEvent(userEvent, context);

            // First participant (lead) should be selected, but since lead doesn't route to self,
            // no agent should be called
            expect(mockAgent1.handleEvent).not.toHaveBeenCalled();
            expect(mockAgent2.handleEvent).not.toHaveBeenCalled();
        });
    });

    describe("Self-Reply Guard", () => {
        it("should not process its own events", async () => {
            const ownEvent = new NDKEvent();
            ownEvent.content = "Team lead's own message";
            ownEvent.pubkey = await teamLead
                .getSigner()
                .user()
                .then((u) => u.pubkey);

            const context = {
                conversationId: "conv-1",
                projectId: "proj-1",
                originalEvent: ownEvent,
            };

            await teamLead.handleEvent(ownEvent, context);

            // Should not route to any agents
            expect(mockAgent1.handleEvent).not.toHaveBeenCalled();
            expect(mockAgent2.handleEvent).not.toHaveBeenCalled();
        });
    });

    describe("Stage Transitions", () => {
        it("should update speaker selection when transitioning stages", async () => {
            // Add a second stage with different primary speaker
            team.plan.stages.push({
                participants: ["lead", "agent2"],
                purpose: "Stage 2",
                expectedOutcome: "Outcome 2",
                transitionCriteria: "Criteria 2",
                primarySpeaker: "agent2",
            });

            // Mock transition signal from agent1
            mockStore.getMessages = vi.fn().mockResolvedValue([
                {
                    id: "msg-1",
                    agentName: "agent1",
                    content: "Ready to transition",
                    timestamp: Date.now(),
                    signal: { type: "ready_for_transition", reason: "Done" },
                },
            ]);

            const userEvent = new NDKEvent();
            userEvent.content = "User message";
            userEvent.pubkey = "user-pubkey";

            const context = {
                conversationId: "conv-1",
                projectId: "proj-1",
                originalEvent: userEvent,
            };

            // First call - agent1 responds and signals transition
            await teamLead.handleEvent(userEvent, context);

            // Manually trigger stage transition check
            const transitionMethod = teamLead as any;
            await transitionMethod.transitionToNextStage(context);

            // Second user message should go to agent2 (new primary speaker)
            const userEvent2 = new NDKEvent();
            userEvent2.content = "Another user message";
            userEvent2.pubkey = "user-pubkey";

            // Reset mocks
            vi.clearAllMocks();

            await teamLead.handleEvent(userEvent2, context);

            // Only agent2 should respond in stage 2
            expect(mockAgent2.handleEvent).toHaveBeenCalledWith(userEvent2, context);
            expect(mockAgent1.handleEvent).not.toHaveBeenCalled();
        });
    });
});

import { NDKEvent } from "@nostr-dev-kit/ndk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
    AgentConfig,
    LLMProvider,
    NostrPublisher,
    TeamFormationRequest,
} from "../../core/types";
import { TeamOrchestrator } from "../TeamOrchestrator";

describe("TeamOrchestrator Single vs Multi-Agent", () => {
    let orchestrator: TeamOrchestrator;
    let mockLLM: LLMProvider;
    let mockPublisher: NostrPublisher;
    let availableAgents: Map<string, AgentConfig>;

    beforeEach(() => {
        mockLLM = {
            complete: vi.fn(),
        };

        mockPublisher = {
            publishResponse: vi.fn(),
            publishTypingIndicator: vi.fn().mockResolvedValue(undefined),
        };

        orchestrator = new TeamOrchestrator(mockLLM, mockPublisher);

        availableAgents = new Map([
            [
                "requirements",
                {
                    name: "requirements",
                    role: "Requirements Analyst",
                    instructions: "Gather and analyze requirements",
                    nsec: "nsec1requirements",
                },
            ],
            [
                "architect",
                {
                    name: "architect",
                    role: "Software Architect",
                    instructions: "Design system architecture",
                    nsec: "nsec1architect",
                },
            ],
            [
                "backend",
                {
                    name: "backend",
                    role: "Backend Developer",
                    instructions: "Implement backend services",
                    nsec: "nsec1backend",
                },
            ],
            [
                "frontend",
                {
                    name: "frontend",
                    role: "Frontend Developer",
                    instructions: "Build user interfaces",
                    nsec: "nsec1frontend",
                },
            ],
        ]);
    });

    describe("Single-Agent Team Formation", () => {
        it("should form single-agent team for simple requests", async () => {
            const event = new NDKEvent();
            event.content = "I want to build a calculator";
            event.id = "event1";

            const mockProjectEvent = {
                id: "proj1",
                dTag: "proj1",
                title: "Test Project",
                description: "A test project",
                repo: undefined,
                content: "A test project",
            } as unknown as NDKProject;

            const request: TeamFormationRequest = {
                event,
                availableAgents,
                projectEvent: mockProjectEvent,
            };

            // Mock LLM response for single agent
            mockLLM.complete = vi.fn().mockResolvedValue({
                content: JSON.stringify({
                    team: {
                        lead: "requirements",
                        members: ["requirements"],
                    },
                    conversationPlan: {
                        stages: [
                            {
                                participants: ["requirements"],
                                purpose: "Gather calculator requirements",
                                expectedOutcome: "Clear specification of calculator features",
                                transitionCriteria:
                                    "Requirements gathered or additional expertise needed",
                                primarySpeaker: "requirements",
                            },
                        ],
                        estimatedComplexity: 2,
                    },
                    reasoning: "Simple requirements gathering task - single agent sufficient",
                }),
            });

            const result = await orchestrator.formTeam(request);

            expect(result.team.lead).toBe("requirements");
            expect(result.team.members).toHaveLength(1);
            expect(result.team.members[0]).toBe("requirements");
            expect(result.conversationPlan.stages).toHaveLength(1);
            expect(result.conversationPlan.stages[0].participants).toEqual(["requirements"]);
            expect(result.conversationPlan.estimatedComplexity).toBe(2);
        });

        it("should validate single-agent team has valid agent", async () => {
            const event = new NDKEvent();
            event.content = "Help me debug this";
            event.id = "event2";

            const mockProjectEvent = {
                id: "proj1",
                dTag: "proj1",
                title: "Test Project",
                description: undefined,
                repo: undefined,
                content: "",
            } as unknown as NDKProject;

            const request: TeamFormationRequest = {
                event,
                availableAgents,
                projectEvent: mockProjectEvent,
            };

            // Mock LLM response with invalid agent
            mockLLM.complete = vi.fn().mockResolvedValue({
                content: JSON.stringify({
                    team: {
                        lead: "debugger",
                        members: ["debugger"],
                    },
                    conversationPlan: {
                        stages: [
                            {
                                participants: ["debugger"],
                                purpose: "Debug the issue",
                                expectedOutcome: "Issue resolved",
                                transitionCriteria: "Complete",
                            },
                        ],
                        estimatedComplexity: 1,
                    },
                    reasoning: "Debugging task",
                }),
            });

            await expect(orchestrator.formTeam(request)).rejects.toThrow(
                "Team lead 'debugger' not found in available agents"
            );
        });
    });

    describe("Multi-Agent Team Formation", () => {
        it("should form multi-agent team for complex requests", async () => {
            const event = new NDKEvent();
            event.content = "Build a full-stack web application with authentication";
            event.id = "event3";

            const mockProjectEvent = {
                id: "proj1",
                dTag: "proj1",
                title: "Full-Stack App",
                description: undefined,
                repo: undefined,
                content: "",
            } as unknown as NDKProject;

            const request: TeamFormationRequest = {
                event,
                availableAgents,
                projectEvent: mockProjectEvent,
            };

            // Mock LLM response for multi-agent team
            mockLLM.complete = vi.fn().mockResolvedValue({
                content: JSON.stringify({
                    team: {
                        lead: "architect",
                        members: ["architect", "backend", "frontend", "requirements"],
                    },
                    conversationPlan: {
                        stages: [
                            {
                                participants: ["architect", "requirements"],
                                purpose: "Define architecture and requirements",
                                expectedOutcome: "System design and specifications",
                                transitionCriteria: "Design approved",
                            },
                            {
                                participants: ["backend", "frontend"],
                                purpose: "Implementation planning",
                                expectedOutcome: "Development approach defined",
                                transitionCriteria: "Ready to build",
                            },
                        ],
                        estimatedComplexity: 7,
                    },
                    reasoning: "Complex full-stack application requires multiple specialists",
                }),
            });

            const result = await orchestrator.formTeam(request);

            expect(result.team.lead).toBe("architect");
            expect(result.team.members).toHaveLength(4);
            expect(result.team.members).toContain("architect");
            expect(result.team.members).toContain("backend");
            expect(result.team.members).toContain("frontend");
            expect(result.team.members).toContain("requirements");
            expect(result.conversationPlan.stages).toHaveLength(2);
            expect(result.conversationPlan.estimatedComplexity).toBe(7);
        });

        it("should add lead to members if not included", async () => {
            const event = new NDKEvent();
            event.content = "Complex task";
            event.id = "event4";

            const mockProjectEvent = {
                id: "proj1",
                dTag: "proj1",
                title: "Test",
                description: undefined,
                repo: undefined,
                content: "",
            } as unknown as NDKProject;

            const request: TeamFormationRequest = {
                event,
                availableAgents,
                projectEvent: mockProjectEvent,
            };

            // Mock response where lead is not in members
            mockLLM.complete = vi.fn().mockResolvedValue({
                content: JSON.stringify({
                    team: {
                        lead: "architect",
                        members: ["backend", "frontend"],
                    },
                    conversationPlan: {
                        stages: [
                            {
                                participants: ["architect", "backend"],
                                purpose: "Plan",
                                expectedOutcome: "Plan complete",
                                transitionCriteria: "Done",
                            },
                        ],
                        estimatedComplexity: 5,
                    },
                    reasoning: "Team formation",
                }),
            });

            const result = await orchestrator.formTeam(request);

            expect(result.team.members).toContain("architect");
            expect(result.team.members[0]).toBe("architect"); // Should be first
        });
    });

    describe("Prompt Generation", () => {
        it("should emphasize single-agent preference in prompts", async () => {
            const event = new NDKEvent();
            event.content = "Simple request";
            event.id = "event5";

            const mockProjectEvent = {
                id: "proj1",
                dTag: "proj1",
                title: "Test",
                description: undefined,
                repo: undefined,
                content: "",
            } as unknown as NDKProject;

            const request: TeamFormationRequest = {
                event,
                availableAgents,
                projectEvent: mockProjectEvent,
            };

            // Spy on LLM complete to check the prompt
            const completeSpy = vi.fn().mockResolvedValue({
                content: JSON.stringify({
                    team: { lead: "requirements", members: ["requirements"] },
                    conversationPlan: {
                        stages: [
                            {
                                participants: ["requirements"],
                                purpose: "Handle request",
                                expectedOutcome: "Complete",
                                transitionCriteria: "Done",
                            },
                        ],
                        estimatedComplexity: 1,
                    },
                    reasoning: "Simple",
                }),
            });
            mockLLM.complete = completeSpy;

            await orchestrator.formTeam(request);

            // Check that the prompt emphasizes minimal team
            const systemPrompt = completeSpy.mock.calls[0][0].messages[0].content;
            const userPrompt = completeSpy.mock.calls[0][0].messages[1].content;

            expect(systemPrompt).toContain("Always prefer single-agent teams for simple requests");
            expect(userPrompt).toContain("form the MINIMAL team needed");
            expect(userPrompt).toContain("Can a single agent handle this entire request?");
        });
    });
});

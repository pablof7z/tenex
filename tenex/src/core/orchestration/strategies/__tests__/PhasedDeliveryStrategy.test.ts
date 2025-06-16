import { beforeEach, describe, expect, it, vi } from "vitest";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import type { Agent } from "../../../../utils/agents/Agent";
import type { ConversationStorage } from "../../../../utils/agents/ConversationStorage";
import type { Logger } from "../../../../utils/fs";
import { PhasedDeliveryStrategy } from "../PhasedDeliveryStrategy";
import type { Team } from "../../types";

describe("PhasedDeliveryStrategy", () => {
    let strategy: PhasedDeliveryStrategy;
    let mockLogger: Logger;
    let mockConversationStorage: ConversationStorage;

    beforeEach(() => {
        mockLogger = {
            log: vi.fn(),
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        } as Logger;
        
        strategy = new PhasedDeliveryStrategy(mockLogger);
        mockConversationStorage = {} as ConversationStorage;
    });

    it("should have correct name and description", () => {
        expect(strategy.getName()).toBe("PhasedDeliveryStrategy");
        expect(strategy.getDescription()).toBe(
            "Complex tasks are broken into sequential phases with deliverables, each phase building on the previous"
        );
    });

    it("should fail if lead agent is not found", async () => {
        const team: Team = {
            id: "team-123",
            taskDefinition: {
                id: "task-456",
                description: "Build complex feature",
                requiredExpertise: ["frontend", "backend"],
                estimatedComplexity: 8,
            },
            members: ["lead", "frontend", "backend"],
            lead: "lead",
            strategy: "phased_delivery",
            formationReason: "Complex multi-phase feature",
        };

        const event = new NDKEvent();
        event.content = "Build a real-time dashboard with authentication";
        
        const agents = new Map<string, Agent>();

        const result = await strategy.execute(team, event, agents, mockConversationStorage);

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors?.[0].message).toBe("Lead agent lead not found");
    });

    it("should execute phases sequentially with lead coordination", async () => {
        const team: Team = {
            id: "team-123",
            taskDefinition: {
                id: "task-456",
                description: "Build complex feature",
                requiredExpertise: ["frontend", "backend"],
                estimatedComplexity: 8,
            },
            members: ["lead", "frontend", "backend"],
            lead: "lead",
            strategy: "phased_delivery",
            formationReason: "Complex multi-phase feature",
        };

        const event = new NDKEvent();
        event.content = "Build a real-time dashboard with authentication";

        // Mock conversation
        const mockConversation = {
            getId: () => "task-456",
            addUserMessage: vi.fn(),
            addAssistantMessage: vi.fn(),
        };

        // Mock agents
        const mockLeadAgent = {
            getConfig: () => ({ name: "Lead", role: "Phase Coordinator" }),
            getOrCreateConversationWithContext: vi.fn().mockResolvedValue(mockConversation),
            generateResponse: vi.fn()
                .mockResolvedValueOnce({
                    content: "Phase plan: 1) Design 2) Implementation 3) Testing",
                    metadata: {
                        phases: [
                            {
                                name: "Design Phase",
                                description: "Design the dashboard",
                                agents: ["frontend"],
                                deliverables: ["UI mockups", "Architecture"],
                            },
                            {
                                name: "Implementation Phase",
                                description: "Build the components",
                                agents: ["frontend", "backend"],
                                deliverables: ["Dashboard components", "API endpoints"],
                            },
                        ],
                    },
                })
                .mockResolvedValueOnce({
                    content: "Phase 1 complete, ready for implementation",
                    metadata: {},
                })
                .mockResolvedValueOnce({
                    content: "Phase 2 complete, all features implemented",
                    metadata: {},
                })
                .mockResolvedValueOnce({
                    content: "Final integrated dashboard ready with all features",
                    metadata: {},
                }),
            saveConversationToStorage: vi.fn().mockResolvedValue(undefined),
        };

        const mockFrontendAgent = {
            getConfig: () => ({ name: "Frontend", role: "UI Developer" }),
            getOrCreateConversationWithContext: vi.fn().mockResolvedValue({
                getId: () => "task-456-phase1-frontend",
                addUserMessage: vi.fn(),
                addAssistantMessage: vi.fn(),
            }),
            generateResponse: vi.fn()
                .mockResolvedValueOnce({
                    content: "Designed dashboard mockups",
                    metadata: {},
                })
                .mockResolvedValueOnce({
                    content: "Implemented dashboard components",
                    metadata: {},
                }),
        };

        const mockBackendAgent = {
            getConfig: () => ({ name: "Backend", role: "API Developer" }),
            getOrCreateConversationWithContext: vi.fn().mockResolvedValue({
                getId: () => "task-456-phase2-backend",
                addUserMessage: vi.fn(),
                addAssistantMessage: vi.fn(),
            }),
            generateResponse: vi.fn().mockResolvedValue({
                content: "Created API endpoints for real-time data",
                metadata: {},
            }),
        };

        const agents = new Map<string, Agent>([
            ["lead", mockLeadAgent as unknown as Agent],
            ["frontend", mockFrontendAgent as unknown as Agent],
            ["backend", mockBackendAgent as unknown as Agent],
        ]);

        const result = await strategy.execute(team, event, agents, mockConversationStorage);

        expect(result.success).toBe(true);
        expect(result.responses).toHaveLength(7); // 1 plan + 2 phase executions + 2 phase reviews + 1 backend execution + 1 final
        
        // Verify phase plan
        expect(result.responses[0].agentName).toBe("lead");
        expect(result.responses[0].metadata?.phase).toBe("planning");

        // Verify phase executions
        expect(result.responses[1].agentName).toBe("frontend");
        expect(result.responses[1].metadata?.phase).toBe("phase_1");
        expect(result.responses[1].metadata?.phaseName).toBe("Design Phase");

        // Verify final integration
        const finalResponse = result.responses[result.responses.length - 1];
        expect(finalResponse.agentName).toBe("lead");
        expect(finalResponse.metadata?.phase).toBe("final_integration");

        // Verify metadata
        expect(result.metadata?.phaseCount).toBe(2);
        expect(result.metadata?.phases).toHaveLength(2);
        expect(result.metadata?.conversationId).toBe("task-456");
    });

    it("should handle partial failures gracefully", async () => {
        const team: Team = {
            id: "team-123",
            taskDefinition: {
                id: "task-456",
                description: "Build complex feature",
                requiredExpertise: ["frontend", "backend", "database"],
                estimatedComplexity: 9,
            },
            members: ["lead", "frontend", "backend", "database"],
            lead: "lead",
            strategy: "phased_delivery",
            formationReason: "Complex multi-phase feature",
        };

        const event = new NDKEvent();
        event.content = "Build a complex system";

        const mockConversation = {
            getId: () => "task-456",
            addUserMessage: vi.fn(),
            addAssistantMessage: vi.fn(),
        };

        const mockLeadAgent = {
            getConfig: () => ({ name: "Lead", role: "Phase Coordinator" }),
            getOrCreateConversationWithContext: vi.fn().mockResolvedValue(mockConversation),
            generateResponse: vi.fn()
                .mockResolvedValueOnce({
                    content: "Phase plan created",
                    metadata: {},
                })
                .mockResolvedValue({
                    content: "Phase review complete",
                    metadata: {},
                }),
            saveConversationToStorage: vi.fn().mockResolvedValue(undefined),
        };

        const mockFrontendAgent = {
            getConfig: () => ({ name: "Frontend", role: "UI Developer" }),
            getOrCreateConversationWithContext: vi.fn().mockResolvedValue({
                getId: () => "task-456-phase1-frontend",
                addUserMessage: vi.fn(),
                addAssistantMessage: vi.fn(),
            }),
            generateResponse: vi.fn().mockRejectedValue(new Error("Frontend agent failed")),
        };

        const agents = new Map<string, Agent>([
            ["lead", mockLeadAgent as unknown as Agent],
            ["frontend", mockFrontendAgent as unknown as Agent],
            // backend and database agents are missing
        ]);

        const result = await strategy.execute(team, event, agents, mockConversationStorage);

        expect(result.success).toBe(true); // Strategy succeeds despite partial failures
        expect(result.metadata?.partialFailures).toBeDefined();
        expect(result.metadata?.partialFailures).toContain("Agent backend not found");
        expect(result.metadata?.partialFailures).toContain("Agent database not found");
    });

    it("should use default phases when not provided in metadata", async () => {
        const team: Team = {
            id: "team-123",
            taskDefinition: {
                id: "task-456",
                description: "Build complex feature",
                requiredExpertise: ["agent1", "agent2", "agent3"],
                estimatedComplexity: 8,
            },
            members: ["lead", "agent1", "agent2", "agent3"],
            lead: "lead",
            strategy: "phased_delivery",
            formationReason: "Complex multi-phase feature",
        };

        const event = new NDKEvent();
        event.content = "Build something complex";

        const mockConversation = {
            getId: () => "task-456",
            addUserMessage: vi.fn(),
            addAssistantMessage: vi.fn(),
        };

        const mockLeadAgent = {
            getConfig: () => ({ name: "Lead", role: "Phase Coordinator" }),
            getOrCreateConversationWithContext: vi.fn().mockResolvedValue(mockConversation),
            generateResponse: vi.fn().mockResolvedValue({
                content: "Plan created without metadata",
                metadata: {}, // No phases in metadata
            }),
            saveConversationToStorage: vi.fn().mockResolvedValue(undefined),
        };

        const agents = new Map<string, Agent>([
            ["lead", mockLeadAgent as unknown as Agent],
        ]);

        const result = await strategy.execute(team, event, agents, mockConversationStorage);

        expect(result.success).toBe(true);
        expect(result.metadata?.phaseCount).toBe(4); // Default 4 phases
        expect(result.metadata?.phases?.[0].name).toBe("Analysis & Design");
        expect(result.metadata?.phases?.[1].name).toBe("Core Implementation");
        expect(result.metadata?.phases?.[2].name).toBe("Integration & Enhancement");
        expect(result.metadata?.phases?.[3].name).toBe("Testing & Finalization");
    });
});
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Conversation } from "../../../utils/agents/Conversation";
import type { ConversationStorage } from "../../../utils/agents/ConversationStorage";
import type { TeamOrchestrator } from "../../TeamOrchestrator";
import type { EventContext, Team } from "../../types";
import { OrchestrationStrategy } from "../../types";
import { OrchestrationCoordinator } from "../OrchestrationCoordinator";

// Mock factories
function createMockOrchestrator(): ReturnType<typeof vi.mocked<TeamOrchestrator>> {
    return {
        analyzeAndFormTeam: vi.fn(),
    };
}

function createMockConversationStorage(): ReturnType<typeof vi.mocked<ConversationStorage>> {
    return {
        initialize: vi.fn(),
        saveConversation: vi.fn(),
        loadConversation: vi.fn(),
        listConversations: vi.fn(),
        deleteConversation: vi.fn(),
        cleanupOldConversations: vi.fn(),
        markEventProcessed: vi.fn(),
        isEventProcessed: vi.fn(),
        getProcessedEventTimestamp: vi.fn(),
        saveProcessedEvents: vi.fn(),
    };
}

function createTestEvent(content: string): NDKEvent {
    return {
        content,
        id: "test-event-123",
        kind: 11,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        pubkey: "test-pubkey",
    } as NDKEvent;
}

function createTestTeam(): Team {
    return {
        id: "team-123",
        conversationId: "conv-123",
        lead: "frontend-expert",
        members: ["frontend-expert", "backend-engineer"],
        strategy: OrchestrationStrategy.HIERARCHICAL,
        formation: {
            timestamp: Date.now(),
            reasoning: "Test team formation",
            requestAnalysis: {
                requestType: "feature",
                requiredCapabilities: ["frontend", "backend"],
                estimatedComplexity: 5,
                suggestedStrategy: OrchestrationStrategy.HIERARCHICAL,
                reasoning: "Test reasoning",
            },
        },
    };
}

describe("OrchestrationCoordinator", () => {
    let coordinator: OrchestrationCoordinator;
    let mockOrchestrator: ReturnType<typeof createMockOrchestrator>;
    let mockConversationStorage: ReturnType<typeof createMockConversationStorage>;

    beforeEach(() => {
        mockOrchestrator = createMockOrchestrator();
        mockConversationStorage = createMockConversationStorage();

        coordinator = new OrchestrationCoordinator(mockOrchestrator, mockConversationStorage);
    });

    describe("handleUserEvent", () => {
        it("should form a new team when no team exists and no p-tags", async () => {
            // Arrange
            const event = createTestEvent("Build a search feature");
            const context: EventContext = {
                conversationId: "conv-123",
                hasPTags: false,
                availableAgents: new Map([
                    [
                        "frontend-expert",
                        { name: "frontend-expert", role: "UI", description: "", instructions: "" },
                    ],
                    [
                        "backend-engineer",
                        {
                            name: "backend-engineer",
                            role: "API",
                            description: "",
                            instructions: "",
                        },
                    ],
                ]),
                projectContext: { title: "Test Project" },
            };

            const mockTeam = createTestTeam();

            mockConversationStorage.loadConversation.mockResolvedValue(null);
            mockOrchestrator.analyzeAndFormTeam.mockResolvedValue(mockTeam);

            // Act
            const result = await coordinator.handleUserEvent(event, context);

            // Assert
            expect(result.teamFormed).toBe(true);
            expect(result.team).toEqual(mockTeam);
            expect(mockOrchestrator.analyzeAndFormTeam).toHaveBeenCalledWith(
                event,
                context.availableAgents,
                context.projectContext
            );
        });

        it("should use existing team when already formed", async () => {
            // Arrange
            const event = createTestEvent("Add pagination");
            const existingTeam = createTestTeam();
            const context: EventContext = {
                conversationId: "conv-123",
                hasPTags: false,
                availableAgents: new Map(),
                projectContext: { title: "Test Project" },
            };

            mockConversationStorage.loadConversation.mockResolvedValue({
                id: "conv-123",
                agentName: "orchestrator",
                messages: [],
                metadata: { team: existingTeam },
                createdAt: Date.now(),
                lastActivityAt: Date.now(),
            });

            // Act
            const result = await coordinator.handleUserEvent(event, context);

            // Assert
            expect(result.teamFormed).toBe(false);
            expect(result.team).toEqual(existingTeam);
            expect(mockOrchestrator.analyzeAndFormTeam).not.toHaveBeenCalled();
        });

        it("should not form team when p-tags exist", async () => {
            // Arrange
            const event = createTestEvent("Fix this bug");
            const context: EventContext = {
                conversationId: "conv-123",
                hasPTags: true, // Has p-tags
                availableAgents: new Map(),
                projectContext: { title: "Test Project" },
            };

            mockConversationStorage.loadConversation.mockResolvedValue(null);

            // Act
            const result = await coordinator.handleUserEvent(event, context);

            // Assert
            expect(result.teamFormed).toBe(false);
            expect(result.team).toBeUndefined();
            expect(mockOrchestrator.analyzeAndFormTeam).not.toHaveBeenCalled();
        });

        it("should save conversation with team metadata after formation", async () => {
            // Arrange
            const event = createTestEvent("Create API endpoint");
            const context: EventContext = {
                conversationId: "conv-123",
                hasPTags: false,
                availableAgents: new Map([
                    [
                        "backend-engineer",
                        {
                            name: "backend-engineer",
                            role: "API",
                            description: "",
                            instructions: "",
                        },
                    ],
                ]),
                projectContext: { title: "API Project" },
            };

            const mockTeam = createTestTeam();
            mockConversationStorage.loadConversation.mockResolvedValue(null);
            mockOrchestrator.analyzeAndFormTeam.mockResolvedValue(mockTeam);

            // Act
            await coordinator.handleUserEvent(event, context);

            // Assert
            expect(mockConversationStorage.saveConversation).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: "conv-123",
                    metadata: expect.objectContaining({
                        team: mockTeam,
                    }),
                })
            );
        });

        it("should handle orchestration errors gracefully", async () => {
            // Arrange
            const event = createTestEvent("Do something complex");
            const context: EventContext = {
                conversationId: "conv-123",
                hasPTags: false,
                availableAgents: new Map(),
                projectContext: {},
            };

            mockConversationStorage.loadConversation.mockResolvedValue(null);
            mockOrchestrator.analyzeAndFormTeam.mockRejectedValue(
                new Error("Orchestration failed")
            );

            // Act & Assert
            await expect(coordinator.handleUserEvent(event, context)).rejects.toThrow(
                "Orchestration failed"
            );
        });
    });

    describe("getTeamForConversation", () => {
        it("should return team from conversation metadata", async () => {
            // Arrange
            const existingTeam = createTestTeam();
            mockConversationStorage.loadConversation.mockResolvedValue({
                id: "conv-123",
                agentName: "orchestrator",
                messages: [],
                metadata: { team: existingTeam },
                createdAt: Date.now(),
                lastActivityAt: Date.now(),
            });

            // Act
            const team = await coordinator.getTeamForConversation("conv-123");

            // Assert
            expect(team).toEqual(existingTeam);
        });

        it("should return undefined when no team exists", async () => {
            // Arrange
            mockConversationStorage.loadConversation.mockResolvedValue({
                id: "conv-123",
                agentName: "orchestrator",
                messages: [],
                createdAt: Date.now(),
                lastActivityAt: Date.now(),
            });

            // Act
            const team = await coordinator.getTeamForConversation("conv-123");

            // Assert
            expect(team).toBeUndefined();
        });
    });
});

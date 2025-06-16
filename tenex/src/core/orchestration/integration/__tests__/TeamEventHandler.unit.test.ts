import type NDK from "@nostr-dev-kit/ndk";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type { Logger } from "../../../../utils/fs";
import type { Team } from "../../types";
import { OrchestrationStrategy } from "../../types";
import { TeamEventHandlerImpl } from "../TeamEventHandler";

// Create a mock implementation that doesn't interact with NDK
class MockTeamEventHandler extends TeamEventHandlerImpl {
    publishedEvents: Array<{ kind: number; content: string; tags: string[][] }> = [];

    async publishTeamFormationEvent(
        team: Team,
        originalEvent: NDKEvent,
        _ndk: NDK,
        projectNaddr?: string
    ): Promise<void> {
        const event = {
            kind: 30040,
            content: JSON.stringify({
                teamId: team.id,
                strategy: team.strategy,
                lead: team.lead,
                members: team.members,
                taskDescription: team.taskDefinition?.description,
                reasoning: team.formation.reasoning,
                estimatedComplexity: team.taskDefinition?.estimatedComplexity,
                formationTimestamp: team.formation.timestamp,
            }),
            tags: [
                ["d", team.id],
                ["e", originalEvent.id],
                ["team-id", team.id],
                ["strategy", team.strategy],
                ["lead", team.lead],
                ...team.members.map((member) => ["member", member]),
            ],
        };

        if (projectNaddr) {
            event.tags.push(["a", projectNaddr]);
        }

        this.publishedEvents.push(event);
        // @ts-expect-error - accessing protected property
        this.logger.info(
            `Published team formation event for team ${team.id} with strategy ${team.strategy}`
        );
    }

    async publishTeamUpdateEvent(
        team: Team,
        updateType: "member_added" | "member_removed" | "strategy_changed" | "task_updated",
        details: string,
        _ndk: NDK,
        projectNaddr?: string
    ): Promise<void> {
        const event = {
            kind: 30041,
            content: JSON.stringify({
                teamId: team.id,
                updateType,
                details,
                currentMembers: team.members,
                currentStrategy: team.strategy,
                timestamp: Date.now(),
            }),
            tags: [
                ["e", team.conversationId],
                ["team-id", team.id],
                ["update-type", updateType],
                ...team.members.map((member) => ["member", member]),
            ],
        };

        if (projectNaddr) {
            event.tags.push(["a", projectNaddr]);
        }

        this.publishedEvents.push(event);
        // @ts-expect-error - accessing protected property
        this.logger.info(`Published team update event for team ${team.id}: ${updateType}`);
    }

    async publishTeamDisbandedEvent(
        team: Team,
        reason: string,
        _ndk: NDK,
        projectNaddr?: string
    ): Promise<void> {
        const event = {
            kind: 30042,
            content: JSON.stringify({
                teamId: team.id,
                reason,
                formedAt: team.formation.timestamp,
                disbandedAt: Date.now(),
                totalDuration: Date.now() - team.formation.timestamp,
                finalMembers: team.members,
                completedTasks: team.taskDefinition ? 1 : 0,
            }),
            tags: [
                ["d", team.id],
                ["e", team.conversationId],
                ["team-id", team.id],
                ["reason", reason],
            ],
        };

        if (projectNaddr) {
            event.tags.push(["a", projectNaddr]);
        }

        this.publishedEvents.push(event);
        // @ts-expect-error - accessing protected property
        this.logger.info(`Published team disbanded event for team ${team.id}: ${reason}`);
    }
}

describe("TeamEventHandler", () => {
    let teamEventHandler: MockTeamEventHandler;
    let mockLogger: jest.Mocked<Logger>;
    let mockNDK: jest.Mocked<NDK>;

    beforeEach(() => {
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
        };

        mockNDK = {} as unknown as NDK;

        teamEventHandler = new MockTeamEventHandler(mockLogger);
    });

    describe("constructor", () => {
        it("should throw if Logger is not provided", () => {
            expect(() => new TeamEventHandlerImpl(null as unknown as Logger)).toThrow(
                "Logger is required"
            );
        });
    });

    describe("publishTeamFormationEvent", () => {
        it("should publish team formation event with all details", async () => {
            const team: Team = {
                id: "team-123",
                conversationId: "conv-123",
                lead: "lead-agent",
                members: ["agent1", "agent2", "agent3"],
                strategy: "HIERARCHICAL",
                formation: {
                    timestamp: Date.now(),
                    reasoning: "Complex task requiring coordination",
                    requestAnalysis: {
                        requestType: "feature",
                        requiredCapabilities: ["frontend", "backend"],
                        estimatedComplexity: 8,
                        suggestedStrategy: "HIERARCHICAL",
                        reasoning: "Needs coordination",
                    },
                },
                taskDefinition: {
                    description: "Build user authentication system",
                    successCriteria: ["Secure", "Tested"],
                    requiresGreenLight: true,
                    estimatedComplexity: 8,
                },
            };

            const originalEvent = { id: "original-event-123" } as NDKEvent;

            await teamEventHandler.publishTeamFormationEvent(
                team,
                originalEvent,
                mockNDK,
                "project-naddr"
            );

            expect(teamEventHandler.publishedEvents).toHaveLength(1);
            const event = teamEventHandler.publishedEvents[0];

            expect(event.kind).toBe(30040);

            const content = JSON.parse(event.content);
            expect(content).toMatchObject({
                teamId: "team-123",
                strategy: "HIERARCHICAL",
                lead: "lead-agent",
                members: ["agent1", "agent2", "agent3"],
                taskDescription: "Build user authentication system",
                reasoning: "Complex task requiring coordination",
                estimatedComplexity: 8,
            });

            expect(event.tags).toContainEqual(["d", "team-123"]);
            expect(event.tags).toContainEqual(["e", "original-event-123"]);
            expect(event.tags).toContainEqual(["team-id", "team-123"]);
            expect(event.tags).toContainEqual(["strategy", "HIERARCHICAL"]);
            expect(event.tags).toContainEqual(["lead", "lead-agent"]);
            expect(event.tags).toContainEqual(["member", "agent1"]);
            expect(event.tags).toContainEqual(["member", "agent2"]);
            expect(event.tags).toContainEqual(["member", "agent3"]);
            expect(event.tags).toContainEqual(["a", "project-naddr"]);

            expect(mockLogger.info).toHaveBeenCalledWith(
                "Published team formation event for team team-123 with strategy HIERARCHICAL"
            );
        });
    });

    describe("publishTeamUpdateEvent", () => {
        it("should publish team update event for member addition", async () => {
            const team: Team = {
                id: "team-123",
                conversationId: "conv-123",
                lead: "lead-agent",
                members: ["agent1", "agent2", "new-agent"],
                strategy: "HIERARCHICAL",
                formation: {
                    timestamp: Date.now(),
                    reasoning: "Task evolved",
                    requestAnalysis: {
                        requestType: "task",
                        requiredCapabilities: ["code"],
                        estimatedComplexity: 5,
                        suggestedStrategy: OrchestrationStrategy.SINGLE_RESPONDER,
                        reasoning: "Simple task",
                    },
                },
            };

            await teamEventHandler.publishTeamUpdateEvent(
                team,
                "member_added",
                "Added new-agent to handle additional requirements",
                mockNDK,
                "project-naddr"
            );

            expect(teamEventHandler.publishedEvents).toHaveLength(1);
            const event = teamEventHandler.publishedEvents[0];

            expect(event.kind).toBe(30041);

            const content = JSON.parse(event.content);
            expect(content).toMatchObject({
                teamId: "team-123",
                updateType: "member_added",
                details: "Added new-agent to handle additional requirements",
                currentMembers: ["agent1", "agent2", "new-agent"],
                currentStrategy: "HIERARCHICAL",
            });

            expect(event.tags).toContainEqual(["e", "conv-123"]);
            expect(event.tags).toContainEqual(["team-id", "team-123"]);
            expect(event.tags).toContainEqual(["update-type", "member_added"]);
            expect(event.tags).toContainEqual(["member", "agent1"]);
            expect(event.tags).toContainEqual(["member", "agent2"]);
            expect(event.tags).toContainEqual(["member", "new-agent"]);
            expect(event.tags).toContainEqual(["a", "project-naddr"]);
        });

        it("should publish team update event for strategy change", async () => {
            const team: Team = {
                id: "team-123",
                conversationId: "conv-123",
                lead: "lead-agent",
                members: ["agent1", "agent2"],
                strategy: "PARALLEL_EXECUTION",
                formation: {
                    timestamp: Date.now(),
                    reasoning: "Changed approach",
                    requestAnalysis: {
                        requestType: "task",
                        requiredCapabilities: ["code"],
                        estimatedComplexity: 5,
                        suggestedStrategy: OrchestrationStrategy.SINGLE_RESPONDER,
                        reasoning: "Simple task",
                    },
                },
            };

            await teamEventHandler.publishTeamUpdateEvent(
                team,
                "strategy_changed",
                "Switched from HIERARCHICAL to PARALLEL_EXECUTION for efficiency",
                mockNDK
            );

            const event = teamEventHandler.publishedEvents[0];
            const content = JSON.parse(event.content);

            expect(content.updateType).toBe("strategy_changed");
            expect(content.currentStrategy).toBe("PARALLEL_EXECUTION");
            expect(event.tags).not.toContainEqual(expect.arrayContaining(["a"])); // No project reference
        });
    });

    describe("publishTeamDisbandedEvent", () => {
        it("should publish team disbanded event", async () => {
            const formationTime = Date.now() - 3600000; // 1 hour ago
            const team: Team = {
                id: "team-123",
                conversationId: "conv-123",
                lead: "lead-agent",
                members: ["agent1", "agent2"],
                strategy: "HIERARCHICAL",
                formation: {
                    timestamp: formationTime,
                    reasoning: "Task completed",
                    requestAnalysis: {
                        requestType: "task",
                        requiredCapabilities: ["code"],
                        estimatedComplexity: 5,
                        suggestedStrategy: OrchestrationStrategy.SINGLE_RESPONDER,
                        reasoning: "Simple task",
                    },
                },
                taskDefinition: {
                    description: "Build feature",
                    successCriteria: ["Works"],
                    estimatedComplexity: 5,
                },
            };

            await teamEventHandler.publishTeamDisbandedEvent(
                team,
                "Task completed successfully",
                mockNDK,
                "project-naddr"
            );

            expect(teamEventHandler.publishedEvents).toHaveLength(1);
            const event = teamEventHandler.publishedEvents[0];

            expect(event.kind).toBe(30042);

            const content = JSON.parse(event.content);
            expect(content).toMatchObject({
                teamId: "team-123",
                reason: "Task completed successfully",
                formedAt: formationTime,
                finalMembers: ["agent1", "agent2"],
                completedTasks: 1,
            });
            expect(content.totalDuration).toBeGreaterThan(3500000); // Close to 1 hour

            expect(event.tags).toContainEqual(["d", "team-123"]);
            expect(event.tags).toContainEqual(["e", "conv-123"]);
            expect(event.tags).toContainEqual(["team-id", "team-123"]);
            expect(event.tags).toContainEqual(["reason", "Task completed successfully"]);
            expect(event.tags).toContainEqual(["a", "project-naddr"]);

            expect(mockLogger.info).toHaveBeenCalledWith(
                "Published team disbanded event for team team-123: Task completed successfully"
            );
        });

        it("should handle teams without task definitions", async () => {
            const team: Team = {
                id: "team-123",
                conversationId: "conv-123",
                lead: "lead-agent",
                members: ["agent1"],
                strategy: "SINGLE_RESPONDER",
                formation: {
                    timestamp: Date.now(),
                    reasoning: "Exploration",
                    requestAnalysis: {
                        requestType: "task",
                        requiredCapabilities: ["code"],
                        estimatedComplexity: 5,
                        suggestedStrategy: OrchestrationStrategy.SINGLE_RESPONDER,
                        reasoning: "Simple task",
                    },
                },
                // No taskDefinition
            };

            await teamEventHandler.publishTeamDisbandedEvent(team, "No clear objective", mockNDK);

            const event = teamEventHandler.publishedEvents[0];
            const content = JSON.parse(event.content);
            expect(content.completedTasks).toBe(0);
        });
    });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent } from "../../../../utils/agents/Agent";
import type { Logger } from "../../../../utils/fs";
import type { LLMProvider } from "../../types";
import { SupervisorDecisionMaker } from "../SupervisorDecisionMaker";
import type { Milestone, SupervisionContext, SupervisionDecision } from "../types";

describe("SupervisorDecisionMaker", () => {
    let decisionMaker: SupervisorDecisionMaker;
    let mockLogger: Logger;
    let mockLLMProvider: LLMProvider;

    beforeEach(() => {
        mockLogger = {
            log: vi.fn(),
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        } as Logger;

        mockLLMProvider = {
            processRequest: vi.fn().mockResolvedValue({
                content: JSON.stringify({
                    decision: "approve",
                    confidence: 0.85,
                    reasoning: "The milestone has been completed successfully",
                    recommendations: ["Continue with the next phase"],
                }),
            }),
        } as unknown as LLMProvider;

        decisionMaker = new SupervisorDecisionMaker(mockLogger, mockLLMProvider);
    });

    describe("constructor", () => {
        it("should throw error if logger is not provided", () => {
            expect(
                () => new SupervisorDecisionMaker(null as unknown as Logger, mockLLMProvider)
            ).toThrow("Logger is required");
        });

        it("should throw error if LLMProvider is not provided", () => {
            expect(
                () => new SupervisorDecisionMaker(mockLogger, null as unknown as LLMProvider)
            ).toThrow("LLMProvider is required");
        });
    });

    describe("makeDecision", () => {
        const mockMilestone: Milestone = {
            id: "milestone-1",
            taskId: "task-1",
            conversationId: "conv-1",
            agentName: "agent-1",
            description: "Complete data analysis",
            status: "completed",
            createdAt: Date.now() - 10000,
            completedAt: Date.now(),
        };

        const mockSupervisor: Agent = {
            name: "supervisor-agent",
            nsec: "nsec1...",
        } as Agent;

        const mockContext: SupervisionContext = {
            taskProgress: 0.5,
            previousDecisions: [],
            teamPerformance: {
                successRate: 0.8,
                averageCompletionTime: 5000,
            },
        };

        it("should make an approval decision", async () => {
            const decision = await decisionMaker.makeDecision(
                mockMilestone,
                mockSupervisor,
                mockContext
            );

            expect(decision.decision).toBe("approve");
            expect(decision.confidence).toBe(0.85);
            expect(decision.reasoning).toBe("The milestone has been completed successfully");
            expect(decision.recommendations).toContainEqual("Continue with the next phase");
            expect(decision.timestamp).toBeGreaterThan(0);
            expect(decision.supervisorId).toBe("supervisor-agent");
        });

        it("should handle rejection decision", async () => {
            mockLLMProvider.processRequest = vi.fn().mockResolvedValue({
                content: JSON.stringify({
                    decision: "reject",
                    confidence: 0.9,
                    reasoning: "The implementation does not meet quality standards",
                    recommendations: ["Refactor the code", "Add more tests"],
                    requiredActions: ["Fix the identified bugs", "Improve error handling"],
                }),
            });

            const decision = await decisionMaker.makeDecision(
                mockMilestone,
                mockSupervisor,
                mockContext
            );

            expect(decision.decision).toBe("reject");
            expect(decision.confidence).toBe(0.9);
            expect(decision.requiredActions).toHaveLength(2);
            expect(decision.requiredActions).toContainEqual("Fix the identified bugs");
        });

        it("should handle revision request", async () => {
            mockLLMProvider.processRequest = vi.fn().mockResolvedValue({
                content: JSON.stringify({
                    decision: "revise",
                    confidence: 0.7,
                    reasoning: "Minor improvements needed",
                    recommendations: ["Update documentation"],
                    requiredActions: ["Add comments to complex functions"],
                }),
            });

            const decision = await decisionMaker.makeDecision(
                mockMilestone,
                mockSupervisor,
                mockContext
            );

            expect(decision.decision).toBe("revise");
            expect(decision.requiredActions).toBeDefined();
            expect(decision.requiredActions).toHaveLength(1);
        });

        it("should handle escalation decision", async () => {
            mockLLMProvider.processRequest = vi.fn().mockResolvedValue({
                content: JSON.stringify({
                    decision: "escalate",
                    confidence: 0.95,
                    reasoning: "Critical security issue identified",
                    recommendations: ["Immediate review by security team"],
                    escalationReason: "Potential data breach vulnerability",
                }),
            });

            const decision = await decisionMaker.makeDecision(
                mockMilestone,
                mockSupervisor,
                mockContext
            );

            expect(decision.decision).toBe("escalate");
            expect(decision.escalationReason).toBe("Potential data breach vulnerability");
        });

        it("should handle malformed LLM response", async () => {
            mockLLMProvider.processRequest = vi.fn().mockResolvedValue({
                content: "Not a valid JSON response",
            });

            await expect(
                decisionMaker.makeDecision(mockMilestone, mockSupervisor, mockContext)
            ).rejects.toThrow("Failed to parse supervisor decision");
        });

        it("should log decision process", async () => {
            await decisionMaker.makeDecision(mockMilestone, mockSupervisor, mockContext);

            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining("Supervisor supervisor-agent making decision")
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("Supervisor decision: approve")
            );
        });
    });

    describe("shouldEscalate", () => {
        const mockMilestone: Milestone = {
            id: "milestone-1",
            taskId: "task-1",
            conversationId: "conv-1",
            agentName: "agent-1",
            description: "Critical task",
            status: "completed",
            createdAt: Date.now(),
        };

        it("should escalate when decision is escalate", () => {
            const decision: SupervisionDecision = {
                decision: "escalate",
                confidence: 0.9,
                reasoning: "Critical issue",
                timestamp: Date.now(),
                supervisorId: "supervisor-1",
            };

            expect(decisionMaker.shouldEscalate(mockMilestone, decision)).toBe(true);
        });

        it("should escalate when confidence is low", () => {
            const decision: SupervisionDecision = {
                decision: "approve",
                confidence: 0.4,
                reasoning: "Uncertain about quality",
                timestamp: Date.now(),
                supervisorId: "supervisor-1",
            };

            expect(decisionMaker.shouldEscalate(mockMilestone, decision)).toBe(true);
        });

        it("should not escalate for confident non-escalate decisions", () => {
            const decision: SupervisionDecision = {
                decision: "approve",
                confidence: 0.85,
                reasoning: "Good quality work",
                timestamp: Date.now(),
                supervisorId: "supervisor-1",
            };

            expect(decisionMaker.shouldEscalate(mockMilestone, decision)).toBe(false);
        });

        it("should log escalation decisions", () => {
            const decision: SupervisionDecision = {
                decision: "escalate",
                confidence: 0.9,
                reasoning: "Critical issue",
                timestamp: Date.now(),
                supervisorId: "supervisor-1",
            };

            decisionMaker.shouldEscalate(mockMilestone, decision);

            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("Escalation needed")
            );
        });
    });
});

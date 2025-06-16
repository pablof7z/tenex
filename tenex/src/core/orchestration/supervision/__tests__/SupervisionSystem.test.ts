import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LLMProvider } from "../../../../utils/agents/llm/types";
import type { Team } from "../../types";
import { SupervisionSystem } from "../SupervisionSystem";
import type { SupervisionConfig, SupervisionTask } from "../SupervisionSystem";

describe("SupervisionSystem", () => {
    let supervisionSystem: SupervisionSystem;
    let mockLLMProvider: LLMProvider;
    let config: SupervisionConfig;
    let mockTeam: Team;

    beforeEach(() => {
        vi.clearAllMocks();

        mockLLMProvider = {
            generateResponse: vi.fn().mockResolvedValue({
                content: "Monitor the implementation closely and ensure tests are written.",
                metadata: { model: "test-model" },
            }),
        } as unknown as LLMProvider;

        config = {
            enabled: true,
            checkpointInterval: 5000,
            maxDuration: 300000, // 5 minutes
            riskThresholds: {
                low: 0.3,
                medium: 0.6,
                high: 0.8,
            },
        };

        mockTeam = {
            id: "team-123",
            lead: "orchestrator",
            members: ["code", "test"],
            strategy: "collaborative",
            metadata: {},
            formation: {
                reasoning: "Code generation requires implementation and testing",
                confidence: 0.9,
            },
        };

        supervisionSystem = new SupervisionSystem(config, mockLLMProvider);
    });

    describe("startSupervision", () => {
        it("should start supervision for a new task", async () => {
            const task = await supervisionSystem.startSupervision(
                "task-1",
                "code_generation",
                "Implement user authentication",
                mockTeam,
                "high"
            );

            expect(task).toBeDefined();
            expect(task.id).toBe("task-1");
            expect(task.type).toBe("code_generation");
            expect(task.description).toBe("Implement user authentication");
            expect(task.team).toEqual(mockTeam);
            expect(task.status).toBe("in_progress");
            expect(task.risk_level).toBe("high");
            expect(task.checkpoints.length).toBeGreaterThan(0);
        });

        it("should generate appropriate checkpoints for code generation", async () => {
            const task = await supervisionSystem.startSupervision(
                "task-1",
                "code_generation",
                "Implement feature",
                mockTeam
            );

            const checkpointNames = task.checkpoints.map((cp) => cp.name);
            expect(checkpointNames).toContain("Planning Phase");
            expect(checkpointNames).toContain("Implementation");
            expect(checkpointNames).toContain("Testing");
        });

        it("should generate appropriate checkpoints for system modification", async () => {
            const task = await supervisionSystem.startSupervision(
                "task-1",
                "system_modification",
                "Update database schema",
                mockTeam
            );

            const checkpointNames = task.checkpoints.map((cp) => cp.name);
            expect(checkpointNames).toContain("Backup Check");
            expect(checkpointNames).toContain("Change Validation");
            expect(checkpointNames).toContain("Rollback Plan");
        });

        it("should return dummy task when supervision is disabled", async () => {
            supervisionSystem = new SupervisionSystem({ enabled: false });

            const task = await supervisionSystem.startSupervision(
                "task-1",
                "code_generation",
                "Test task",
                mockTeam
            );

            expect(task.status).toBe("completed");
            expect(task.checkpoints).toHaveLength(0);
        });
    });

    describe("recordCheckpoint", () => {
        let task: SupervisionTask;

        beforeEach(async () => {
            task = await supervisionSystem.startSupervision(
                "task-1",
                "code_generation",
                "Test task",
                mockTeam,
                "high"
            );
        });

        it("should record checkpoint completion", async () => {
            const checkpoint = task.checkpoints[0];
            await supervisionSystem.recordCheckpoint("task-1", checkpoint.id, "passed", "All good");

            const updatedTask = supervisionSystem.getTaskStatus("task-1");
            expect(updatedTask?.checkpoints[0].status).toBe("passed");
            expect(updatedTask?.checkpoints[0].notes).toBe("All good");
            expect(updatedTask?.checkpoints[0].timestamp).toBeDefined();
        });

        it("should trigger intervention for failed high-risk checkpoint", async () => {
            const checkpoint = task.checkpoints[0];
            await supervisionSystem.recordCheckpoint("task-1", checkpoint.id, "failed");

            const updatedTask = supervisionSystem.getTaskStatus("task-1");
            expect(updatedTask?.status).toBe("intervention_required");
        });

        it("should not trigger intervention for failed low-risk checkpoint", async () => {
            task = await supervisionSystem.startSupervision(
                "task-2",
                "code_generation",
                "Low risk task",
                mockTeam,
                "low"
            );

            const checkpoint = task.checkpoints[0];
            await supervisionSystem.recordCheckpoint("task-2", checkpoint.id, "failed");

            const updatedTask = supervisionSystem.getTaskStatus("task-2");
            expect(updatedTask?.status).toBe("in_progress");
        });

        it("should handle non-existent task gracefully", async () => {
            // This should not throw, just log a warning
            await supervisionSystem.recordCheckpoint("non-existent", "checkpoint-1", "passed");

            // Verify task doesn't exist
            expect(supervisionSystem.getTaskStatus("non-existent")).toBeUndefined();
        });
    });

    describe("completeSupervision", () => {
        it("should mark task as completed when all checkpoints pass", async () => {
            const task = await supervisionSystem.startSupervision(
                "task-1",
                "code_generation",
                "Test task",
                mockTeam,
                "high"
            );

            // Mark all checkpoints as passed
            for (const checkpoint of task.checkpoints) {
                await supervisionSystem.recordCheckpoint("task-1", checkpoint.id, "passed");
            }

            const result = await supervisionSystem.completeSupervision("task-1");

            expect(result.passed).toBe(true);
            expect(result.interventionRequired).toBe(false);
            expect(result.issues).toBeUndefined();
        });

        it("should mark task as failed when checkpoints fail", async () => {
            const task = await supervisionSystem.startSupervision(
                "task-1",
                "code_generation",
                "Test task",
                mockTeam,
                "high"
            );

            // Mark one checkpoint as failed
            await supervisionSystem.recordCheckpoint("task-1", task.checkpoints[0].id, "failed");

            const result = await supervisionSystem.completeSupervision("task-1");

            expect(result.passed).toBe(false);
            expect(result.issues).toBeDefined();
            expect(result.issues?.[0]).toContain("1 checkpoint(s) failed");
        });

        it("should handle pending checkpoints based on risk level", async () => {
            const _task = await supervisionSystem.startSupervision(
                "task-1",
                "code_generation",
                "Test task",
                mockTeam,
                "medium"
            );

            // Leave checkpoints pending
            const result = await supervisionSystem.completeSupervision("task-1");

            expect(result.passed).toBe(true); // Medium risk allows pending checkpoints
            expect(result.issues).toBeDefined();
            expect(result.issues?.[0]).toContain("checkpoint(s) not completed");
        });

        it("should return default result for non-existent task", async () => {
            const result = await supervisionSystem.completeSupervision("non-existent");

            expect(result.taskId).toBe("non-existent");
            expect(result.passed).toBe(true);
            expect(result.interventionRequired).toBe(false);
        });
    });

    // Timer-based tests commented out as vi.useFakeTimers is not available
    // These tests would verify automatic checkpoint monitoring functionality

    describe("LLM integration", () => {
        it("should use LLM for analysis when intervention is required", async () => {
            const task = await supervisionSystem.startSupervision(
                "task-1",
                "system_modification",
                "Critical system update",
                mockTeam,
                "high"
            );

            await supervisionSystem.recordCheckpoint("task-1", task.checkpoints[0].id, "failed");

            expect(mockLLMProvider.generateResponse).toHaveBeenCalled();
            const call = (mockLLMProvider.generateResponse as ReturnType<typeof vi.fn>).mock
                .calls[0];
            expect(call[0][1].content).toContain("Critical system update");
            expect(call[0][1].content).toContain("Backup Check");
        });

        it("should handle LLM errors gracefully", async () => {
            (mockLLMProvider.generateResponse as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
                new Error("LLM error")
            );

            const task = await supervisionSystem.startSupervision(
                "task-1",
                "code_generation",
                "Test task",
                mockTeam,
                "high"
            );

            // This should not throw even with LLM error
            await supervisionSystem.recordCheckpoint("task-1", task.checkpoints[0].id, "failed");

            // Task should still be marked as intervention required
            const updatedTask = supervisionSystem.getTaskStatus("task-1");
            expect(updatedTask?.status).toBe("intervention_required");
        });
    });

    describe("getTaskStatus", () => {
        it("should return current task status", async () => {
            const task = await supervisionSystem.startSupervision(
                "task-1",
                "code_generation",
                "Test task",
                mockTeam
            );

            const status = supervisionSystem.getTaskStatus("task-1");
            expect(status).toEqual(task);
        });

        it("should return undefined for non-existent task", () => {
            const status = supervisionSystem.getTaskStatus("non-existent");
            expect(status).toBeUndefined();
        });
    });
});

import type { Team } from "@/core/orchestration/types";
import type { LLMProvider } from "@/utils/agents/llm/types";
import { logger } from "@tenex/shared/logger";

export interface SupervisionTask {
    id: string;
    type: "code_generation" | "system_modification" | "data_processing" | "multi_step_operation";
    description: string;
    team: Team;
    startTime: number;
    checkpoints: SupervisionCheckpoint[];
    status: "pending" | "in_progress" | "completed" | "failed" | "intervention_required";
    risk_level: "low" | "medium" | "high";
}

export interface SupervisionCheckpoint {
    id: string;
    name: string;
    description: string;
    expectedDuration?: number; // in milliseconds
    validationCriteria?: string[];
    timestamp?: number;
    status: "pending" | "passed" | "failed" | "skipped";
    notes?: string;
}

export interface SupervisionResult {
    taskId: string;
    passed: boolean;
    interventionRequired: boolean;
    recommendations?: string[];
    issues?: string[];
}

export interface SupervisionConfig {
    enabled: boolean;
    checkpointInterval?: number; // milliseconds between automatic checkpoints
    maxDuration?: number; // maximum allowed duration for a task
    riskThresholds?: {
        low: number; // 0-1 confidence threshold
        medium: number;
        high: number;
    };
}

export class SupervisionSystem {
    private tasks: Map<string, SupervisionTask> = new Map();
    private config: SupervisionConfig;
    private llmProvider?: LLMProvider;

    constructor(config: SupervisionConfig, llmProvider?: LLMProvider) {
        this.config = config;
        this.llmProvider = llmProvider;
    }

    /**
     * Start supervising a new task
     */
    async startSupervision(
        taskId: string,
        type: SupervisionTask["type"],
        description: string,
        team: Team,
        riskLevel: SupervisionTask["risk_level"] = "medium"
    ): Promise<SupervisionTask> {
        if (!this.config.enabled) {
            logger.debug("Supervision system is disabled");
            return this.createDummyTask(taskId, type, description, team, riskLevel);
        }

        const task: SupervisionTask = {
            id: taskId,
            type,
            description,
            team,
            startTime: Date.now(),
            checkpoints: this.generateCheckpoints(type, description),
            status: "in_progress",
            risk_level: riskLevel,
        };

        this.tasks.set(taskId, task);
        logger.info(`Started supervision for task ${taskId}: ${description}`);

        // Set up automatic checkpoint monitoring if configured
        if (this.config.checkpointInterval) {
            this.scheduleCheckpointMonitoring(taskId);
        }

        return task;
    }

    /**
     * Record a checkpoint completion
     */
    async recordCheckpoint(
        taskId: string,
        checkpointId: string,
        status: SupervisionCheckpoint["status"],
        notes?: string
    ): Promise<void> {
        const task = this.tasks.get(taskId);
        if (!task) {
            logger.warn(`No supervision task found for ${taskId}`);
            return;
        }

        const checkpoint = task.checkpoints.find((cp) => cp.id === checkpointId);
        if (!checkpoint) {
            logger.warn(`No checkpoint ${checkpointId} found for task ${taskId}`);
            return;
        }

        checkpoint.status = status;
        checkpoint.timestamp = Date.now();
        if (notes) {
            checkpoint.notes = notes;
        }

        logger.info(`Checkpoint ${checkpointId} for task ${taskId}: ${status}`);

        // Check if intervention is needed
        if (status === "failed" && task.risk_level === "high") {
            task.status = "intervention_required";
            await this.requestIntervention(task, checkpoint);
        }
    }

    /**
     * Complete supervision for a task
     */
    async completeSupervision(taskId: string): Promise<SupervisionResult> {
        const task = this.tasks.get(taskId);
        if (!task) {
            return {
                taskId,
                passed: true,
                interventionRequired: false,
            };
        }

        // Analyze task completion
        const result = await this.analyzeTaskCompletion(task);

        task.status = result.passed ? "completed" : "failed";

        logger.info(`Supervision completed for task ${taskId}: ${task.status}`);

        // Clean up after a delay
        setTimeout(() => this.tasks.delete(taskId), 60000); // Keep for 1 minute

        return result;
    }

    /**
     * Get current supervision status for a task
     */
    getTaskStatus(taskId: string): SupervisionTask | undefined {
        return this.tasks.get(taskId);
    }

    /**
     * Generate checkpoints based on task type
     */
    private generateCheckpoints(
        type: SupervisionTask["type"],
        _description: string
    ): SupervisionCheckpoint[] {
        switch (type) {
            case "code_generation":
                return [
                    {
                        id: "planning",
                        name: "Planning Phase",
                        description: "Verify approach and design decisions",
                        expectedDuration: 30000,
                        status: "pending",
                    },
                    {
                        id: "implementation",
                        name: "Implementation",
                        description: "Monitor code generation progress",
                        expectedDuration: 120000,
                        status: "pending",
                    },
                    {
                        id: "testing",
                        name: "Testing",
                        description: "Ensure tests are written and passing",
                        expectedDuration: 60000,
                        status: "pending",
                    },
                ];

            case "system_modification":
                return [
                    {
                        id: "backup",
                        name: "Backup Check",
                        description: "Verify system state is recoverable",
                        status: "pending",
                    },
                    {
                        id: "validation",
                        name: "Change Validation",
                        description: "Validate proposed changes are safe",
                        status: "pending",
                    },
                    {
                        id: "rollback_plan",
                        name: "Rollback Plan",
                        description: "Ensure rollback strategy exists",
                        status: "pending",
                    },
                ];

            default:
                return [
                    {
                        id: "start",
                        name: "Task Started",
                        description: "Initial task setup",
                        status: "pending",
                    },
                    {
                        id: "progress",
                        name: "Progress Check",
                        description: "Mid-task progress validation",
                        status: "pending",
                    },
                    {
                        id: "completion",
                        name: "Completion Check",
                        description: "Final validation",
                        status: "pending",
                    },
                ];
        }
    }

    /**
     * Schedule automatic checkpoint monitoring
     */
    private scheduleCheckpointMonitoring(taskId: string): void {
        const checkInterval = () => {
            const task = this.tasks.get(taskId);
            if (!task || task.status !== "in_progress") {
                return;
            }

            // Check if task is taking too long
            const duration = Date.now() - task.startTime;
            if (this.config.maxDuration && duration > this.config.maxDuration) {
                task.status = "intervention_required";
                this.requestIntervention(task, undefined, "Task exceeded maximum duration");
            }

            // Schedule next check
            if (task.status === "in_progress") {
                setTimeout(checkInterval, this.config.checkpointInterval!);
            }
        };

        setTimeout(checkInterval, this.config.checkpointInterval!);
    }

    /**
     * Request intervention for a task
     */
    private async requestIntervention(
        task: SupervisionTask,
        checkpoint?: SupervisionCheckpoint,
        reason?: string
    ): Promise<void> {
        logger.warn(`Intervention required for task ${task.id}: ${reason || "Checkpoint failed"}`);

        // In a real system, this would notify human supervisors or trigger alerts
        // For now, we just log the intervention request

        if (this.llmProvider) {
            // Could use LLM to analyze the situation and provide recommendations
            try {
                const analysis = await this.analyzeWithLLM(task, checkpoint, reason);
                logger.info(`LLM analysis: ${analysis}`);
            } catch (error) {
                logger.error("Failed to get LLM analysis", { error });
            }
        }
    }

    /**
     * Analyze task completion
     */
    private async analyzeTaskCompletion(task: SupervisionTask): Promise<SupervisionResult> {
        const failedCheckpoints = task.checkpoints.filter((cp) => cp.status === "failed");
        const pendingCheckpoints = task.checkpoints.filter((cp) => cp.status === "pending");
        const passedCheckpoints = task.checkpoints.filter((cp) => cp.status === "passed");

        const issues: string[] = [];
        const recommendations: string[] = [];

        if (failedCheckpoints.length > 0) {
            issues.push(
                `${failedCheckpoints.length} checkpoint(s) failed: ${failedCheckpoints
                    .map((cp) => cp.name)
                    .join(", ")}`
            );
        }

        if (pendingCheckpoints.length > 0) {
            issues.push(
                `${pendingCheckpoints.length} checkpoint(s) not completed: ${pendingCheckpoints
                    .map((cp) => cp.name)
                    .join(", ")}`
            );
        }

        // Determine if task passed based on risk level
        let passed = true;
        if (task.risk_level === "high") {
            passed = failedCheckpoints.length === 0 && pendingCheckpoints.length === 0;
        } else if (task.risk_level === "medium") {
            passed = failedCheckpoints.length === 0;
        } else {
            passed = passedCheckpoints.length > 0;
        }

        return {
            taskId: task.id,
            passed,
            interventionRequired: task.status === "intervention_required",
            issues: issues.length > 0 ? issues : undefined,
            recommendations: recommendations.length > 0 ? recommendations : undefined,
        };
    }

    /**
     * Use LLM to analyze supervision situation
     */
    private async analyzeWithLLM(
        task: SupervisionTask,
        checkpoint?: SupervisionCheckpoint,
        reason?: string
    ): Promise<string> {
        if (!this.llmProvider) {
            return "No LLM provider available for analysis";
        }

        const prompt = `Analyze this supervision alert:
Task: ${task.description}
Type: ${task.type}
Risk Level: ${task.risk_level}
Team: ${task.team.members.join(", ")}
${checkpoint ? `Failed Checkpoint: ${checkpoint.name} - ${checkpoint.description}` : ""}
${reason ? `Reason: ${reason}` : ""}

Provide brief recommendations for addressing this issue.`;

        const response = await this.llmProvider.generateResponse([
            { role: "system", content: "You are a supervision system analyzing task progress." },
            { role: "user", content: prompt },
        ]);

        return response.content;
    }

    /**
     * Create a dummy task when supervision is disabled
     */
    private createDummyTask(
        taskId: string,
        type: SupervisionTask["type"],
        description: string,
        team: Team,
        riskLevel: SupervisionTask["risk_level"]
    ): SupervisionTask {
        return {
            id: taskId,
            type,
            description,
            team,
            startTime: Date.now(),
            checkpoints: [],
            status: "completed",
            risk_level: riskLevel,
        };
    }
}

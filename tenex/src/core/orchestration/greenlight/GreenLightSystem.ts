import { logger } from "@tenex/shared/logger";
import type { LLMProvider } from "../../../utils/agents/llm/types";

export interface ApprovalRequest {
    id: string;
    operation: string;
    description: string;
    riskLevel: "low" | "medium" | "high" | "critical";
    requester: string; // Agent name
    justification: string;
    proposedChanges?: string[];
    timestamp: number;
    status: "pending" | "approved" | "denied" | "expired";
    reviewedBy?: string;
    reviewTimestamp?: number;
    reviewNotes?: string;
    conditions?: string[]; // Conditions that must be met
}

export interface ApprovalPolicy {
    autoApprove: {
        low: boolean;
        medium: boolean;
        high: boolean;
        critical: boolean;
    };
    requireReview: string[]; // Operations that always require review
    deniedPatterns: string[]; // Patterns that are automatically denied
    maxPendingDuration: number; // Milliseconds before expiry
}

export interface GreenLightConfig {
    enabled: boolean;
    policy: ApprovalPolicy;
    llmReview?: boolean; // Use LLM for risk assessment
}

export class GreenLightSystem {
    private requests: Map<string, ApprovalRequest> = new Map();
    private config: GreenLightConfig;
    private llmProvider?: LLMProvider;
    private approvalHistory: ApprovalRequest[] = [];

    constructor(config: GreenLightConfig, llmProvider?: LLMProvider) {
        this.config = config;
        this.llmProvider = llmProvider;
    }

    /**
     * Request approval for an operation
     */
    async requestApproval(
        operation: string,
        description: string,
        requester: string,
        justification: string,
        proposedChanges?: string[]
    ): Promise<ApprovalRequest> {
        if (!this.config.enabled) {
            // System disabled, auto-approve everything
            return this.createAutoApprovedRequest(
                operation,
                description,
                requester,
                justification,
                proposedChanges
            );
        }

        const riskLevel = await this.assessRiskLevel(operation, description, proposedChanges);
        const requestId = `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const request: ApprovalRequest = {
            id: requestId,
            operation,
            description,
            riskLevel,
            requester,
            justification,
            proposedChanges,
            timestamp: Date.now(),
            status: "pending",
        };

        // Check auto-deny patterns
        if (this.shouldAutoDeny(operation, description)) {
            request.status = "denied";
            request.reviewNotes = "Operation matches denied pattern";
            this.approvalHistory.push(request);
            logger.warn(`Auto-denied request ${requestId}: ${operation}`);
            return request;
        }

        // Check auto-approve policy
        if (this.shouldAutoApprove(riskLevel, operation)) {
            request.status = "approved";
            request.reviewedBy = "system";
            request.reviewTimestamp = Date.now();
            request.reviewNotes = "Auto-approved based on policy";
            this.approvalHistory.push(request);
            logger.info(`Auto-approved request ${requestId}: ${operation}`);
            return request;
        }

        // Store pending request
        this.requests.set(requestId, request);
        logger.info(`Created approval request ${requestId} for ${operation} (${riskLevel} risk)`);

        // Set expiry timer
        setTimeout(() => {
            this.expireRequest(requestId);
        }, this.config.policy.maxPendingDuration);

        return request;
    }

    /**
     * Get pending approval requests
     */
    getPendingRequests(): ApprovalRequest[] {
        return Array.from(this.requests.values()).filter((r) => r.status === "pending");
    }

    /**
     * Approve a request
     */
    approveRequest(
        requestId: string,
        reviewer: string,
        notes?: string,
        conditions?: string[]
    ): ApprovalRequest | undefined {
        const request = this.requests.get(requestId);
        if (!request || request.status !== "pending") {
            logger.warn(`Cannot approve request ${requestId}: not found or not pending`);
            return undefined;
        }

        request.status = "approved";
        request.reviewedBy = reviewer;
        request.reviewTimestamp = Date.now();
        request.reviewNotes = notes;
        request.conditions = conditions;

        this.requests.delete(requestId);
        this.approvalHistory.push(request);

        logger.info(`Request ${requestId} approved by ${reviewer}`);
        return request;
    }

    /**
     * Deny a request
     */
    denyRequest(requestId: string, reviewer: string, reason: string): ApprovalRequest | undefined {
        const request = this.requests.get(requestId);
        if (!request || request.status !== "pending") {
            logger.warn(`Cannot deny request ${requestId}: not found or not pending`);
            return undefined;
        }

        request.status = "denied";
        request.reviewedBy = reviewer;
        request.reviewTimestamp = Date.now();
        request.reviewNotes = reason;

        this.requests.delete(requestId);
        this.approvalHistory.push(request);

        logger.info(`Request ${requestId} denied by ${reviewer}: ${reason}`);
        return request;
    }

    /**
     * Check if an operation has been approved
     */
    isApproved(requestId: string): boolean {
        // Check active requests
        const activeRequest = this.requests.get(requestId);
        if (activeRequest) {
            return activeRequest.status === "approved";
        }

        // Check history
        const historicalRequest = this.approvalHistory.find((r) => r.id === requestId);
        return historicalRequest?.status === "approved";
    }

    /**
     * Get approval history
     */
    getApprovalHistory(filter?: {
        requester?: string;
        operation?: string;
        status?: ApprovalRequest["status"];
        limit?: number;
    }): ApprovalRequest[] {
        let history = [...this.approvalHistory];

        if (filter?.requester) {
            history = history.filter((r) => r.requester === filter.requester);
        }

        if (filter?.operation) {
            history = history.filter((r) => r.operation.includes(filter.operation));
        }

        if (filter?.status) {
            history = history.filter((r) => r.status === filter.status);
        }

        // Sort by timestamp descending (most recent first)
        history.sort((a, b) => b.timestamp - a.timestamp);

        if (filter?.limit) {
            history = history.slice(0, filter.limit);
        }

        return history;
    }

    /**
     * Assess risk level of an operation
     */
    private async assessRiskLevel(
        operation: string,
        description: string,
        proposedChanges?: string[]
    ): Promise<ApprovalRequest["riskLevel"]> {
        // High-risk operations
        const highRiskPatterns = [
            /delete|remove|drop/i,
            /production|prod/i,
            /credential|secret|key/i,
            /deploy|release/i,
        ];

        // Critical operations
        const criticalPatterns = [/database.*delete/i, /rm\s+-rf/i, /force.*push/i, /reset.*hard/i];

        // Check patterns
        const combinedText = `${operation} ${description} ${proposedChanges?.join(" ") || ""}`;

        if (criticalPatterns.some((pattern) => pattern.test(combinedText))) {
            return "critical";
        }

        if (highRiskPatterns.some((pattern) => pattern.test(combinedText))) {
            return "high";
        }

        // Use LLM for more nuanced assessment if available
        if (this.config.llmReview && this.llmProvider) {
            try {
                const assessment = await this.assessWithLLM(
                    operation,
                    description,
                    proposedChanges
                );
                return assessment;
            } catch (error) {
                logger.error("Failed to assess risk with LLM", { error });
            }
        }

        // Default based on operation type
        if (operation.includes("modify") || operation.includes("update")) {
            return "medium";
        }

        return "low";
    }

    /**
     * Use LLM to assess risk
     */
    private async assessWithLLM(
        operation: string,
        description: string,
        proposedChanges?: string[]
    ): Promise<ApprovalRequest["riskLevel"]> {
        if (!this.llmProvider) {
            return "medium";
        }

        const prompt = `Assess the risk level of this operation:
Operation: ${operation}
Description: ${description}
${proposedChanges ? `Proposed changes:\n${proposedChanges.join("\n")}` : ""}

Classify as: low, medium, high, or critical
Consider: data loss potential, security impact, system stability, reversibility

Respond with just the risk level.`;

        const response = await this.llmProvider.generateResponse([
            {
                role: "system",
                content: "You are a risk assessment system. Evaluate operations conservatively.",
            },
            { role: "user", content: prompt },
        ]);

        const level = response.content.trim().toLowerCase();
        if (["low", "medium", "high", "critical"].includes(level)) {
            return level as ApprovalRequest["riskLevel"];
        }

        return "medium"; // Default if can't parse
    }

    /**
     * Check if operation should be auto-approved
     */
    private shouldAutoApprove(riskLevel: ApprovalRequest["riskLevel"], operation: string): boolean {
        // Check if operation requires review regardless of risk
        if (
            this.config.policy.requireReview.some((pattern) =>
                operation.toLowerCase().includes(pattern.toLowerCase())
            )
        ) {
            return false;
        }

        // Check auto-approve policy for risk level
        return this.config.policy.autoApprove[riskLevel];
    }

    /**
     * Check if operation should be auto-denied
     */
    private shouldAutoDeny(operation: string, description: string): boolean {
        const combinedText = `${operation} ${description}`.toLowerCase();
        return this.config.policy.deniedPatterns.some((pattern) =>
            combinedText.includes(pattern.toLowerCase())
        );
    }

    /**
     * Create auto-approved request when system is disabled
     */
    private createAutoApprovedRequest(
        operation: string,
        description: string,
        requester: string,
        justification: string,
        proposedChanges?: string[]
    ): ApprovalRequest {
        const request: ApprovalRequest = {
            id: `auto-${Date.now()}`,
            operation,
            description,
            riskLevel: "low",
            requester,
            justification,
            proposedChanges,
            timestamp: Date.now(),
            status: "approved",
            reviewedBy: "system",
            reviewTimestamp: Date.now(),
            reviewNotes: "GreenLight system disabled - auto-approved",
        };

        this.approvalHistory.push(request);
        return request;
    }

    /**
     * Expire a pending request
     */
    private expireRequest(requestId: string): void {
        const request = this.requests.get(requestId);
        if (request && request.status === "pending") {
            request.status = "expired";
            this.requests.delete(requestId);
            this.approvalHistory.push(request);
            logger.info(`Request ${requestId} expired`);
        }
    }

    /**
     * Clean up old history entries
     */
    cleanupHistory(maxAge = 7 * 24 * 60 * 60 * 1000): void {
        const cutoff = Date.now() - maxAge;
        const initialCount = this.approvalHistory.length;

        this.approvalHistory = this.approvalHistory.filter((r) => r.timestamp > cutoff);

        const removed = initialCount - this.approvalHistory.length;
        if (removed > 0) {
            logger.info(`Cleaned up ${removed} old approval requests`);
        }
    }
}

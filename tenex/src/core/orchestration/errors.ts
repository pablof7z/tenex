export abstract class OrchestrationError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly recoverable: boolean
    ) {
        super(message);
        this.name = this.constructor.name;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export class TeamFormationError extends OrchestrationError {
    constructor(
        message: string,
        public readonly requiredCapabilities?: string[],
        public readonly availableAgents?: string[]
    ) {
        super(message, "TEAM_FORMATION_ERROR", false);
    }
}

export class NoSuitableAgentsError extends TeamFormationError {
    constructor(requiredCapabilities: string[], availableAgents: string[]) {
        super(
            `No agents found with required capabilities: ${requiredCapabilities.join(", ")}`,
            requiredCapabilities,
            availableAgents
        );
    }
}

import type { Milestone } from "@/core/orchestration/supervision/types";

export class SupervisionAbortError extends OrchestrationError {
    constructor(
        message: string,
        public readonly milestone: Milestone
    ) {
        super(message, "SUPERVISION_ABORT", false);
    }
}

export class ReviewTimeoutError extends OrchestrationError {
    constructor(
        public readonly reviewers: string[],
        public readonly timeout: number
    ) {
        super(`Review timeout after ${timeout}ms`, "REVIEW_TIMEOUT", true);
    }
}

export class ReflectionError extends OrchestrationError {
    constructor(message: string) {
        super(message, "REFLECTION_ERROR", true);
    }
}

export class ConfigurationError extends OrchestrationError {
    constructor(public readonly errors: string[]) {
        super(`Configuration validation failed: ${errors.join(", ")}`, "CONFIG_ERROR", false);
    }
}

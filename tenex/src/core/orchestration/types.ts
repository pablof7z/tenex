import type { ProjectRuntimeInfo } from "@/commands/run/ProjectLoader";
import type { NDKEvent } from "@nostr-dev-kit/ndk";

export enum OrchestrationStrategy {
    SINGLE_RESPONDER = "single_responder",
    HIERARCHICAL = "hierarchical",
    PARALLEL_EXECUTION = "parallel_execution",
    PHASED_DELIVERY = "phased_delivery",
    EXPLORATORY = "exploratory",
}

export interface RequestAnalysis {
    requestType: string;
    requiredCapabilities: string[];
    estimatedComplexity: number;
    suggestedStrategy: OrchestrationStrategy;
    reasoning: string;
}

export interface TeamFormationResult {
    lead: string;
    members: string[];
    reasoning: string;
}

export interface CombinedAnalysisResponse {
    analysis: RequestAnalysis;
    team: TeamFormationResult;
    taskDefinition?: TaskDefinition;
}

export interface TaskDefinition {
    description: string;
    successCriteria: string[];
    requiresGreenLight: boolean;
    reviewers?: string[];
    estimatedComplexity: number;
}

export interface TeamFormation {
    timestamp: number;
    reasoning: string;
    requestAnalysis: RequestAnalysis;
}

export interface Team {
    id: string;
    conversationId: string;
    lead: string;
    members: string[];
    strategy: OrchestrationStrategy;
    taskDefinition?: TaskDefinition;
    formation: TeamFormation;
}

export interface AgentDefinition {
    name: string;
    description: string;
    role: string;
    instructions: string;
}

export interface ProjectContext {
    projectInfo?: ProjectRuntimeInfo;
    repository?: string;
    title?: string;
}

export interface EventContext {
    conversationId: string;
    hasPTags: boolean;
    availableAgents: Map<string, AgentDefinition>;
    projectContext: ProjectContext;
    originalEvent?: NDKEvent;
}

export interface LLMResponse {
    content: string;
    usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
    };
}

export interface LLMConfigOverrides {
    model?: string;
    temperature?: number;
    maxTokens?: number;
}

export interface LLMProvider {
    complete(prompt: string, config?: LLMConfigOverrides): Promise<LLMResponse>;
    stream?(prompt: string, config?: LLMConfigOverrides): AsyncGenerator<string>;
}

export interface LogContext {
    [key: string]: unknown;
}

export interface Logger {
    info(message: string, context?: LogContext): void;
    error(message: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    debug(message: string, context?: LogContext): void;
}

export interface OrchestrationConfig {
    orchestrator: {
        llmConfig: string;
        teamFormationLLMConfig?: string;
        maxTeamSize: number;
        strategies: {
            [key: string]: OrchestrationStrategy;
        };
    };
    supervision: {
        complexTools: string[];
        supervisionTimeout: number;
        llmConfig?: string;
    };
    reflection: {
        enabled: boolean;
        detectionThreshold: number;
        maxLessonsPerAgent: number;
        llmConfig?: string;
    };
    greenLight: {
        defaultRequiredFor: string[];
        reviewTimeout: number;
        parallelReviews: boolean;
    };
}

export const defaultOrchestrationConfig: OrchestrationConfig = {
    orchestrator: {
        llmConfig: "default",
        maxTeamSize: 5,
        strategies: {
            simple: OrchestrationStrategy.SINGLE_RESPONDER,
            moderate: OrchestrationStrategy.HIERARCHICAL,
            complex: OrchestrationStrategy.PHASED_DELIVERY,
        },
    },
    supervision: {
        complexTools: [
            "claude_code",
            "architectural_refactor",
            "database_migration",
            "security_audit",
        ],
        supervisionTimeout: 60000,
    },
    reflection: {
        enabled: true,
        detectionThreshold: 0.7,
        maxLessonsPerAgent: 100,
    },
    greenLight: {
        defaultRequiredFor: ["feature", "refactor", "security_fix"],
        reviewTimeout: 300000,
        parallelReviews: true,
    },
};

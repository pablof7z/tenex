/**
 * Telemetry event types for TENEX orchestration
 */

export interface BaseTelemetryEvent {
    timestamp: number;
    projectId?: string;
    eventId: string;
    version: string;
}

export interface LLMTelemetryData {
    provider: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost?: number;
    latencyMs: number;
    success: boolean;
    errorMessage?: string;
}

export interface TeamFormationAnalysisEvent extends BaseTelemetryEvent {
    type: "team_formation_analysis";
    data: {
        llm: LLMTelemetryData;
        request: {
            eventId: string;
            contentLength: number;
            agentCount: number;
        };
        analysis: {
            requestType: string;
            complexity: number;
            capabilitiesCount: number;
            strategy: string;
            success: boolean;
        };
        prompts: {
            systemPromptHash: string;
            userPromptHash: string;
            promptLength: number;
            responseLength: number;
        };
    };
}

export interface TeamFormationEvent extends BaseTelemetryEvent {
    type: "team_formation";
    data: {
        llm: LLMTelemetryData;
        team: {
            leadAgent: string;
            memberCount: number;
            members: string[];
            strategy: string;
            success: boolean;
            failureReason?: string;
        };
        prompts: {
            promptHash: string;
            promptLength: number;
            responseLength: number;
        };
        analysis: {
            requestType: string;
            complexity: number;
            strategy: string;
        };
    };
}

export interface OrchestrationTelemetryEvent extends BaseTelemetryEvent {
    type: "orchestration_complete";
    data: {
        totalLatencyMs: number;
        analysisLatencyMs: number;
        formationLatencyMs: number;
        llmCalls: LLMTelemetryData[];
        team: {
            id: string;
            size: number;
            strategy: string;
            lead: string;
        };
        success: boolean;
        errorType?: string;
        errorMessage?: string;
    };
}

export type TelemetryEvent =
    | TeamFormationAnalysisEvent
    | TeamFormationEvent
    | OrchestrationTelemetryEvent;

export interface TelemetryEventPublisher {
    publishEvent(event: TelemetryEvent): Promise<void>;
    publishAnalysisEvent(event: TeamFormationAnalysisEvent): Promise<void>;
    publishFormationEvent(event: TeamFormationEvent): Promise<void>;
    publishOrchestrationEvent(event: OrchestrationTelemetryEvent): Promise<void>;
}

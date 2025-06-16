export interface MilestoneContext {
    params?: unknown;
    [key: string]: unknown;
}

export interface Milestone {
    id: string;
    type: "tool_completion" | "phase_transition" | "checkpoint" | "subtask_complete";
    agentName: string;
    toolName?: string;
    operation?: string;
    output?: unknown;
    timestamp: number;
    context: MilestoneContext;
    explicitSupervisionRequest?: boolean;
    complexity?: "simple" | "complex";
}

export interface SupervisionDecision {
    action: "approve" | "intervene" | "abort";
    feedback?: string;
    suggestions?: string[];
    confidence: number;
    notes?: string;
}

export interface SupervisionEvent {
    milestone: Milestone;
    decision: SupervisionDecision;
    timestamp: number;
}

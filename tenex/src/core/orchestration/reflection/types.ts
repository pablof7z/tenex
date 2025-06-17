export interface CorrectionAnalysis {
    isCorrection: boolean;
    confidence: number;
    issues: string[];
    affectedAgents?: string[];
}

export interface CorrectionPattern {
    type: "user_correction" | "self_correction" | "revision_request";
    indicators: string[];
    confidence: number;
    messageIndices?: number[];
}

export interface AgentLesson {
    id: string;
    agentId: string;
    agentName: string;
    taskId: string;
    type: "mistake" | "success" | "discovery" | "optimization";
    title: string;
    content: string;
    context?: string;
    impact: "high" | "medium" | "low";
    tags: string[];
    timestamp: number;
}

export interface ReflectionTrigger {
    type: "correction" | "failure" | "completion" | "manual";
    taskId: string;
    conversationId: string;
    reason: string;
    metadata?: Record<string, unknown>;
}

export interface LessonContext {
    triggerEventId: string;
    conversationId: string;
    teamId?: string;
    errorType?: string;
    preventionStrategy?: string;
    relatedCapabilities?: string[];
    timestamp: number;
}

export interface ReflectionResult {
    lessonsGenerated: AgentLesson[];
    lessonsPublished: AgentLesson[];
    reflectionDuration: number;
}

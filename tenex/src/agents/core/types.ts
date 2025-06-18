import type { LLMConfig } from "@/utils/agents/types";
import type { NDKEvent, NDKSigner, NDKProject } from "@nostr-dev-kit/ndk";

// Re-export LLMConfig from existing system
export type { LLMConfig } from "@/utils/agents/types";

// ============================================================================
// Agent Types
// ============================================================================

export interface AgentConfig {
    name: string;
    role: string;
    instructions: string;
    nsec: string;
    tools?: string[]; // List of tool names this agent has access to
    eventId?: string; // NDKAgent event ID
    hasOrchestrationCapability?: boolean; // Whether agent can orchestrate
    llmConfig?: LLMConfig; // LLM configuration for this agent
}

export interface LLMMetadata {
    model?: string;
    provider?: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        cacheCreationTokens?: number;
        cacheReadTokens?: number;
        cost?: number;
        costUsd?: number;
    };
    confidence?: number;
    systemPrompt?: string;
    userPrompt?: string;
    rawResponse?: string;
    isToolResult?: boolean;
    isPartial?: boolean;
    chunkIndex?: number;
}

export interface AgentResponse {
    content: string;
    signal?: ConversationSignal;
    metadata?: LLMMetadata;
    // Tool-related properties
    toolCalls?: any[];
    hasNativeToolCalls?: boolean;
    tool_calls?: any[];
}

export interface ConversationSignal {
    type: "continue" | "ready_for_transition" | "need_input" | "blocked" | "complete";
    reason?: string;
    suggestedNext?: string;
}

// ============================================================================
// Team & Orchestration Types
// ============================================================================

export interface Team {
    id: string;
    rootEventId: string;
    lead: string;
    members: string[];
    plan: ConversationPlan;
    createdAt: number;
}

export interface ConversationPlan {
    stages: ConversationStage[];
    estimatedComplexity: number;
}

export interface ConversationStage {
    participants: string[];
    purpose: string;
    expectedOutcome: string;
    transitionCriteria: string;
    primarySpeaker?: string;
}

export interface TeamFormationRequest {
    event: NDKEvent;
    availableAgents: Map<string, AgentConfig>;
    projectContext: ProjectContext;
}

export interface TeamFormationResult {
    team: {
        lead: string;
        members: string[];
    };
    conversationPlan: ConversationPlan;
    reasoning: string;
}

export interface ProjectContext {
    projectId: string;
    title: string;
    description?: string;
    repository?: string;
}

// ============================================================================
// LLM Types
// ============================================================================

export interface LLMProvider {
    complete(request: CompletionRequest): Promise<CompletionResponse>;
}

export interface CompletionRequest {
    messages: Message[];
    maxTokens?: number;
    temperature?: number;
    context?: {
        agentName: string;
        rootEventId: string;
        eventId?: string;
        originalEvent?: NDKEvent;
        projectId?: string;
        projectEvent?: NDKEvent;
        ndk?: any;
        agent?: any;
        immediateResponse?: boolean;
        typingIndicator?: (content: string) => Promise<void>;
    };
}

export interface UsageStats {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

export interface CompletionResponse {
    content: string;
    model?: string;
    usage?: UsageStats & {
        cacheCreationTokens?: number;
        cacheReadTokens?: number;
        cost?: number;
    };
    // Tool-related properties
    toolCalls?: any[];
    hasNativeToolCalls?: boolean;
    tool_calls?: any[];
}

export interface Message {
    role: "system" | "user" | "assistant";
    content: string;
}

// ============================================================================
// Event & Publishing Types
// ============================================================================

export interface SpecSummary {
    title: string;
    summary: string;
    dTag: string;
}

export interface AgentSummary {
    name: string;
    role: string;
    description: string;
}

export interface EventContext {
    rootEventId: string;
    projectId: string;
    originalEvent: NDKEvent;
    projectEvent: NDKProject;  // REQUIRED - critical for system functioning
    availableSpecs?: SpecSummary[];
    availableAgents?: AgentSummary[];
    eventId?: string;
}

export interface TypingIndicator {
    start(agentName: string, eventContext: EventContext): Promise<void>;
    update(message: string): Promise<void>;
    stop(): Promise<void>;
}

export interface NostrPublisher {
    publishResponse(
        response: AgentResponse,
        context: EventContext,
        agentSigner: NDKSigner,
        agentName?: string
    ): Promise<void>;
    publishTypingIndicator(
        agentName: string,
        isTyping: boolean,
        context: EventContext,
        options?: {
            message?: string;
            systemPrompt?: string;
            userPrompt?: string;
        },
        signer?: NDKSigner
    ): Promise<void>;
    publishResponseUpdate?(
        originalEventId: string,
        updatedContent: string,
        context: EventContext,
        agentSigner: NDKSigner,
        agentName?: string
    ): Promise<void>;
    clearPartialTracking?(rootEventId: string, agentName?: string): void;
}

// ============================================================================
// Storage Types
// ============================================================================

export interface ConversationStore {
    saveTeam(rootEventId: string, team: Team): Promise<void>;
    getTeam(rootEventId: string): Promise<Team | null>;
    appendMessage(rootEventId: string, message: ConversationMessage): Promise<void>;
    getMessages(rootEventId: string): Promise<ConversationMessage[]>;
}

export interface ConversationMessage {
    id: string;
    agentName: string;
    content: string;
    timestamp: number;
    signal?: ConversationSignal;
    metadata?: {
        wasStreamed?: boolean;
        chunks?: number;
        [key: string]: any;
    };
}

// ============================================================================
// Error Types
// ============================================================================

export class AgentError extends Error {
    constructor(
        message: string,
        public code: string
    ) {
        super(message);
        this.name = "AgentError";
    }
}

export class TeamFormationError extends AgentError {
    constructor(message: string) {
        super(message, "TEAM_FORMATION_ERROR");
    }
}

export class LLMError extends AgentError {
    constructor(message: string) {
        super(message, "LLM_ERROR");
    }
}

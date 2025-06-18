import type { LLMConfig } from "@/utils/agents/types";
import type { NDKEvent, NDKSigner } from "@nostr-dev-kit/ndk";

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
}

export interface AgentResponse {
    content: string;
    signal?: ConversationSignal;
    metadata?: LLMMetadata;
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
    conversationId: string;
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
        conversationId: string;
        eventId?: string;
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
}

export interface Message {
    role: "system" | "user" | "assistant";
    content: string;
}

// ============================================================================
// Event & Publishing Types
// ============================================================================

export interface EventContext {
    conversationId: string;
    projectId: string;
    originalEvent: NDKEvent;
    projectEvent?: NDKEvent;
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
        agentSigner: NDKSigner
    ): Promise<void>;
    publishTypingIndicator(
        agentName: string,
        isTyping: boolean,
        context: EventContext,
        options?: {
            message?: string;
            systemPrompt?: string;
            userPrompt?: string;
        }
    ): Promise<void>;
}

// ============================================================================
// Storage Types
// ============================================================================

export interface ConversationStore {
    saveTeam(conversationId: string, team: Team): Promise<void>;
    getTeam(conversationId: string): Promise<Team | null>;
    appendMessage(conversationId: string, message: ConversationMessage): Promise<void>;
    getMessages(conversationId: string): Promise<ConversationMessage[]>;
}

export interface ConversationMessage {
    id: string;
    agentName: string;
    content: string;
    timestamp: number;
    signal?: ConversationSignal;
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

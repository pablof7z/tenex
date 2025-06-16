import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type { Agent } from "../../../utils/agents/Agent";
import type { ConversationStorage } from "../../../utils/agents/ConversationStorage";
import type { Team } from "../types";

export interface OrchestrationStrategy {
    execute(
        team: Team,
        event: NDKEvent,
        agents: Map<string, Agent>,
        conversationStorage: ConversationStorage
    ): Promise<StrategyExecutionResult>;

    getName(): string;
    getDescription(): string;
}

export interface StrategyExecutionResult {
    success: boolean;
    responses: AgentResponse[];
    errors?: Error[];
    metadata?: Record<string, unknown>;
}

export interface AgentResponse {
    agentName: string;
    response: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

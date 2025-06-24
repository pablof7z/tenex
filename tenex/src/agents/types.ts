import type { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import type { Conversation, Phase } from "@/conversations/types";

export interface AgentSummary {
    name: string;
    role: string;
    pubkey: string;
}

export interface Agent {
    name: string;
    pubkey: string;
    signer: NDKPrivateKeySigner;
    role: string;
    instructions?: string;
    llmConfig: string;
    tools: string[];
    eventId?: string; // NDKAgent event ID
    slug: string; // Agent slug/key from agents.json
    isPMAgent?: boolean; // Whether this agent is the PM agent (project manager/orchestrator)
}

export interface AgentContext {
    conversation: Conversation;
    phase: Phase;
    phaseHistory: NDKEvent[]; // Events from current phase only
    availableAgents: Agent[];
    projectPath: string;
    incomingEvent: NDKEvent; // The event we're responding to
}

export interface ToolCallArguments {
    // Common tool arguments
    command?: string; // For shell tools
    path?: string; // For file tools
    content?: string; // For file write/edit
    oldContent?: string; // For file edit
    newContent?: string; // For file edit
    mode?: string; // For claude_code tool
    prompt?: string; // For claude_code tool

    // Allow other tool arguments
    [key: string]: string | number | boolean | undefined;
}


export interface ToolCall {
    tool: string;
    args: ToolCallArguments;
    id?: string;
}

export interface AgentConfig {
    name: string;
    role: string;
    instructions?: string;
    nsec: string;
    eventId?: string;
    pubkey?: string;
    tools: string[];
    llmConfig?: string;
}

/**
 * Configuration load options
 */
export interface ConfigurationLoadOptions {
    skipGlobal?: boolean;
}

/**
 * Agent data stored in JSON files (.tenex/agents/*.json)
 */
export interface StoredAgentData {
    name: string;
    role: string;
    instructions?: string;
    llmConfig?: string;
    tools?: string[];
}

/**
 * Agent configuration for orchestration system
 */
export interface AgentConfiguration {
    name: string;
    nsec: string;
    eventId?: string;
    role?: string;
}

/**
 * Project agents configuration
 */
export interface ProjectAgentsConfig {
    agents: Record<string, AgentConfiguration>;
}

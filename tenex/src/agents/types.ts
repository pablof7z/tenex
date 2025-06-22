import type { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import type { Conversation, Phase } from "@/conversations/types";
import type { AgentSummary } from "@/routing/types";

export interface Agent {
  name: string;
  pubkey: string;
  signer: NDKPrivateKeySigner;
  role: string;
  expertise: string;
  instructions?: string;
  llmConfig: string;
  tools: string[];
  eventId?: string; // NDKAgent event ID
}

export interface AgentContext {
  conversation: Conversation;
  phase: Phase;
  phaseHistory: NDKEvent[]; // Events from current phase only
  availableAgents: AgentSummary[];
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

export interface AgentResponse {
  content: string;
  nextAction: NextAction;
  toolCalls?: ToolCall[];
  metadata?: Record<string, string | number | boolean>;
}

export interface NextAction {
  type: "handoff" | "phase_transition" | "complete" | "human_input" | "continue";
  target?: string; // agent pubkey for handoff, phase name for transition
  reasoning?: string;
}

export interface ToolCall {
  tool: string;
  args: ToolCallArguments;
  id?: string;
}

export interface AgentConfig {
  name: string;
  role: string;
  expertise: string;
  instructions?: string;
  nsec: string;
  eventId?: string;
  pubkey?: string;
  tools: string[];
  llmConfig?: string;
}

export interface AgentProfile {
  name: string;
  role: string;
  description: string;
  capabilities: string[];
}

// Agent configuration types moved to @/types/config

// Tracked agents type moved to config types

/**
 * Configuration load options
 */
export interface ConfigurationLoadOptions {
  skipGlobal?: boolean;
}

/**
 * Agent definition structure
 */
export interface AgentDefinition {
  eventId?: string;
  name: string;
  description?: string;
  role: string;
  expertise?: string;
  instructions?: string;
  version?: number;
  publishedAt?: number;
  publisher?: string;
  llmConfig?: string;
  tools?: string[];
}
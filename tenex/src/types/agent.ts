import type { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import type { Conversation, Phase } from "./conversation";
import type { AgentSummary } from "./routing";

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

export interface AgentResponse {
  content: string;
  nextAction: NextAction;
  toolCalls?: ToolCall[];
  metadata?: Record<string, any>;
}

export interface NextAction {
  type: "handoff" | "phase_transition" | "complete" | "human_input" | "continue";
  target?: string; // agent pubkey for handoff, phase name for transition
  reasoning?: string;
}

export interface ToolCall {
  tool: string;
  args: any;
  id?: string;
}

export interface ToolResult {
  success: boolean;
  output?: any;
  error?: string;
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

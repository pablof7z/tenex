import type { Agent } from "@/agents/types";
import type { Phase } from "@/conversations/phases";
import type { Conversation, PhaseTransition } from "@/conversations/types";
import type { ToolExecutionResult } from "@/tools/types";

export interface ExecutionContext {
  agent: Agent;
  conversationId: string;
  phase: Phase;
  projectPath: string;
  triggeringEvent: import("@nostr-dev-kit/ndk").NDKEvent;
  publisher: import("@/nostr/NostrPublisher").NostrPublisher;
  conversationManager: import("@/conversations/ConversationManager").ConversationManager;
  previousPhase?: Phase;
  handoff?: PhaseTransition;
}

export interface AgentExecutionResult {
  success: boolean;
  response?: string;
  toolExecutions?: ToolExecutionResult[];
  error?: string;
}



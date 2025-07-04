import type { Agent } from "@/agents/types";
import type { Phase } from "@/conversations/phases";
import type { Conversation } from "@/conversations/types";
import type { LLMMetadata } from "@/nostr/types";
import type { ToolExecutionResult } from "@/tools/types";
import type { NDKEvent } from "@nostr-dev-kit/ndk";

export interface AgentExecutionContext {
  agent: Agent;
  conversation: Conversation;
  phase: Phase;
  previousPhase?: Phase;
  projectContext?: Record<string, unknown>;
  projectPath?: string;
  additionalContext?: {
    claudeCodeReport?: string;
    claudeCodeSuccess?: boolean;
    directExecution?: boolean;
  };
}

export interface AgentExecutionResult {
  success: boolean;
  response?: string;
  llmMetadata?: LLMMetadata;
  toolExecutions?: ToolExecutionResult[];
  nextAgent?: string; // pubkey of next agent if handoff needed
  error?: string;
  publishedEvent?: NDKEvent;
}

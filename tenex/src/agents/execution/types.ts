import type { ConversationState } from "@/conversations/types";
import type { Agent } from "@/agents/types";
import type { Phase } from "@/conversations/types";
import type { LLMMetadata } from "@/types/nostr";
import type { ToolExecutionResult } from "@/tools/types";
import type { NDKEvent } from "@nostr-dev-kit/ndk";

export interface AgentExecutionContext {
  agent: Agent;
  conversation: ConversationState;
  phase: Phase;
  lastUserMessage?: string;
  projectContext?: Record<string, unknown>;
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

export interface AgentPromptContext {
  systemPrompt: string;
  conversationHistory?: string;
  conversationContext?: string; // enhanced version uses this
  phaseContext: string;
  availableTools?: string[];
  constraints?: string[];
}

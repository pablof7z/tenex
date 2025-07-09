import type { Agent } from "@/agents/types";
import type { Phase } from "@/conversations/phases";
import type { Conversation, PhaseTransition } from "@/conversations/types";
import type { ToolExecutionResult } from "@/tools/types";

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
  toolExecutions?: ToolExecutionResult[];
  error?: string;
}

export interface AgentExecutionContextWithHandoff extends AgentExecutionContext {
  handoff?: PhaseTransition;
}

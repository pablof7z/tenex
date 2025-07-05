// Tool parameter types
export type FileReadParameters = {
  path: string;
};

export type FileToolParameters = FileReadParameters;

export type ClaudeCodeToolParameters = {
  mode: "run" | "plan";
  prompt: string;
};

export type ToolParameters =
  | FileToolParameters
  | ClaudeCodeToolParameters
  | Record<string, string | number | boolean>;

// Tool execution result types
export type ToolOutput =
  | string // Command output, file content
  | number // Exit codes, file sizes
  | boolean // Success flags
  | object // Structured data
  | null;

// Continue tool metadata - replaces both HandoffMetadata and PhaseTransitionMetadata
export interface ContinueMetadata {
  routingDecision: {
    phase?: Phase;
    destinations: string[]; // Array of agent pubkeys (single or multiple)
    reason: string;
    message: string;
    // Enhanced handoff fields
    summary?: string; // Current state summary
  };
}

// YieldBack tool metadata
export interface YieldBackMetadata {
  completion: {
    response: string;
    summary: string; // Comprehensive summary of work done
    nextAgent: string; // Orchestrator pubkey
  };
}

// EndConversation tool metadata
export interface EndConversationMetadata {
  completion: {
    response: string;
    summary: string; // Comprehensive summary of conversation
    nextAgent: string; // User pubkey
  };
}

// Type guard functions
export function isContinueMetadata(metadata: unknown): metadata is ContinueMetadata {
  return (
    metadata !== null &&
    typeof metadata === "object" &&
    "routingDecision" in metadata &&
    metadata.routingDecision !== null &&
    typeof metadata.routingDecision === "object" &&
    "destinations" in metadata.routingDecision &&
    Array.isArray(metadata.routingDecision.destinations) &&
    "reason" in metadata.routingDecision &&
    typeof metadata.routingDecision.reason === "string" &&
    "message" in metadata.routingDecision &&
    typeof metadata.routingDecision.message === "string"
  );
}

export function isYieldBackMetadata(metadata: unknown): metadata is YieldBackMetadata {
  return (
    metadata !== null &&
    typeof metadata === "object" &&
    "completion" in metadata &&
    metadata.completion !== null &&
    typeof metadata.completion === "object" &&
    "response" in metadata.completion &&
    typeof metadata.completion.response === "string" &&
    "summary" in metadata.completion &&
    typeof metadata.completion.summary === "string" &&
    "nextAgent" in metadata.completion &&
    typeof metadata.completion.nextAgent === "string"
  );
}

export function isEndConversationMetadata(metadata: unknown): metadata is EndConversationMetadata {
  return (
    metadata !== null &&
    typeof metadata === "object" &&
    "completion" in metadata &&
    metadata.completion !== null &&
    typeof metadata.completion === "object" &&
    "response" in metadata.completion &&
    typeof metadata.completion.response === "string" &&
    "summary" in metadata.completion &&
    typeof metadata.completion.summary === "string" &&
    "nextAgent" in metadata.completion &&
    typeof metadata.completion.nextAgent === "string"
  );
}

// Generic metadata interface for other tools
export interface ToolExecutionMetadata {
  exitCode?: number;
  fileSize?: number;
  encoding?: string;
  mimeType?: string;
  duration?: number;
  [key: string]: string | number | boolean | undefined | object;
}

export interface ToolInvocation {
  toolName: string;
  action: string;
  parameters: ToolParameters;
  rawMatch: string;
}

// Tool execution result
export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  metadata?: ToolExecutionMetadata | ContinueMetadata | YieldBackMetadata | EndConversationMetadata;
}

// Plugin parameter type from multi-llm-ts
export interface PluginParameter {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  required?: boolean;
  enum?: string[];
  items?: PluginParameter; // For arrays
  properties?: Record<string, PluginParameter>; // For objects
}

// Tool definition with structured parameters for native function calling
export interface Tool {
  name: string;
  description: string;
  parameters: PluginParameter[];
  execute: (params: Record<string, unknown>, context: ToolExecutionContext) => Promise<ToolResult>;
}

import type { Agent } from "@/agents/types";
import type { Phase } from "@/conversations/phases";
import type { Conversation } from "@/conversations/types";
import type { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";

export interface ToolExecutionContext {
  projectPath: string;
  conversationId: string;
  phase: string;
  agent: Agent;
  conversation?: Conversation;
  agentSigner?: NDKPrivateKeySigner; // NDK signer for the agent
  conversationRootEventId?: string; // Root event ID for task tagging
  triggeringEvent?: NDKEvent; // The event that triggered this agent execution
}

export interface ToolExecutionResult {
  success: boolean;
  output?: ToolOutput;
  error?: string;
  duration: number;
  metadata?: ToolExecutionMetadata | ContinueMetadata | YieldBackMetadata | EndConversationMetadata;
  toolName?: string;
}

export interface ToolExecutor {
  name: string;
  execute(invocation: ToolInvocation, context: ToolExecutionContext): Promise<ToolExecutionResult>;
  canExecute(toolName: string): boolean;
}

export interface ToolPattern {
  pattern: RegExp;
  parser: (match: RegExpMatchArray) => ToolInvocation | null;
}

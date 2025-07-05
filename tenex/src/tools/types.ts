/**
 * Type-safe tool system for TENEX
 * Based on algebraic data types and effect system
 */

import type { Phase } from "@/conversations/phases";
import type { Agent } from "@/agents/types";
import type { Conversation } from "@/conversations/types";
import type { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import type { AgentInfo } from "./core";

// Re-export core types
export * from "./core";
export * from "./executor";
export * from "./interpreter";
export * from "./zod-schema";

// Tool execution context
export interface ToolExecutionContext {
  projectPath: string;
  conversationId: string;
  phase: Phase;
  agent: Agent;
  conversation?: Conversation;
  agentSigner?: NDKPrivateKeySigner;
  conversationRootEventId?: string;
  triggeringEvent?: NDKEvent;

  // Agent identification
  agentId: string;
  agentName: string;

  // For control context
  isOrchestrator?: boolean;
  availableAgents?: AgentInfo[];

  // For terminal context
  orchestratorPubkey?: string;
  userPubkey?: string;
}

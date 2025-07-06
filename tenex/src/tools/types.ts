/**
 * Simplified tool system for TENEX
 */

import type { Phase } from "@/conversations/phases";
import type { Agent } from "@/agents/types";
import type { Conversation } from "@/conversations/types";
import type { ConversationManager } from "@/conversations/ConversationManager";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type { NostrPublisher } from "@/nostr/NostrPublisher";

// Re-export core types
export * from "./core";
export * from "./executor";
export * from "./zod-schema";

// Tool execution context
export interface ToolExecutionContext {
  projectPath: string;
  conversationId: string;
  phase: Phase;
  agent: Agent;
  conversation: Conversation;
  publisher: NostrPublisher;
  triggeringEvent?: NDKEvent;
  conversationManager?: ConversationManager;
}

import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type { Conversation } from "@/conversations/types";
import type { Agent } from "@/agents/types";
import type { RoutingDecision } from "@/routing/types";
import type { ConversationManager } from "@/conversations";
import type { RoutingLLM } from "@/routing/RoutingLLM";
import type { ConversationPublisher } from "@/nostr";
import type { AgentExecutor } from "@/agents";

export interface RoutingContext {
  event: NDKEvent;
  conversation: Conversation;
  availableAgents: Agent[];
  routingDecision?: RoutingDecision;
  handled: boolean;
  error?: Error;
  
  // Shared services
  conversationManager: ConversationManager;
  routingLLM: RoutingLLM;
  publisher: ConversationPublisher;
  agentExecutor: AgentExecutor;
}

export interface MessageHandler {
  name: string;
  canHandle(context: RoutingContext): boolean;
  handle(context: RoutingContext): Promise<RoutingContext>;
}
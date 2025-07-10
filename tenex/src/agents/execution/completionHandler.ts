import { getProjectContext } from "@/services/ProjectContext";
import { logger } from "@/utils/logger";
import type { Complete } from "@/tools/types";
import type { NostrPublisher } from "@/nostr/NostrPublisher";
import type { Agent } from "@/agents/types";
import type { NDKEvent } from "@nostr-dev-kit/ndk";

/**
 * Shared completion logic used by both the complete() tool and ClaudeBackend
 * Ensures consistent behavior when agents complete their tasks
 */

export interface CompletionOptions {
  response: string;
  summary?: string;
  agent: Agent;
  conversationId: string;
  publisher: NostrPublisher;
  triggeringEvent?: NDKEvent;
}

/**
 * Handle agent task completion by publishing to orchestrator and logging
 * This is the core logic extracted from the complete() tool
 */
export async function handleAgentCompletion(options: CompletionOptions): Promise<Complete> {
  const { response, summary, agent, conversationId, publisher, triggeringEvent } = options;
  
  const projectContext = getProjectContext();
  const orchestratorAgent = projectContext.getProjectAgent();
  
  // Determine who to respond to:
  // If we have a triggering event, respond to its author
  // Otherwise fall back to the orchestrator
  const respondToPubkey = triggeringEvent?.pubkey || orchestratorAgent.pubkey;
  
  // Publish the completion event
  await publisher.publishResponse({
    content: response,
    destinationPubkeys: [respondToPubkey],
    completeMetadata: {
      type: "complete",
      completion: {
        response,
        summary: summary || response,
        nextAgent: respondToPubkey,
      }
    }
  });
  
  logger.info("Completion event published", {
    to: respondToPubkey,
    agent: agent.name,
    isOrchestrator: respondToPubkey === orchestratorAgent.pubkey,
  });
  
  // Log the completion
  logger.info("✅ Task completion signaled", {
    agent: agent.name,
    agentId: agent.pubkey,
    returningTo: respondToPubkey,
    hasResponse: !!response,
    conversationId: conversationId,
  });
  
  // Return the Complete termination
  return {
    type: "complete",
    completion: {
      response,
      summary: summary || response,
      nextAgent: respondToPubkey,
    },
  };
}
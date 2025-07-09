import { getProjectContext } from "@/services/ProjectContext";
import { logger } from "@/utils/logger";
import type { Complete } from "@/tools/types";
import type { NostrPublisher } from "@/nostr/NostrPublisher";
import type { Agent } from "@/agents/types";

/**
 * Shared completion logic used by both the complete() tool and ClaudeBackend
 * Ensures consistent behavior when agents complete their tasks
 */

export interface CompletionOptions {
  response: string;
  summary?: string;
  agent: Agent;
  conversationId: string;
  publisher?: NostrPublisher;
}

/**
 * Handle agent task completion by publishing to orchestrator and logging
 * This is the core logic extracted from the complete() tool
 */
export async function handleAgentCompletion(options: CompletionOptions): Promise<Complete> {
  const { response, summary, agent, conversationId, publisher } = options;
  
  const projectContext = getProjectContext();
  const orchestratorAgent = projectContext.getProjectAgent();
  
  // Publish the completion event if publisher is provided
  if (publisher) {
    await publisher.publishResponse({
      content: response,
      destinationPubkeys: [orchestratorAgent.pubkey],
      completeMetadata: {
        type: "complete",
        completion: {
          response,
          summary: summary || response,
          nextAgent: orchestratorAgent.pubkey,
        }
      }
    });
    
    logger.info("Completion event published", {
      toOrchestrator: orchestratorAgent.pubkey,
      agent: agent.name,
    });
  }
  
  // Log the completion
  logger.info("✅ Task completion signaled", {
    agent: agent.name,
    agentId: agent.pubkey,
    returningTo: orchestratorAgent.name,
    hasResponse: !!response,
    conversationId: conversationId,
  });
  
  // Return the Complete termination
  return {
    type: "complete",
    completion: {
      response,
      summary: summary || response,
      nextAgent: orchestratorAgent.pubkey,
    },
  };
}
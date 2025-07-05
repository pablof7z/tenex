import { getProjectContext } from "@/services/ProjectContext";
import { logger } from "@/utils/logger";
import type { Tool, Termination } from "../types";
import { success, createZodSchema } from "../types";
import { z } from "zod";

const yieldBackSchema = z.object({
  response: z.string().describe("Detailed summary of what was accomplished"),
  summary: z
    .string()
    .optional()
    .describe("Comprehensive summary of work done (if different from response)"),
});

/**
 * Yield back tool - non-orchestrator agents use this to return control
 * Implements the star topology where all agents complete back to orchestrator
 */
export const yieldBackTool: Tool<{
  response: string;
  summary?: string;
}, Termination> = {
  name: "yield_back",
  description: "Return control to the orchestrator after completing assigned task",

  parameters: createZodSchema(yieldBackSchema),

  execute: async (input, context) => {
    const { response, summary } = input.value;

    // TypeScript ensures this is a terminal context with orchestratorPubkey
    // No need to check if orchestrator - type system prevents it!

    const projectContext = getProjectContext();
    const orchestratorAgent = projectContext.getProjectAgent();

    // Validate orchestrator pubkey matches project agent
    if (orchestratorAgent.pubkey !== projectContext.orchestrator.pubkey) {
      logger.warn("Orchestrator pubkey mismatch", {
        expected: projectContext.orchestrator.pubkey,
        actual: orchestratorAgent.pubkey,
      });
    }

    logger.info("📬 Yielding control back to orchestrator (star topology)", {
      tool: "yield_back",
      fromAgent: context.agent.name,
      toOrchestrator: orchestratorAgent.name,
      conversationId: context.conversationId,
    });

    // Publish the completion event directly
    await context.publisher.publishResponse({
      content: response,
      completeMetadata: {
        type: "yield_back",
        completion: {
          response,
          summary: summary || response,
          nextAgent: orchestratorAgent.pubkey,
        }
      }
    });

    logger.info("Yield back published completion event", {
      toOrchestrator: orchestratorAgent.pubkey,
    });

    // Log the completion
    logger.info("✅ Task completion signaled", {
      tool: "yield_back",
      agent: context.agent.name,
      agentId: context.agent.pubkey,
      returningTo: orchestratorAgent.name,
      hasResponse: !!response,
      conversationId: context.conversationId,
    });

    // Return properly typed termination
    return success({
      type: "yield_back",
      completion: {
        response,
        summary: summary || response, // Use summary if provided, otherwise use response
        nextAgent: orchestratorAgent.pubkey,
      },
    });
  },
};

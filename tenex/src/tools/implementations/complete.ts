import { getProjectContext } from "@/services/ProjectContext";
import { logger } from "@/utils/logger";
import type { Tool, Termination } from "../types";
import { success, createZodSchema } from "../types";
import { z } from "zod";

const completeSchema = z.object({
  response: z.string().describe("Detailed report of what was accomplished and the results achieved"),
  summary: z
    .string()
    .optional()
    .describe("Comprehensive summary of work done for the orchestrator's context (if different from response)"),
});

/**
 * Complete tool - non-orchestrator agents MUST use this to signal task completion
 * Implements the star topology where all agents report completion to orchestrator
 * YOUR JOB IS NOT DONE UNTIL YOU EXPLICITLY USE THIS TOOL
 */
export const completeTool: Tool<{
  response: string;
  summary?: string;
}, Termination> = {
  name: "complete",
  description: "Signal that you have completed your assigned task and report results to the orchestrator",

  parameters: createZodSchema(completeSchema),

  execute: async (input, context) => {
    const { response, summary } = input.value;

    const projectContext = getProjectContext();
    const orchestratorAgent = projectContext.getProjectAgent();

    // Validate orchestrator pubkey matches project agent
    if (orchestratorAgent.pubkey !== projectContext.orchestrator.pubkey) {
      logger.warn("Orchestrator pubkey mismatch", {
        expected: projectContext.orchestrator.pubkey,
        actual: orchestratorAgent.pubkey,
      });
    }

    logger.info("📬 Completing task and returning control to orchestrator (star topology)", {
      tool: "complete",
      fromAgent: context.agent.name,
      toOrchestrator: orchestratorAgent.name,
      conversationId: context.conversationId,
    });

    // Publish the completion event directly
    await context.publisher.publishResponse({
      content: response,
      completeMetadata: {
        type: "complete",
        completion: {
          response,
          summary: summary || response,
          nextAgent: orchestratorAgent.pubkey,
        }
      }
    });

    logger.info("Complete tool published completion event", {
      toOrchestrator: orchestratorAgent.pubkey,
    });

    // Log the completion
    logger.info("✅ Task completion signaled", {
      tool: "complete",
      agent: context.agent.name,
      agentId: context.agent.pubkey,
      returningTo: orchestratorAgent.name,
      hasResponse: !!response,
      conversationId: context.conversationId,
    });

    // Return properly typed termination
    return success({
      type: "complete",
      completion: {
        response,
        summary: summary || response, // Use summary if provided, otherwise use response
        nextAgent: orchestratorAgent.pubkey,
      },
    });
  },
};

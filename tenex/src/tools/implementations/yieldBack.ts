import { getProjectContext } from "@/services/ProjectContext";
import { logger } from "@/utils/logger";
import type { TerminalTool } from "../types";
import { pure, createZodSchema } from "../types";
import { z } from "zod";

const yieldBackSchema = z.object({
  response: z.string().describe("Detailed summary of what was accomplished"),
  summary: z.string().optional().describe("Comprehensive summary of work done (if different from response)"),
});

/**
 * Yield back tool - non-orchestrator agents use this to return control
 * Implements the star topology where all agents complete back to orchestrator
 */
export const yieldBackTool: TerminalTool<{
  response: string;
  summary?: string;
}> = {
  brand: { _brand: "terminal" },
  name: "yield_back",
  description: "Return control to the orchestrator after completing assigned task",
  
  parameters: createZodSchema(yieldBackSchema),

  execute: (input, context) => {
    const { response, summary } = input.value;

    // TypeScript ensures this is a terminal context with orchestratorPubkey
    // No need to check if orchestrator - type system prevents it!

    const projectContext = getProjectContext();
    const orchestratorAgent = projectContext.getProjectAgent();
    
    // Validate orchestrator pubkey matches
    if (context.orchestratorPubkey !== orchestratorAgent.pubkey) {
      logger.warn("Orchestrator pubkey mismatch", {
        expected: orchestratorAgent.pubkey,
        actual: context.orchestratorPubkey,
      });
    }

    logger.info("📬 Yielding control back to orchestrator (star topology)", {
      tool: "yield_back",
      fromAgent: context.agentName,
      toOrchestrator: orchestratorAgent.name,
      conversationId: context.conversationId,
    });

    // Log the completion
    logger.info("✅ Task completion signaled", {
      tool: "yield_back",
      agent: context.agentName,
      agentId: context.agentId,
      returningTo: orchestratorAgent.name,
      hasResponse: !!response,
      conversationId: context.conversationId,
    });

    // Return properly typed termination
    return pure({
      type: "yield_back",
      completion: {
        response,
        summary: summary || response, // Use summary if provided, otherwise use response
        nextAgent: context.orchestratorPubkey,
      },
    });
  },
};
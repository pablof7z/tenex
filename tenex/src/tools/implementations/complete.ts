import type { Tool, Termination } from "../types";
import { success, createZodSchema } from "../types";
import { z } from "zod";
import { handleAgentCompletion } from "@/agents/execution/completionHandler";

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

    // Use the shared completion handler
    const completion = await handleAgentCompletion({
      response,
      summary,
      agent: context.agent,
      conversationId: context.conversationId,
      publisher: context.publisher,
      triggeringEvent: context.triggeringEvent,
    });

    // Return success with the completion
    return success(completion);
  },
};

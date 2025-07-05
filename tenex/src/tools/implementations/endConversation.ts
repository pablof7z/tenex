import { logger } from "@/utils/logger";
import type { TerminalTool } from "../types";
import { pure, createZodSchema } from "../types";
import { z } from "zod";

const endConversationSchema = z.object({
  response: z.string().describe("Final response to the user summarizing the conversation outcome"),
  summary: z.string().optional().describe("Comprehensive summary of the entire conversation (if different from response)"),
});

/**
 * End conversation tool - orchestrator-only tool to conclude conversations
 * Returns final response to the user
 */
export const endConversationTool: TerminalTool<{
  response: string;
  summary?: string;
}> = {
  brand: { _brand: "terminal" },
  name: "end_conversation",
  description: "Conclude the conversation and return final response to the user",
  
  parameters: createZodSchema(endConversationSchema),

  execute: (input, context) => {
    const { response, summary } = input.value;

    // TypeScript ensures this is a terminal context with userPubkey
    // The executor will have already validated this is an orchestrator

    logger.info("📬 Orchestrator concluding conversation", {
      tool: "end_conversation",
      conversationId: context.conversationId,
    });

    // Log the completion
    logger.info("✅ Conversation concluded", {
      tool: "end_conversation",
      agent: context.agentName,
      agentId: context.agentId,
      returningTo: "user",
      hasResponse: !!response,
      conversationId: context.conversationId,
    });

    // Return properly typed termination
    return pure({
      type: "end_conversation",
      result: {
        response,
        summary: summary || response, // Use summary if provided, otherwise use response
        success: true, // Can add logic to determine success based on context
      },
    });
  },
};
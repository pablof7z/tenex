import { logger } from "@/utils/logger";
import { z } from "zod";
import type { Tool, ToolExecutionContext, ToolResult, EndConversationMetadata } from "../types";
import { parseToolParams } from "../utils";

const EndConversationArgsSchema = z.object({
  response: z.string().describe("Final response to the user summarizing the conversation outcome"),
  summary: z.string().describe("Comprehensive summary of the entire conversation (if different from response)").optional(),
});

// Re-export from types
export type { EndConversationMetadata } from "../types";

export const endConversationTool: Tool = {
  name: "end_conversation",
  description: "Conclude the conversation and return final response to the user",
  parameters: [
    {
      name: "response",
      type: "string",
      description: "Final response to the user summarizing the conversation outcome",
      required: true,
    },
    {
      name: "summary",
      type: "string", 
      description: "Comprehensive summary of the entire conversation (if different from response)",
      required: false,
    },
  ],

  async execute(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const parseResult = parseToolParams(EndConversationArgsSchema, params);
    if (!parseResult.success) {
      return parseResult.errorResult;
    }

    const { response, summary } = parseResult.data;

    // This tool should only be used by orchestrator agents
    if (!context.agent?.isOrchestrator) {
      return {
        success: false,
        error: "Only orchestrator agents can use 'end_conversation'. Use 'yield_back' to return control to the orchestrator.",
      };
    }

    // Orchestrator completes to user (conversation root)
    const rootEvent = context.conversation?.history[0];
    if (!rootEvent || !rootEvent.pubkey) {
      return {
        success: false,
        error: "Cannot route to user: root event or author pubkey not found",
      };
    }
    
    const nextAgent = rootEvent.pubkey;
    const nextAgentName = "user";
    
    logger.info("📬 Orchestrator concluding conversation", {
      tool: "end_conversation",
      conversationId: context.conversationId,
    });

    // Log the completion
    logger.info("✅ Conversation concluded", {
      tool: "end_conversation",
      agent: context.agent?.name || "unknown",
      agentPubkey: context.agent?.pubkey || "unknown",
      returningTo: nextAgentName,
      hasResponse: !!response,
      conversationId: context.conversationId,
    });

    const metadata: EndConversationMetadata = {
      completion: {
        response,
        summary: summary || response, // Use summary if provided, otherwise use response
        nextAgent,
      },
    };

    return {
      success: true,
      output: `Conversation concluded${response ? `: ${response}` : ""}. Returning to ${nextAgentName}.`,
      metadata,
    };
  },
};
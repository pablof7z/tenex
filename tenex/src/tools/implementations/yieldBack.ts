import { getProjectContext } from "@/services/ProjectContext";
import { logger } from "@/utils/logger";
import { z } from "zod";
import type { Tool, ToolExecutionContext, ToolResult, YieldBackMetadata } from "../types";
import { parseToolParams } from "../utils";

const YieldBackArgsSchema = z.object({
  response: z.string().describe("Detailed summary of what was accomplished"),
  summary: z.string().describe("Comprehensive summary of work done (if different from response)").optional(),
});

// Re-export from types
export type { YieldBackMetadata } from "../types";

export const yieldBackTool: Tool = {
  name: "yield_back",
  description: "Return control to the orchestrator after completing assigned task",
  parameters: [
    {
      name: "response",
      type: "string",
      description: "Detailed summary of what was accomplished",
      required: true,
    },
    {
      name: "summary",
      type: "string", 
      description: "Comprehensive summary of work done (if different from response)",
      required: false,
    },
  ],

  async execute(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const parseResult = parseToolParams(YieldBackArgsSchema, params);
    if (!parseResult.success) {
      return parseResult.errorResult;
    }

    const { response, summary } = parseResult.data;

    // This tool should only be used by non-orchestrator agents
    if (context.agent?.isOrchestrator) {
      return {
        success: false,
        error: "Orchestrator agents should use 'end_conversation' instead of 'yield_back'",
      };
    }

    const projectContext = getProjectContext();
    const orchestratorAgent = projectContext.getProjectAgent();

    // ALL non-orchestrator agents ALWAYS return to orchestrator (star topology)
    const nextAgent = orchestratorAgent.pubkey;
    const nextAgentName = orchestratorAgent.name;
    
    logger.info("📬 Yielding control back to orchestrator (star topology)", {
      tool: "yield_back",
      fromAgent: context.agent?.name || "unknown",
      toOrchestrator: nextAgentName,
      conversationId: context.conversationId,
    });

    // Log the completion
    logger.info("✅ Task completion signaled", {
      tool: "yield_back",
      agent: context.agent?.name || "unknown",
      agentPubkey: context.agent?.pubkey || "unknown",
      returningTo: nextAgentName,
      hasResponse: !!response,
      conversationId: context.conversationId,
    });

    const metadata: YieldBackMetadata = {
      completion: {
        response,
        summary: summary || response, // Use summary if provided, otherwise use response
        nextAgent,
      },
    };

    return {
      success: true,
      output: `Completed task${response ? `: ${response}` : ""}. Yielding control back to ${nextAgentName}.`,
      metadata,
    };
  },
};
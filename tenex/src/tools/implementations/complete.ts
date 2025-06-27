import { z } from "zod";
import type { Tool, ToolExecutionContext, ToolResult } from "../types";
import { logger } from "@/utils/logger";
import { parseToolParams } from "../utils";
import { getProjectContext } from "@/services/ProjectContext";

const CompleteArgsSchema = z.object({
    response: z.string().optional(),
});

export interface CompleteMetadata {
    completion: {
        response: string;
        nextAgent: string; // PM pubkey or "user"
    };
}

export const completeTool: Tool = {
    name: "complete",
    description: "Signal task completion and return control",
    parameters: [
        {
            name: "response",
            type: "string",
            description: "Summary of what was accomplished (optional)",
            required: false,
        },
    ],

    async execute(
        params: Record<string, unknown>,
        context: ToolExecutionContext
    ): Promise<ToolResult> {
        const parseResult = parseToolParams(CompleteArgsSchema, params);
        if (!parseResult.success) {
            return parseResult.errorResult;
        }

        const { response = "" } = parseResult.data;

        // Determine who to notify
        let nextAgent: string;
        let nextAgentName: string;
        
        if (context.agent?.isPMAgent) {
            // PM completes to user
            nextAgent = "user";
            nextAgentName = "user";
        } else {
            // Specialists complete to PM
            try {
                const projectContext = getProjectContext();
                const pmAgent = projectContext.getProjectAgent();
                nextAgent = pmAgent.pubkey;
                nextAgentName = pmAgent.name;
            } catch (_error) {
                return {
                    success: false,
                    error: "Could not find PM agent to return control to",
                };
            }
        }

        // Log the completion
        logger.info("✅ Task completion signaled", {
            tool: "complete",
            agent: context.agent?.name || "unknown",
            agentPubkey: context.agent?.pubkey || "unknown",
            isPMAgent: context.agent?.isPMAgent || false,
            returningTo: nextAgentName,
            hasResponse: !!response,
            conversationId: context.conversationId,
        });

        const metadata: CompleteMetadata = {
            completion: {
                response,
                nextAgent,
            },
        };

        return {
            success: true,
            output: `Completed task${response ? `: ${response}` : ""}. Returning control to ${nextAgentName}.`,
            metadata,
        };
    },
};
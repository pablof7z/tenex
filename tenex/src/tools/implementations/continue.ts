import { z } from "zod";
import type { Tool, ToolExecutionContext, ToolResult } from "../types";
import { logger } from "@/utils/logger";
import { type Phase, ALL_PHASES } from "@/conversations/phases";
import { parseToolParams } from "../utils";
import { getProjectContext, type ProjectContext } from "@/services/ProjectContext";

const ContinueArgsSchema = z.object({
    phase: z.enum(ALL_PHASES as [Phase, ...Phase[]]).optional(),
    destination: z.string().min(1, "destination must be a non-empty string"),
    reason: z.string().min(1, "reason must be a non-empty string"),
    message: z.string().min(1, "message must be a non-empty string"),
});

export interface ContinueMetadata {
    routingDecision: {
        phase?: Phase;
        destination: string;     // Agent pubkey or "user"
        destinationName: string; // Human-readable name
        reason: string;
        message: string;
    };
}

export const continueTool: Tool = {
    name: "continue",
    description: "Route conversation to next phase/agent (PM agents only)",
    parameters: [
        {
            name: "phase",
            type: "string",
            description: `Target phase (optional): ${ALL_PHASES.join(", ")}`,
            required: false,
            enum: ALL_PHASES as string[],
        },
        {
            name: "destination",
            type: "string",
            description: 'Agent slug (e.g., "executer", "planner") or "user"',
            required: true,
        },
        {
            name: "reason",
            type: "string",
            description: "Reason for this routing decision",
            required: true,
        },
        {
            name: "message",
            type: "string",
            description: "Context/instructions for the destination agent",
            required: true,
        },
    ],

    async execute(
        params: Record<string, unknown>,
        context: ToolExecutionContext
    ): Promise<ToolResult> {
        const parseResult = parseToolParams(ContinueArgsSchema, params);
        if (!parseResult.success) {
            return parseResult.errorResult;
        }

        const { phase, destination, reason, message } = parseResult.data;

        // Check if agent is PM
        if (!context.agent?.isPMAgent) {
            return {
                success: false,
                error: "Only the PM agent can use the continue tool",
            };
        }


        // Handle routing to user
        if (destination.toLowerCase() === "user") {
            logger.info("🔄 Continue to user requested", {
                tool: "continue",
                fromAgent: context.agent.name,
                fromPubkey: context.agent.pubkey,
                phase: phase || context.phase,
                reason: reason,
                messagePreview: `${message.substring(0, 100)}...`,
                conversationId: context.conversationId,
            });

            const metadata: ContinueMetadata = {
                routingDecision: {
                    phase,
                    destination: "user",
                    destinationName: "user",
                    reason,
                    message,
                },
            };

            return {
                success: true,
                output: `Routing to user${phase ? ` in ${phase} phase` : ""}`,
                metadata,
            };
        }

        // Handle routing to agent
        let projectContext: ProjectContext;
        try {
            projectContext = getProjectContext();
        } catch (_error) {
            return {
                success: false,
                error: "Project context not available",
            };
        }

        const targetAgent = projectContext.agents.get(destination);
        if (!targetAgent) {
            const availableAgents = Array.from(projectContext.agents.keys()).join(", ");
            return {
                success: false,
                error: `Agent '${destination}' not found. Available agents: ${availableAgents}`,
            };
        }

        // Prevent routing to self
        if (targetAgent.pubkey === context.agent.pubkey) {
            return {
                success: false,
                error: "Cannot route to self",
            };
        }

        // Log the routing decision
        logger.info("🔄 Agent routing requested", {
            tool: "continue",
            fromAgent: context.agent.name,
            fromPubkey: context.agent.pubkey,
            toAgent: targetAgent.name,
            toPubkey: targetAgent.pubkey,
            phase: phase || context.phase,
            reason: reason,
            messagePreview: `${message.substring(0, 100)}...`,
            conversationId: context.conversationId,
        });

        const metadata: ContinueMetadata = {
            routingDecision: {
                phase,
                destination: targetAgent.pubkey,
                destinationName: targetAgent.name,
                reason,
                message,
            },
        };

        return {
            success: true,
            output: `Routing to ${targetAgent.name}${phase ? ` in ${phase} phase` : ""}`,
            metadata,
        };
    },
};
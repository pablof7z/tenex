import { z } from "zod";
import type { Tool, ToolExecutionContext, ToolResult, HandoffMetadata } from "../types";
import type { Agent } from "@/agents/types";
import { logger } from "@/utils/logger";
import { getProjectContext } from "@/services/ProjectContext";

const HandoffArgsSchema = z.object({
    target: z.string().min(1, "target must be a non-empty string"),
    message: z.string().optional(),
});

export const handoffTool: Tool = {
    name: "handoff",
    description: "Hand off the conversation to another agent or back to the user (PM agents only)",
    parameters: [
        {
            name: "target",
            type: "string",
            description: 'Agent slug (e.g., "frontend-dev") or "user" to hand back to human',
            required: true,
        },
        {
            name: "message",
            type: "string",
            description: "Optional context message for the handoff",
            required: false,
        },
    ],

    async execute(
        params: Record<string, unknown>,
        context: ToolExecutionContext
    ): Promise<ToolResult> {
        const parsed = HandoffArgsSchema.safeParse(params);
        if (!parsed.success) {
            return {
                success: false,
                error: `Invalid arguments: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
            };
        }

        const { target, message } = parsed.data;

        // Check if agent is PM
        if (!context.agent?.isPMAgent) {
            return {
                success: false,
                error: "Only the PM agent can hand off conversations",
            };
        }

        // Handle handoff to user
        if (target.toLowerCase() === "user") {
            logger.info("🤝 Handoff to user requested", {
                tool: "handoff",
                fromAgent: context.agent.name,
                fromPubkey: context.agent.pubkey,
                phase: context.phase,
                message: message,
                conversationId: context.conversationId,
            });

            const metadata: HandoffMetadata = {
                handoff: {
                    to: "user",
                    toName: "user",
                    message: message,
                },
            };

            return {
                success: true,
                output: `Handing off to user${message ? `: ${message}` : ""}`,
                metadata,
            };
        }

        // Handle handoff to agent
        let availableAgents: Agent[];
        try {
            const projectContext = getProjectContext();
            availableAgents = Array.from(projectContext.agents.values());
        } catch (_error) {
            return {
                success: false,
                error: "Failed to get project context or agents are not available",
            };
        }

        if (availableAgents.length === 0) {
            return {
                success: false,
                error: "No available agents found in project",
            };
        }

        // Look for agent by name first, then by slug
        const foundAgent = availableAgents.find((a) => a.name === target || a.slug === target);

        if (!foundAgent) {
            const availableNames = availableAgents.map((a) => `${a.name} (${a.slug})`).join(", ");
            return {
                success: false,
                error: `Agent '${target}' not found. Available agents: ${availableNames}`,
            };
        }

        // Prevent handoff to self
        if (foundAgent.pubkey === context.agent.pubkey) {
            return {
                success: false,
                error: "Cannot hand off to self",
            };
        }

        // Log the handoff
        logger.info("🤝 Agent handoff requested", {
            tool: "handoff",
            fromAgent: context.agent.name,
            fromPubkey: context.agent.pubkey,
            toAgent: foundAgent.name,
            toPubkey: foundAgent.pubkey,
            phase: context.phase,
            message: message,
            conversationId: context.conversationId,
        });

        const metadata: HandoffMetadata = {
            handoff: {
                to: foundAgent.pubkey,
                toName: foundAgent.name,
                message: message,
            },
        };

        return {
            success: true,
            output: `Handing off to ${foundAgent.name}${message ? `: ${message}` : ""}`,
            metadata,
        };
    },
};

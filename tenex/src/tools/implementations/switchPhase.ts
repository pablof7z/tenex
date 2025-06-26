import { z } from "zod";
import type { Tool, ToolExecutionContext, ToolResult, PhaseTransitionMetadata } from "../types";
import { logger } from "@/utils/logger";
import { type Phase, ALL_PHASES, isValidPhase, PHASE_DESCRIPTIONS } from "@/conversations/phases";

const SwitchPhaseArgsSchema = z.object({
    phase: z.enum(ALL_PHASES as [Phase, ...Phase[]]),
    reason: z.string().optional(),
    message: z.string().min(1, "message must be a non-empty string"),
});

export const switchPhaseTool: Tool = {
    name: "switch_phase",
    description: "Transition to a different workflow phase (PM agents only)",
    parameters: [
        {
            name: "phase",
            type: "string",
            description: `Target phase: ${ALL_PHASES.join(", ")}`,
            required: true,
            enum: ALL_PHASES as string[],
        },
        {
            name: "reason",
            type: "string",
            description: "Optional reason for the phase transition",
            required: false,
        },
        {
            name: "message",
            type: "string",
            description: "Comprehensive context for the phase transition",
            required: true,
        },
    ],

    async execute(
        params: Record<string, unknown>,
        context: ToolExecutionContext
    ): Promise<ToolResult> {
        const parsed = SwitchPhaseArgsSchema.safeParse(params);
        if (!parsed.success) {
            return {
                success: false,
                error: `Invalid arguments: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
            };
        }

        const { phase, reason, message } = parsed.data;

        // Check if agent is PM
        if (!context.agent?.isPMAgent) {
            return {
                success: false,
                error: "Only the PM agent can transition phases",
            };
        }

        // Phase validation is already done by zod schema
        const currentPhase = context.phase || "chat";

        // Log the phase transition
        logger.info("🔄 Phase transition requested", {
            tool: "switch_phase",
            fromPhase: currentPhase,
            toPhase: phase,
            agentName: context.agentName,
            agentPubkey: context.agent.pubkey,
            reason: reason,
            messagePreview: `${message.substring(0, 100)}...`,
            conversationId: context.conversationId,
        });

        const metadata: PhaseTransitionMetadata = {
            phaseTransition: {
                from: currentPhase as Phase,
                to: phase,
                message: message,
                reason: reason,
            },
        };

        return {
            success: true,
            output: `Phase transition to '${phase}' requested${reason ? `: ${reason}` : ""}`,
            metadata,
        };
    },
};

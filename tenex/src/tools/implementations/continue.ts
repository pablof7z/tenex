import { ALL_PHASES, type Phase } from "@/conversations/phases";
import { type ProjectContext, getProjectContext } from "@/services/ProjectContext";
import type { Tool, NonEmptyArray } from "../types";
import { success, failure, createZodSchema } from "../types";
import { z } from "zod";

/**
 * Continue tool - orchestrator-only control flow tool
 * Routes conversation to next phase/agent
 */
interface ContinueInput {
    phase?: string;
    agents: string[];
    reason: string;
    messageToAgents: string;
}

export const continueTool: Tool<ContinueInput> = {
    name: "continue",
    description:
        "Route conversation to next phase/agent. REQUIRES 'agents' and 'messageToAgents' parameters. This is a terminal action - once called, the orchestrator's turn ends and control is transferred.",
    promptFragment: `- The continue tool is terminal - it ends your turn immediately.
- The messageToAgents parameter is REQUIRED and is the ONLY message that agents will see. It MUST include what the agent(s) NEED TO DO and what they NEED TO KNOW.
- Do not add assumptions or make anything up - only provide information as you've received it.
- The continue tool allows you to delegate to multiple agents at the same time, when you have multiple agents that have domain expertise of the plan or work involved, ping them all. Once you receive the report back from ALL the agents you pinged provide the work back to @planner or @executer agent detailing the feedback from the agents. DO NOT try to summarize or interpret the feedback, let the relevant agent you delegate to to make sense of the feedback.
`,

    parameters: createZodSchema(
        z.object({
            phase: z
                .string()
                .optional()
                .transform((val) => val?.toLowerCase() as Phase | undefined)
                .refine((val) => !val || ALL_PHASES.includes(val as Phase), {
                    message: `Invalid phase. Expected one of: ${ALL_PHASES.join(", ")}`,
                })
                .describe("Target phase"),
            agents: z.array(z.string()).describe("Array of agent slugs to delegate to"),
            reason: z
                .string()
                .describe(
                    "Used for routing debugging. Provide clear reason that justify this decision, include every detail and thought you had for choosing this routing (e.g., 'Request is clear and specific', 'Need planning due to ambiguity', 'Complex task requires specialized agents'). Always start the reason with 'Here is why I decided this path'. ALWAYS."
                ),
            messageToAgents: z
                .string()
                .describe(
                    "The message that agents will see. This MUST include what the agent(s) NEED TO DO and what they NEED TO KNOW. Be specific and clear, as this is the ONLY message agents will receive."
                ),
        })
    ),

    execute: async (input, context) => {
        const { phase, agents, reason, messageToAgents } = input.value;

        // Runtime check for orchestrator
        if (!context.agent.isOrchestrator) {
            return failure({
                kind: "execution",
                tool: "continue",
                message: "Only orchestrator can use continue tool",
            });
        }

        // Validate agents array is not empty
        if (agents.length === 0) {
            return failure({
                kind: "validation",
                field: "agents",
                message: "Agents array cannot be empty",
            });
        }

        // Get project context
        let projectContext: ProjectContext;
        try {
            projectContext = getProjectContext();
        } catch {
            return failure({
                kind: "system",
                message: "Project context not available",
            });
        }

        // Validate agents and collect valid pubkeys
        const invalidAgents: string[] = [];
        const validPubkeys: string[] = [];
        const validNames: string[] = [];

        for (const agent of agents) {
            const agentDef = projectContext.agents.get(agent);
            if (!agentDef) {
                invalidAgents.push(agent);
            } else if (agentDef.pubkey === context.agent.pubkey) {
                return failure({
                    kind: "validation",
                    field: "agents",
                    message: `Cannot route to self (${agent})`,
                });
            } else {
                validPubkeys.push(agentDef.pubkey);
                validNames.push(agentDef.name);
            }
        }

        if (invalidAgents.length > 0) {
            const availableAgents = Array.from(projectContext.agents.keys()).join(", ");
            return failure({
                kind: "validation",
                field: "agents",
                message: `Agents not found: ${invalidAgents.join(", ")}. Available agents: ${availableAgents}`,
            });
        }

        if (validPubkeys.length === 0) {
            return failure({
                kind: "validation",
                field: "agents",
                message: "No valid target agents found",
            });
        }

        // We know validPubkeys is non-empty due to check above
        const targetAgentPubkeys = validPubkeys as unknown as NonEmptyArray<string>;

        // Use current phase if not specified (phase is already lowercase from schema transform)
        const targetPhase = (phase as Phase) || context.phase;

        // Update phase IMMEDIATELY if transitioning
        if (targetPhase !== context.phase && context.conversationManager) {
            await context.conversationManager.updatePhase(
                context.conversationId,
                targetPhase,
                `Phase transition: ${reason}`,
                context.agent.pubkey,
                context.agent.name,
                reason
            );
        }

        // Return properly typed control flow
        return success({
            type: "continue",
            routing: {
                phase: targetPhase,
                agents: targetAgentPubkeys,
                reason,
                messageToAgents,
            },
        });
    },
};

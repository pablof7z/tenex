import { ALL_PHASES, type Phase } from "@/conversations/phases";
import { type ProjectContext, getProjectContext } from "@/services/ProjectContext";
import { logger } from "@/utils/logger";
import type { Tool, NonEmptyArray, ControlFlow } from "../types";
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
  message: string;
  summary?: string;
}

export const continueTool: Tool<ContinueInput, ControlFlow> = {
  name: "continue",
  description:
    "Route conversation to next phase/agent. REQUIRES 'agents' parameter. This is a terminal action - once called, the orchestrator's turn ends and control is transferred.",
  promptFragment: `- ALWAYS include <thinking> tags before routing to explain your decision\n
- The continue tool is terminal - it ends your turn immediately. When using it, first write a statement for the user to understand what you are doing and *then* use the continue() tool.

The continue tool allows you to delegate to multiple agents at the same time, when you have multiple agents that have domain expertise of the plan or work involved, ping them all. Once you receive the report back from ALL the agents you pinged provide the work back to @planner or @executer agent detailing the feedback from the agents. DO NOT try to summarize or interpret the feedback, let the relevant agent you delegate to to make sense of the feedback.
`,

  parameters: createZodSchema(
    z.object({
      phase: z
        .string()
        .optional()
        .transform((val) => val?.toLowerCase() as Phase | undefined)
        .refine(
          (val) => !val || ALL_PHASES.includes(val as Phase),
          {
            message: `Invalid phase. Expected one of: ${ALL_PHASES.join(', ')}`
          }
        )
        .describe("Target phase"),
      agents: z.array(z.string()).describe("Array of agent slugs to delegate to"),
      reason: z.string().describe("Used for routing debugging. Provide clear reason that justify this decision, include every detail and thought you had for choosing this routing (e.g., 'Request is clear and specific', 'Need planning due to ambiguity', 'Complex task requires specialized agents'). Always start the reason with 'Here is why I decided this path'. ALWAYS."),
      message: z.string().describe("Context/instructions for the agent being delegated to."),
      summary: z.string().optional().describe("User-facing 2-3 sentence overview of current state.")
    })
  ),

  execute: async (input, context) => {
    const { phase, agents, reason, message, summary } = input.value;

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

    logger.info("Continue tool routing", {
      phase,
      agents: validPubkeys,
      names: validNames,
      reason,
    });

    // We know validPubkeys is non-empty due to check above
    const targetAgentPubkeys = validPubkeys as unknown as NonEmptyArray<string>;

    // Use current phase if not specified (phase is already lowercase from schema transform)
    const targetPhase = (phase as Phase) || context.conversation.phase;

    logger.info("[CONTINUE] Phase transition requested", {
      requestedPhase: phase,
      currentPhase: context.conversation.phase,
      targetPhase,
      conversationId: context.conversation.id,
      agents: validPubkeys,
    });

    // Update phase IMMEDIATELY if transitioning
    if (targetPhase !== context.conversation.phase && context.conversationManager) {
      logger.info("[CONTINUE] Updating phase before routing", {
        from: context.conversation.phase,
        to: targetPhase,
        conversationId: context.conversation.id,
      });
      
      await context.conversationManager.updatePhase(
        context.conversation.id,
        targetPhase,
        message,
        context.agent.pubkey,
        context.agent.name,
        reason,
        summary
      );
    }

    // Publish the routing event directly
    await context.publisher.publishResponse({
      content: message,  // Use the routing message as content
      destinationPubkeys: Array.from(targetAgentPubkeys),  // Convert to regular array
      continueMetadata: {
        type: "continue",
        routing: {
          phase: targetPhase,
          agents: targetAgentPubkeys,
          reason,
          message,
          context: summary ? { summary } : undefined,
        }
      }
    });

    logger.info("Continue tool published routing event", {
      agents: validPubkeys,
      phase: targetPhase,
    });

    // Return properly typed control flow
    return success({
      type: "continue",
      routing: {
        phase: targetPhase,
        agents: targetAgentPubkeys,
        reason,
        message,
        context: summary ? { summary } : undefined,
      },
    });
  },
};

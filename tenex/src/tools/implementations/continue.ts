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
  phase?: Phase;
  agents?: string[];
  reason: string;
  message: string;
  summary?: string;
}

export const continueTool: Tool<ContinueInput, ControlFlow> = {
  name: "continue",
  description:
    "Route conversation to next phase/agent. REQUIRES either 'phase' or 'agents' parameter (or both). This is a terminal action - once called, the agent's turn ends and control is transferred.",

  parameters: createZodSchema(
    z.object({
      phase: z
        .enum(ALL_PHASES as readonly [Phase, ...Phase[]])
        .optional()
        .describe("Target phase"),
      agents: z.array(z.string()).optional().describe("Array of agent slugs or pubkeys"),
      reason: z.string().describe("Reason for choosing this routing (e.g., 'Request is clear and specific', 'Need planning due to ambiguity', 'Complex task requires specialized agents')"),
      message: z.string().describe("Context/instructions for the destination agent"),
      summary: z.string().optional().describe("2-3 sentence overview of current state"),
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

    // Determine agents based on phase if not provided
    let targetAgents = agents;
    if (!targetAgents || targetAgents.length === 0) {
      if (!phase) {
        return failure({
          kind: "validation",
          field: "agents/phase",
          message: "Either 'agents' or 'phase' must be specified",
        });
      }

      // Default agents based on phase
      switch (phase) {
        case "plan":
          targetAgents = ["planner"];
          break;
        case "execute":
          targetAgents = ["executer"];
          break;
        default:
          return failure({
            kind: "validation",
            field: "phase",
            message: `No default agent for phase '${phase}'. Please specify agents explicitly.`,
          });
      }
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

    for (const agent of targetAgents) {
      if (agent.length === 64 && /^[0-9a-f]{64}$/i.test(agent)) {
        // Check if agent is already a pubkey (64-char hex)
        // Prevent routing to self
        if (agent === context.agent.pubkey) {
          return failure({
            kind: "validation",
            field: "agents",
            message: "Cannot route to self",
          });
        }
        validPubkeys.push(agent);
        validNames.push(`pubkey:${agent.substring(0, 8)}...`);
      } else {
        // Treat as agent slug
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

    // Use current phase if not specified
    const targetPhase = phase || context.conversation.phase;

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
      content: message,
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

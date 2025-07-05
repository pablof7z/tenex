import { ALL_PHASES, type Phase } from "@/conversations/phases";
import { type ProjectContext, getProjectContext } from "@/services/ProjectContext";
import { logger } from "@/utils/logger";
import { z } from "zod";
import type { ContinueMetadata, Tool, ToolExecutionContext, ToolResult } from "../types";
import { parseToolParams } from "../utils";

const ContinueArgsSchema = z.object({
  phase: z.enum(ALL_PHASES as [Phase, ...Phase[]]).optional(),
  agents: z
    .array(z.string().min(1))
    .optional(),
  reason: z.string().min(1, "reason must be a non-empty string"),
  message: z.string().min(1, "message must be a non-empty string"),
  // Enhanced handoff fields
  summary: z.string().optional(),
});

export const continueTool: Tool = {
  name: "continue",
  description: "Route conversation to next phase/agent. REQUIRES either 'phase' or 'agents' parameter (or both). This is a terminal action - once called, the agent's turn ends and control is transferred.",
  parameters: [
    {
      name: "phase",
      type: "string",
      description: `Target phase (optional): ${ALL_PHASES.join(", ")}`,
      required: false,
      enum: ALL_PHASES as string[],
    },
    {
      name: "agents",
      type: "array",
      description: 'Array of agent slugs (e.g., ["executer", "planner"]) or pubkeys. If not provided, defaults based on phase.',
      required: false,
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
    {
      name: "summary",
      type: "string",
      description: "2-3 sentence overview of current state and what has been accomplished",
      required: false,
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

    const { phase, agents, reason, message, summary } =
      parseResult.data;

    // Check if agent is orchestrator
    if (!context.agent?.isOrchestrator) {
      return {
        success: false,
        error: "Only the orchestrator agent can use the continue tool",
      };
    }

    // Determine agents based on phase if not provided
    let targetAgents = agents;
    if (!targetAgents || targetAgents.length === 0) {
      if (!phase) {
        return {
          success: false,
          error: "Either 'agents' or 'phase' must be specified",
        };
      }
      
      // Default agents based on phase
      switch (phase) {
        case "plan":
          targetAgents = ["planner"];
          break;
        case "execute":
          targetAgents = ["executer"];
          break;
        case "reflection":
          targetAgents = ["project-manager"];
          break;
        default:
          return {
            success: false,
            error: `No default agent for phase '${phase}'. Please specify agents explicitly.`,
          };
      }
    }

    // Handle destination routing
    return handleDestination({
      phase,
      agents: targetAgents,
      reason,
      message,
      summary,
      context,
    });
  },
};

// Helper function for destination routing
async function handleDestination(params: {
  phase?: Phase;
  agents: string[];
  reason: string;
  message: string;
  summary?: string;
  context: ToolExecutionContext;
}): Promise<ToolResult> {
  const { phase, agents, reason, message, summary, context } =
    params;

  // Get project context
  let projectContext: ProjectContext;
  try {
    projectContext = getProjectContext();
  } catch (_error) {
    return {
      success: false,
      error: "Project context not available",
    };
  }

  // Validate agents and collect valid pubkeys/names
  const invalidAgents: string[] = [];
  const validPubkeys: string[] = [];
  const validNames: string[] = [];

  for (const agent of agents) {
    if (agent.length === 64 && /^[0-9a-f]{64}$/i.test(agent)) {
      // Check if agent is already a pubkey (64-char hex)
      // Prevent routing to self
      if (agent === context.agent.pubkey) {
        return {
          success: false,
          error: "Cannot route to self",
        };
      }
      validPubkeys.push(agent);
      validNames.push(`pubkey:${agent.substring(0, 8)}...`);
    } else {
      // Treat as agent slug
      const agentDef = projectContext.agents.get(agent);
      if (!agentDef) {
        invalidAgents.push(agent);
      } else if (agentDef.pubkey === context.agent.pubkey) {
        return {
          success: false,
          error: `Cannot route to self (${agent})`,
        };
      } else {
        validPubkeys.push(agentDef.pubkey);
        validNames.push(agentDef.name);
      }
    }
  }

  if (invalidAgents.length > 0) {
    const availableAgents = Array.from(projectContext.agents.keys()).join(", ");
    return {
      success: false,
      error: `Agents not found: ${invalidAgents.join(", ")}. Available agents: ${availableAgents}`,
    };
  }

  if (validPubkeys.length === 0) {
    return {
      success: false,
      error: "No valid target agents found",
    };
  }

  const metadata: ContinueMetadata = {
    routingDecision: {
      phase,
      destinations: validPubkeys,
      reason,
      message,
      summary,
    },
  };

  const outputMessage =
    validPubkeys.length === 1
      ? `Routing to ${validNames[0]}${phase ? ` in ${phase} phase` : ""}`
      : `Routing to multiple agents: ${validNames.join(", ")}${phase ? ` in ${phase} phase` : ""}`;

  return {
    success: true,
    output: outputMessage,
    metadata,
  };
}

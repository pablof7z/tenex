import type { Tool, ToolExecutionContext, ToolResult, HandoffMetadata } from '../types';
import type { Agent } from '@/agents/types';
import { logger } from '@/utils/logger';
import { getProjectContext } from '@/services/ProjectContext';

interface HandoffArgs {
  target: string; // Agent name, slug, or "user"
  message?: string; // Optional context for the handoff
}

export const handoffTool: Tool = {
  name: "handoff",
  instructions: `Hand off the conversation to another agent or back to the user (PM agents only).

Use this tool when:
1. A task requires expertise outside your capabilities
2. You need input from the user before proceeding

Usage examples:
<tool_use>
{"tool": "handoff", "args": {"target": "frontend-dev", "message": "Please implement the React components we discussed"}}
</tool_use>

<tool_use>
{"tool": "handoff", "args": {"target": "user", "message": "I need more information about the database requirements"}}
</tool_use>

**Target Options:**
- Agent slug (e.g., "frontend-dev")
- "user" - to hand back to the human user

**Important:**
- Only PM agents can use this tool
- Use "user" as target when you need human input
- The message field is optional but recommended for context`,
  
  async run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const handoffArgs = args as unknown as HandoffArgs;
    
    // Validate args
    if (!handoffArgs.target) {
      return {
        success: false,
        error: 'Missing required parameter: target'
      };
    }
    
    // Check if agent is PM
    if (!context.agent?.isPMAgent) {
      return {
        success: false,
        error: "Only the PM agent can hand off conversations",
      };
    }
    
    // Handle handoff to user
    if (handoffArgs.target.toLowerCase() === 'user') {
      logger.info("🤝 Handoff to user requested", {
        tool: "handoff",
        fromAgent: context.agent.name,
        fromPubkey: context.agent.pubkey,
        phase: context.phase,
        message: handoffArgs.message,
        conversationId: context.conversationId
      });

      const metadata: HandoffMetadata = {
        handoff: {
          to: 'user',
          toName: 'user',
          message: handoffArgs.message
        }
      };

      return {
        success: true,
        output: `Handing off to user${handoffArgs.message ? `: ${handoffArgs.message}` : ''}`,
        metadata
      };
    }
    
    // Handle handoff to agent
    let availableAgents: Agent[];
    try {
      const projectContext = getProjectContext();
      availableAgents = Array.from(projectContext.agents.values());
    } catch (error) {
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
    const foundAgent = availableAgents.find(
      (a) => a.name === handoffArgs.target || a.slug === handoffArgs.target
    );

    if (!foundAgent) {
      const availableNames = availableAgents.map(a => `${a.name} (${a.slug})`).join(", ");
      return {
        success: false,
        error: `Agent '${handoffArgs.target}' not found. Available agents: ${availableNames}`,
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
      message: handoffArgs.message,
      conversationId: context.conversationId
    });

    const metadata: HandoffMetadata = {
      handoff: {
        to: foundAgent.pubkey,
        toName: foundAgent.name,
        message: handoffArgs.message
      }
    };

    return {
      success: true,
      output: `Handing off to ${foundAgent.name}${handoffArgs.message ? `: ${handoffArgs.message}` : ''}`,
      metadata
    };
  }
};
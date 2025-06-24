import type { Tool, ToolExecutionContext, ToolResult } from '../types';
import type { Agent } from '@/agents/types';
import { logger } from '@/utils/logger';
import { getProjectContext } from '@/services/ProjectContext';

interface NextActionArgs {
  action: "handoff" | "phase_transition";
  target: string;
  reason?: string;
  message: string; // NOW MANDATORY: Carries comprehensive context
}

// NextActionContext is now the ToolExecutionContext which has all needed fields
type NextActionContext = ToolExecutionContext;

export const nextActionTool: Tool = {
  name: "next_action",
  instructions: `Specify the next action in the conversation flow (PM agents only).

You MUST use the next_action tool to specify what happens next:

**Phase Transitions:**
IMPORTANT: The 'message' field is MANDATORY for all next_action calls.
For phase transitions, use 'message' to provide comprehensive context:

<tool_use>{ 
  "tool": "next_action", 
  "args": { 
    "action": "phase_transition", 
    "target": "plan", 
    "reason": "requirements clear",
    "message": "## User Requirements\n- Build a CLI tool...\n## Constraints\n- Must be Python 3.8+..."
  }
}</tool_use>

**Agent Handoffs:**
<tool_use>{ 
  "tool": "next_action", 
  "args": { 
    "action": "handoff", 
    "target": "agent_name_or_pubkey", 
    "reason": "why handing off", 
    "message": "Detailed context for the agent to understand the task" 
  }
}</tool_use>

**Message Content Guidelines for Phase Transitions:**

- Chat → Plan: Include user objectives, functional requirements, technical constraints, success criteria
- Plan → Execute: Include approved plan, technical decisions, implementation steps, acceptance criteria
- Execute → Review: Include components implemented, files created/modified, tests written, known issues
- Review → Chores: Include cleanup tasks, documentation needs, deployment steps

**Important Notes:**
- Only PM agents can use this tool
- For handoffs: target can be agent pubkey, name, or slug
- For phase transitions: target must be a valid phase (plan, execute, review, chat, chores)
- The message field is MANDATORY and should contain comprehensive context

CRITICAL: You MUST call next_action at the end of every response, otherwise the conversation stops.`,
  
  async run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    // Cast args to the expected type
    const nextActionArgs = args as unknown as NextActionArgs;
    
    // Validate args
    if (!nextActionArgs.action || !nextActionArgs.target || !nextActionArgs.message) {
      return {
        success: false,
        error: 'Missing required parameters: action, target, and message'
      };
    }
    
    if (nextActionArgs.action !== 'handoff' && nextActionArgs.action !== 'phase_transition') {
      return {
        success: false,
        error: 'Invalid action. Must be "handoff" or "phase_transition"'
      };
    }
    
    // Check if agent is PM
    if (!context.agent?.isPMAgent) {
      return {
        success: false,
        error: "Only the PM agent can specify next actions",
      };
    }
    
    if (nextActionArgs.action === 'handoff') {
      return handleHandoff(nextActionArgs, context);
    }
    
    return handlePhaseTransition(nextActionArgs, context);
  }
};

async function handleHandoff(args: NextActionArgs, context: NextActionContext): Promise<ToolResult> {
  // Get available agents from ProjectContext
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

  // Look for agent by pubkey first, then by name, then by slug
  const foundAgent = availableAgents.find(
    (a) => a.pubkey === args.target || a.name === args.target || a.slug === args.target
  );

  if (!foundAgent) {
    const availableNames = availableAgents.map(a => `${a.name} (${a.slug})`).join(", ");
    return {
      success: false,
      error: `Agent '${args.target}' not found. Available agents: ${availableNames}`,
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
  logger.info("Agent handoff requested", {
    fromAgent: context.agent.name,
    fromPubkey: context.agent.pubkey,
    toAgent: foundAgent.name,
    toPubkey: foundAgent.pubkey,
    phase: context.phase,
    reason: args.reason,
    message: args.message,
  });

  const handoffMessage = args.message 
    ? `Handing off to ${foundAgent.name}: ${args.message}`
    : `Handing off to ${foundAgent.name}`;

  const fullMessage = args.reason 
    ? `${handoffMessage} (Reason: ${args.reason})`
    : handoffMessage;

  return {
    success: true,
    output: fullMessage,
    metadata: {
      actionType: 'handoff',
      targetAgentPubkey: foundAgent.pubkey,
      targetAgentName: foundAgent.name,
      targetAgentSlug: foundAgent.slug,
      fromAgentPubkey: context.agent.pubkey,
      fromAgentName: context.agent.name
    }
  };
}

async function handlePhaseTransition(args: NextActionArgs, context: NextActionContext): Promise<ToolResult> {
  // Validate mandatory message
  if (!args.message) {
    return {
      success: false,
      error: 'Message is required for phase transitions'
    };
  }
  
  // Validate phase
  const validPhases = ["chat", "plan", "execute", "review", "chores"];
  if (!validPhases.includes(args.target)) {
    return {
      success: false,
      error: `Invalid phase: ${args.target}. Valid phases are: ${validPhases.join(", ")}`,
    };
  }

  const currentPhase = context.phase || 'chat';

  // Log the phase transition
  logger.info("Phase transition requested", {
    fromPhase: currentPhase,
    toPhase: args.target,
    agentName: context.agentName,
    reason: args.reason,
    messagePreview: args.message.substring(0, 100) + '...'
  });

  return {
    success: true,
    output: `Phase transition to '${args.target}' requested${args.reason ? `: ${args.reason}` : ""}`,
    metadata: {
      actionType: 'phase_transition',
      requestedPhase: args.target,
      currentPhase: currentPhase,
      fromAgentPubkey: context.agent.pubkey,
      fromAgentName: context.agent.name,
      transitionMessage: args.message // Pass comprehensive context
    }
  };
}
import type { Tool, ToolExecutionContext, ToolResult } from '../types';
import type { Agent } from '@/agents/types';
import { logger } from '@/utils/logger';
import { getProjectContext } from '@/services/ProjectContext';

interface NextActionArgs {
  action: "handoff" | "phase_transition";
  target: string;
  reason?: string;
  message?: string;
}

// NextActionContext is now the ToolExecutionContext which has all needed fields
type NextActionContext = ToolExecutionContext;

export const nextActionTool: Tool = {
  name: "next_action",
  instructions: `Specify the next action in the conversation flow (PM agents only).

You MUST use the next_action tool to specify what happens next:

**Phase Transitions:**
<tool_use>{ "tool": "next_action", "args": { "action": "phase_transition", "target": "plan", "reason": "requirements are clear" } }</tool_use>
<tool_use>{ "tool": "next_action", "args": { "action": "phase_transition", "target": "execute", "reason": "plan is approved" } }</tool_use>
<tool_use>{ "tool": "next_action", "args": { "action": "phase_transition", "target": "review", "reason": "implementation complete" } }</tool_use>
<tool_use>{ "tool": "next_action", "args": { "action": "phase_transition", "target": "chores", "reason": "review complete, cleanup needed" } }</tool_use>
<tool_use>{ "tool": "next_action", "args": { "action": "phase_transition", "target": "chat", "reason": "returning to discussion" } }</tool_use>

**Agent Handoffs:**
<tool_use>{ "tool": "next_action", "args": { "action": "handoff", "target": "agent_name_or_pubkey", "reason": "why handing off", "message": "optional message" } }</tool_use>

**Important Notes:**
- Only PM agents can use this tool
- For handoffs: target can be agent pubkey, name, or slug
- For phase transitions: target must be a valid phase (plan, execute, review, chat, chores)
- Valid phase transitions: chat→plan, plan→execute/chat, execute→review/plan, review→execute/chat/chores, chores→chat

CRITICAL: You MUST call next_action at the end of every response, otherwise the conversation stops.`,
  
  async run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    // Cast args to the expected type
    const nextActionArgs = args as unknown as NextActionArgs;
    
    // Validate args
    if (!nextActionArgs.action || !nextActionArgs.target) {
      return {
        success: false,
        error: 'Missing required parameters: action and target'
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
  // Validate phase
  const validPhases = ["chat", "plan", "execute", "review", "chores"];
  if (!validPhases.includes(args.target)) {
    return {
      success: false,
      error: `Invalid phase: ${args.target}. Valid phases are: ${validPhases.join(", ")}`,
    };
  }

  // Validate phase transition is allowed
  const validTransitions: Record<string, string[]> = {
    chat: ["plan"],
    plan: ["execute", "chat"],
    execute: ["review", "plan"],
    review: ["execute", "chat", "chores"],
    chores: ["chat"],
  };

  const currentPhase = context.phase || 'chat';
  if (!validTransitions[currentPhase]?.includes(args.target)) {
    return {
      success: false,
      error: `Cannot transition from ${currentPhase} to ${args.target}. Valid transitions: ${validTransitions[currentPhase]?.join(", ") || "none"}`,
    };
  }

  // Log the phase transition
  logger.info("Phase transition requested", {
    fromPhase: currentPhase,
    toPhase: args.target,
    agentName: context.agentName,
    reason: args.reason,
  });

  return {
    success: true,
    output: `Phase transition to '${args.target}' requested${args.reason ? `: ${args.reason}` : ""}`,
    metadata: {
      actionType: 'phase_transition',
      requestedPhase: args.target,
      currentPhase: currentPhase,
      fromAgentPubkey: context.agent.pubkey,
      fromAgentName: context.agent.name
    }
  };
}
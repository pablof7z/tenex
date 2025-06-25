import type { Tool, ToolExecutionContext, ToolResult, PhaseTransitionMetadata } from '../types';
import { logger } from '@/utils/logger';
import type { Phase } from '@/conversations/types';

interface SwitchPhaseArgs {
  phase: Phase;
  reason?: string;
  message: string; // Comprehensive context for the phase transition
}

export const switchPhaseTool: Tool = {
  name: "switch_phase",
  instructions: `Transition to a different workflow phase.

Use this tool when you need to move the conversation to a different phase:

<tool_use>{ 
  "tool": "switch_phase", 
  "args": { 
    "phase": "plan", 
    "reason": "requirements are clear",
    "message": "## User Requirements\\n- Build a CLI tool...\\n## Constraints\\n- Must be Python 3.8+..."
  }
}</tool_use>

**Valid Phases:**
- chat: Requirements gathering and discussion
- plan: Planning implementation
- execute: Implementation phase  
- review: Review and validation
- chores: Cleanup tasks

**Message Content Guidelines:**
- Chat → Plan: Include user objectives, functional requirements, technical constraints, success criteria
- Plan → Execute: Include approved plan, technical decisions, implementation steps, acceptance criteria
- Execute → Review: Include components implemented, files created/modified, tests written, known issues
- Review → Chores: Include cleanup tasks, documentation needs, deployment steps

**Important:**
- Only PM agents can use this tool
- The message field should contain comprehensive context for the next phase
- Use this tool only when transitioning phases, not to continue in the current phase`,
  
  async run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const switchPhaseArgs = args as unknown as SwitchPhaseArgs;
    
    // Validate args
    if (!switchPhaseArgs.phase || !switchPhaseArgs.message) {
      return {
        success: false,
        error: 'Missing required parameters: phase and message'
      };
    }
    
    // Check if agent is PM
    if (!context.agent?.isPMAgent) {
      return {
        success: false,
        error: "Only the PM agent can transition phases",
      };
    }
    
    // Validate phase
    const validPhases: Phase[] = ["chat", "plan", "execute", "review", "chores"];
    if (!validPhases.includes(switchPhaseArgs.phase)) {
      return {
        success: false,
        error: `Invalid phase: ${switchPhaseArgs.phase}. Valid phases are: ${validPhases.join(", ")}`,
      };
    }

    const currentPhase = context.phase || 'chat';

    // Log the phase transition
    logger.info("🔄 Phase transition requested", {
      tool: "switch_phase",
      fromPhase: currentPhase,
      toPhase: switchPhaseArgs.phase,
      agentName: context.agentName,
      agentPubkey: context.agent.pubkey,
      reason: switchPhaseArgs.reason,
      messagePreview: switchPhaseArgs.message.substring(0, 100) + '...',
      conversationId: context.conversationId
    });

    const metadata: PhaseTransitionMetadata = {
      phaseTransition: {
        from: currentPhase as Phase,
        to: switchPhaseArgs.phase,
        message: switchPhaseArgs.message,
        reason: switchPhaseArgs.reason
      }
    };

    return {
      success: true,
      output: `Phase transition to '${switchPhaseArgs.phase}' requested${switchPhaseArgs.reason ? `: ${switchPhaseArgs.reason}` : ""}`,
      metadata
    };
  }
};
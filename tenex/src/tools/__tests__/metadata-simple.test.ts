import { describe, it, expect } from 'bun:test';
import type { ToolResult, ToolExecutionMetadata } from '../types';

describe('metadata passing structure', () => {
  it('should demonstrate clean metadata passing without string parsing', () => {
    // This is what the old implementation would do:
    const oldApproach = (): ToolResult => {
      const fullMessage = "Handing off to Agent One (Reason: Test handoff)";
      return {
        success: true,
        output: `${fullMessage}
[HANDOFF_METADATA]
targetAgentPubkey: agent1-pubkey
targetAgentName: Agent One
targetAgentSlug: agent-one
fromAgentPubkey: pm-pubkey
fromAgentName: PM Agent`,
      };
    };

    // This is what our new implementation does:
    const newApproach = (): ToolResult => {
      const fullMessage = "Handing off to Agent One (Reason: Test handoff)";
      return {
        success: true,
        output: fullMessage,
        metadata: {
          actionType: 'handoff',
          targetAgentPubkey: 'agent1-pubkey',
          targetAgentName: 'Agent One',
          targetAgentSlug: 'agent-one',
          fromAgentPubkey: 'pm-pubkey',
          fromAgentName: 'PM Agent'
        }
      };
    };

    // Old approach embeds metadata in string
    const oldResult = oldApproach();
    expect(oldResult.output).toContain('[HANDOFF_METADATA]');
    expect(oldResult.metadata).toBeUndefined();

    // New approach uses structured metadata
    const newResult = newApproach();
    expect(newResult.output).not.toContain('[HANDOFF_METADATA]');
    expect(newResult.metadata).toBeDefined();
    expect(newResult.metadata?.actionType).toBe('handoff');
    expect(newResult.metadata?.targetAgentPubkey).toBe('agent1-pubkey');
  });

  it('should show how toolExecutor processes metadata', () => {
    // Mock tool result with metadata
    const toolResult: ToolResult = {
      success: true,
      output: "Phase transition to 'plan' requested",
      metadata: {
        phaseTransition: {
          from: 'chat',
          to: 'plan',
          message: 'Phase transition message',
          reason: 'Requirements gathered'
        }
      }
    };

    // The toolExecutor would create a ToolExecutionResult like this:
    const toolExecutionResult = {
      success: toolResult.success,
      output: toolResult.output,
      error: toolResult.error,
      duration: 100,
      toolName: 'switch_phase',
      metadata: toolResult.metadata // Direct assignment, no parsing!
    };

    // Verify metadata is passed through cleanly
    expect(toolExecutionResult.metadata).toBe(toolResult.metadata);
    expect(toolExecutionResult.metadata?.phaseTransition).toBeDefined();
    expect(toolExecutionResult.metadata?.phaseTransition?.to).toBe('plan');
  });

  it('should show AgentExecutor can access metadata directly', () => {
    // Mock tool execution results
    const toolResults = [{
      success: true,
      output: "Handing off to Agent Two",
      error: undefined,
      duration: 50,
      toolName: 'handoff',
      metadata: {
        handoff: {
          to: 'agent2-pubkey',
          toName: 'Agent Two',
          message: 'Handoff to Agent Two'
        }
      } as ToolExecutionMetadata
    }];

    // Find handoff result (as done in AgentExecutor)
    const handoffResult = toolResults.find(
      (result) => result.toolName === "handoff" && result.success && result.metadata
    );

    expect(handoffResult).toBeDefined();
    expect(handoffResult?.metadata?.handoff).toBeDefined();
    
    // Extract target agent directly from metadata
    const nextResponder = handoffResult?.metadata?.handoff?.to as string;
    expect(nextResponder).toBe('agent2-pubkey');
  });
});
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
        actionType: 'phase_transition',
        requestedPhase: 'plan',
        currentPhase: 'chat',
        fromAgentPubkey: 'pm-pubkey',
        fromAgentName: 'PM Agent'
      }
    };

    // The toolExecutor would create a ToolExecutionResult like this:
    const toolExecutionResult = {
      success: toolResult.success,
      output: toolResult.output,
      error: toolResult.error,
      duration: 100,
      toolName: 'next_action',
      metadata: toolResult.metadata // Direct assignment, no parsing!
    };

    // Verify metadata is passed through cleanly
    expect(toolExecutionResult.metadata).toBe(toolResult.metadata);
    expect(toolExecutionResult.metadata?.actionType).toBe('phase_transition');
    expect(toolExecutionResult.metadata?.requestedPhase).toBe('plan');
  });

  it('should show AgentExecutor can access metadata directly', () => {
    // Mock tool execution results
    const toolResults = [{
      success: true,
      output: "Handing off to Agent Two",
      error: undefined,
      duration: 50,
      toolName: 'next_action',
      metadata: {
        actionType: 'handoff',
        targetAgentPubkey: 'agent2-pubkey',
        targetAgentName: 'Agent Two',
        fromAgentPubkey: 'pm-pubkey'
      } as ToolExecutionMetadata
    }];

    // Find next_action result (as done in AgentExecutor)
    const nextActionResult = toolResults.find(
      (result) => result.toolName === "next_action" && result.success && result.metadata
    );

    expect(nextActionResult).toBeDefined();
    expect(nextActionResult?.metadata?.actionType).toBe('handoff');
    
    // Extract target agent directly from metadata
    const nextResponder = nextActionResult?.metadata?.targetAgentPubkey as string;
    expect(nextResponder).toBe('agent2-pubkey');
  });
});
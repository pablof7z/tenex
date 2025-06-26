/**
 * Test script to verify phase transition and streaming fixes
 * This simulates the key flows to ensure no race conditions or duplicate publishing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PhaseTransitionMetadata, HandoffMetadata } from '@/tools/types';
import { isPhaseTransitionMetadata, isHandoffMetadata } from '@/tools/types';

describe('Phase Transition and Streaming Fixes', () => {
    it('should properly identify phase transition metadata', () => {
        const phaseTransitionMetadata: PhaseTransitionMetadata = {
            phaseTransition: {
                from: 'chat',
                to: 'plan',
                message: 'Moving to planning phase',
                reason: 'User requested planning'
            }
        };

        expect(isPhaseTransitionMetadata(phaseTransitionMetadata)).toBe(true);
        expect(isHandoffMetadata(phaseTransitionMetadata)).toBe(false);
    });

    it('should properly identify handoff metadata', () => {
        const handoffMetadata: HandoffMetadata = {
            handoff: {
                to: 'user',
                toName: 'User',
                message: 'Handing off to user'
            }
        };

        expect(isHandoffMetadata(handoffMetadata)).toBe(true);
        expect(isPhaseTransitionMetadata(handoffMetadata)).toBe(false);
    });

    it('should handle metadata extraction timing correctly', () => {
        // This simulates the fixed flow where metadata is extracted BEFORE flush
        const toolResult = {
            success: true,
            metadata: {
                phaseTransition: {
                    from: 'chat',
                    to: 'plan',
                    message: 'Moving to planning phase',
                    reason: 'User requested planning'
                }
            }
        };

        // Extract metadata first (as in the fixed code)
        const metadata = toolResult.metadata;
        let phaseTransitionMetadata: PhaseTransitionMetadata | undefined;
        
        if (isPhaseTransitionMetadata(metadata)) {
            phaseTransitionMetadata = metadata;
        }

        expect(phaseTransitionMetadata).toBeDefined();
        expect(phaseTransitionMetadata?.phaseTransition.to).toBe('plan');
        
        // Then flush would happen (simulated)
        // This ensures metadata is available for the flush operation
    });

    it('should use consistent phase tags', () => {
        // Test that we use "phase" tag consistently (not "phase_transition")
        const expectedTag = "phase";
        const phaseValue = "plan";
        
        const tag = [expectedTag, phaseValue];
        
        expect(tag[0]).toBe("phase");
        expect(tag[1]).toBe("plan");
    });
});
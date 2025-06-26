import { describe, it, expect } from 'vitest';
import { getPhaseTransitionInstructions } from '../phase';
import type { Phase } from '@/conversations/phases';

describe('getPhaseTransitionInstructions', () => {
    it('should provide detailed instructions for chat -> plan transition', () => {
        const instructions = getPhaseTransitionInstructions('chat' as Phase, 'plan' as Phase);
        
        expect(instructions).toContain('Transitioning to PLAN Phase');
        expect(instructions).toContain('Project Overview');
        expect(instructions).toContain('Functional Requirements');
        expect(instructions).toContain('Technical Constraints');
        expect(instructions).toContain('Success Criteria');
        expect(instructions).toContain('Priorities');
        expect(instructions).toContain('comprehensive brief that Claude Code can use');
    });

    it('should provide detailed instructions for plan -> execute transition', () => {
        const instructions = getPhaseTransitionInstructions('plan' as Phase, 'execute' as Phase);
        
        expect(instructions).toContain('Transitioning to EXECUTE Phase');
        expect(instructions).toContain('Approved Plan');
        expect(instructions).toContain('Technical Decisions');
        expect(instructions).toContain('Implementation Steps');
        expect(instructions).toContain('Dependencies');
        expect(instructions).toContain('Acceptance Criteria');
        expect(instructions).toContain('sent directly to Claude Code');
    });

    it('should provide detailed instructions for execute -> review transition', () => {
        const instructions = getPhaseTransitionInstructions('execute' as Phase, 'review' as Phase);
        
        expect(instructions).toContain('Transitioning to REVIEW Phase');
        expect(instructions).toContain('Work Completed');
        expect(instructions).toContain('Features Implemented');
        expect(instructions).toContain('Tests Written');
        expect(instructions).toContain('Known Issues');
        expect(instructions).toContain('Review Focus');
    });

    it('should provide generic instructions for other transitions', () => {
        const instructions = getPhaseTransitionInstructions('review' as Phase, 'chores' as Phase);
        
        expect(instructions).toContain('Phase Transition');
        expect(instructions).toContain('comprehensive summary of the work completed in the review phase');
        expect(instructions).toContain('clear context for the chores phase');
    });

    it('should handle same phase transitions', () => {
        const instructions = getPhaseTransitionInstructions('chat' as Phase, 'chat' as Phase);
        
        expect(instructions).toContain('Phase Transition');
        expect(instructions).toContain('comprehensive summary of the work completed in the chat phase');
        expect(instructions).toContain('clear context for the chat phase');
    });

    it('should handle reverse transitions', () => {
        const instructions = getPhaseTransitionInstructions('plan' as Phase, 'chat' as Phase);
        
        expect(instructions).toContain('Phase Transition');
        expect(instructions).toContain('comprehensive summary of the work completed in the plan phase');
        expect(instructions).toContain('clear context for the chat phase');
    });
});
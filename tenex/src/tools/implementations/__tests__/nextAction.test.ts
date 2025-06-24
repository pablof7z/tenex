import { describe, it, expect, beforeEach, mock } from "bun:test";
import { nextActionTool } from '../nextAction';
import type { ToolExecutionContext } from '@/tools/types';
import type { Agent } from '@/agents/types';
import type { Conversation } from '@/conversations/types';
import * as ProjectContext from '@/services/ProjectContext';

// Mock getProjectContext
mock.module('@/services/ProjectContext', () => ({
    getProjectContext: mock(),
}));

describe('nextActionTool', () => {
    let mockContext: ToolExecutionContext;
    let mockAgent: Agent;
    let mockConversation: Conversation;

    beforeEach(() => {
        mockAgent = {
            id: 'test-agent',
            name: 'Test PM Agent',
            slug: 'test-pm',
            role: 'Project Manager',
            pubkey: 'test-pubkey',
            isPMAgent: true,
            tools: ['next_action'],
            signer: {} as any,
        };

        mockConversation = {
            id: 'test-conversation',
            title: 'Test Conversation',
            phase: 'chat',
            history: [],
            phaseStartedAt: Date.now(),
            metadata: {},
            phaseTransitions: [],
        };

        mockContext = {
            projectPath: '/test/project',
            conversationId: mockConversation.id,
            agentName: mockAgent.name,
            phase: 'chat',
            agent: mockAgent,
            conversation: mockConversation,
        };

        // Mock getProjectContext
        const mockProjectContext = {
            projectPath: '/test/project',
            ndk: {} as any,
            llmService: {} as any,
            conversationManager: {} as any,
            agents: new Map([
                [mockAgent.pubkey, mockAgent],
                ['other-agent-pubkey', {
                    ...mockAgent,
                    id: 'other-agent',
                    name: 'Other Agent',
                    slug: 'other',
                    pubkey: 'other-agent-pubkey',
                    isPMAgent: false,
                }],
            ]),
            project: {
                id: 'test-project',
                name: 'Test Project',
                tags: [],
                kind: 1,
                content: '',
                pubkey: '',
                created_at: 0,
                sig: '',
            },
        };
        
        (ProjectContext.getProjectContext as any).mockReturnValue(mockProjectContext);
    });

    describe('validation', () => {
        it('should require action, target, and message parameters', async () => {
            const result = await nextActionTool.run({}, mockContext);
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Missing required parameters: action, target, and message');
        });

        it('should validate action type', async () => {
            const result = await nextActionTool.run({
                action: 'invalid',
                target: 'plan',
                message: 'test message',
            }, mockContext);
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid action. Must be "handoff" or "phase_transition"');
        });

        it('should only allow PM agents to use the tool', async () => {
            const nonPMContext = {
                ...mockContext,
                agent: { ...mockAgent, isPMAgent: false },
            };
            
            const result = await nextActionTool.run({
                action: 'phase_transition',
                target: 'plan',
                message: 'test message',
            }, nonPMContext);
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Only the PM agent can specify next actions');
        });
    });

    describe('phase transitions', () => {
        it('should accept phase transition with mandatory message', async () => {
            const result = await nextActionTool.run({
                action: 'phase_transition',
                target: 'plan',
                message: '## User Requirements\n- Build a CLI tool\n## Constraints\n- Must be TypeScript',
                reason: 'requirements are clear',
            }, mockContext);
            
            expect(result.success).toBe(true);
            expect(result.output).toContain("Phase transition to 'plan' requested");
            expect(result.metadata).toMatchObject({
                actionType: 'phase_transition',
                requestedPhase: 'plan',
                currentPhase: 'chat',
                transitionMessage: expect.stringContaining('User Requirements'),
            });
        });

        it('should reject phase transition without message', async () => {
            const result = await nextActionTool.run({
                action: 'phase_transition',
                target: 'plan',
                reason: 'requirements are clear',
            }, mockContext);
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Missing required parameters: action, target, and message');
        });

        it('should validate phase names', async () => {
            const result = await nextActionTool.run({
                action: 'phase_transition',
                target: 'invalid-phase',
                message: 'test message',
            }, mockContext);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid phase: invalid-phase');
        });
    });

    describe('agent handoffs', () => {
        it('should accept handoff with mandatory message', async () => {
            const result = await nextActionTool.run({
                action: 'handoff',
                target: 'other',
                message: 'Please review the implementation and provide feedback',
                reason: 'code review needed',
            }, mockContext);
            
            expect(result.success).toBe(true);
            expect(result.output).toContain('Handing off to Other Agent');
            expect(result.metadata).toMatchObject({
                actionType: 'handoff',
                targetAgentPubkey: 'other-agent-pubkey',
                targetAgentName: 'Other Agent',
            });
        });

        it('should reject handoff to self', async () => {
            const result = await nextActionTool.run({
                action: 'handoff',
                target: 'test-pm',
                message: 'test message',
            }, mockContext);
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Cannot hand off to self');
        });

        it('should reject handoff to non-existent agent', async () => {
            const result = await nextActionTool.run({
                action: 'handoff',
                target: 'non-existent',
                message: 'test message',
            }, mockContext);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Agent \'non-existent\' not found');
        });
    });
});
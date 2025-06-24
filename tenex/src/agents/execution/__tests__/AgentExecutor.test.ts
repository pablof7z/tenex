import { describe, it, expect, beforeEach, mock } from "bun:test";
import { AgentExecutor } from '../AgentExecutor';
import type { LLMService } from '@/llm/types';
import type NDK from '@nostr-dev-kit/ndk';
import type { NDKEvent } from '@nostr-dev-kit/ndk';
import type { ConversationManager } from '@/conversations/ConversationManager';
import type { AgentExecutionContext } from '../types';
import type { Agent } from '@/agents/types';
import type { Conversation } from '@/conversations/types';
import * as ProjectContext from '@/services/ProjectContext';
import * as ToolRegistry from '@/tools/registry';
import * as Prompts from '@/prompts';

// Mock dependencies
mock.module('@/nostr', () => ({
    publishAgentResponse: mock(),
    publishTypingStart: mock(),
    publishTypingStop: mock(),
}));

mock.module('@/tools/registry', () => ({
    getTool: mock(),
}));

mock.module('@/prompts', () => ({
    PromptBuilder: mock(() => ({
        add: mock().mockReturnThis(),
        build: mock().mockReturnValue('Mock prompt'),
    })),
}));

mock.module('@/services/ProjectContext', () => ({
    getProjectContext: mock(),
}));

describe('AgentExecutor - Claude Code Integration', () => {
    let executor: AgentExecutor;
    let mockLLMService: LLMService;
    let mockNDK: NDK;
    let mockConversationManager: ConversationManager;
    let mockContext: AgentExecutionContext;
    let mockAgent: Agent;
    let mockConversation: Conversation;

    beforeEach(() => {
        // Mock LLM Service
        mockLLMService = {
            complete: mock().mockResolvedValue({
                content: 'Mock LLM response',
                usage: {
                    prompt_tokens: 100,
                    completion_tokens: 50,
                },
            }),
        } as any;

        // Mock NDK
        mockNDK = {} as NDK;

        // Mock Conversation Manager
        mockConversationManager = {
            updatePhase: mock().mockResolvedValue(undefined),
        } as any;

        // Mock Agent
        mockAgent = {
            id: 'pm-agent',
            name: 'PM Agent',
            slug: 'pm',
            role: 'Project Manager',
            pubkey: 'pm-pubkey',
            isPMAgent: true,
            tools: ['next_action', 'claude_code'],
            signer: {} as any,
        };

        // Mock Conversation
        mockConversation = {
            id: 'test-conversation',
            title: 'Test Conversation',
            phase: 'chat',
            history: [],
            phaseStartedAt: Date.now(),
            metadata: {},
            phaseTransitions: [],
        };

        // Mock Context
        mockContext = {
            agent: mockAgent,
            conversation: mockConversation,
            phase: 'chat',
            projectPath: '/test/project',
        };

        // Mock getProjectContext
        (ProjectContext.getProjectContext as any).mockReturnValue({
            projectPath: '/test/project',
            ndk: mockNDK,
            llmService: mockLLMService,
            conversationManager: mockConversationManager,
            agents: new Map([[mockAgent.pubkey, mockAgent]]),
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
        });

        executor = new AgentExecutor(mockLLMService, mockNDK, mockConversationManager);
    });

    describe('automatic Claude Code invocation', () => {
        it('should invoke Claude Code directly for plan phase transition', async () => {
            const mockClaudeCodeTool = {
                run: mock().mockResolvedValue({
                    success: true,
                    output: 'Claude Code generated plan:\n1. Setup project\n2. Implement features',
                }),
            };

            (ToolRegistry.getTool as any).mockImplementation((name: string) => {
                if (name === 'claude_code') return mockClaudeCodeTool;
                return null;
            });

            // Mock ReasonActLoop to return a next_action result
            const mockReasonActLoop = {
                execute: mock().mockResolvedValue({
                    finalResponse: { content: 'Transitioning to plan phase' },
                    finalContent: 'Transitioning to plan phase',
                    toolExecutions: 1,
                    allToolResults: [{
                        toolName: 'next_action',
                        success: true,
                        output: 'Phase transition requested',
                        metadata: {
                            actionType: 'phase_transition',
                            requestedPhase: 'plan',
                            transitionMessage: '## Requirements\n- Build CLI tool\n- Support TypeScript',
                            fromAgentPubkey: 'pm-pubkey',
                            fromAgentName: 'PM Agent',
                        },
                    }],
                }),
            };

            // Replace the reasonActLoop
            (executor as any).reasonActLoop = mockReasonActLoop;

            const triggeringEvent: NDKEvent = {
                id: 'test-event',
                content: 'User message',
            } as NDKEvent;

            await executor.execute(mockContext, triggeringEvent);

            // Verify updatePhase was called with transition message
            expect(mockConversationManager.updatePhase).toHaveBeenCalledWith(
                'test-conversation',
                'plan',
                '## Requirements\n- Build CLI tool\n- Support TypeScript',
                'pm-pubkey',
                'PM Agent',
                undefined
            );

            // Verify Claude Code was invoked
            expect(mockClaudeCodeTool.run).toHaveBeenCalledWith(
                {
                    prompt: '## Requirements\n- Build CLI tool\n- Support TypeScript',
                    mode: 'plan',
                },
                expect.objectContaining({
                    projectPath: '/test/project',
                    conversationId: 'test-conversation',
                    phase: 'chat',
                    agent: mockAgent,
                    agentName: 'PM Agent',
                })
            );
        });

        it('should invoke Claude Code with run mode for execute phase', async () => {
            const mockClaudeCodeTool = {
                run: mock().mockResolvedValue({
                    success: true,
                    output: 'Claude Code implementation complete',
                }),
            };

            (ToolRegistry.getTool as any).mockImplementation((name: string) => {
                if (name === 'claude_code') return mockClaudeCodeTool;
                return null;
            });

            mockContext.phase = 'plan';
            mockConversation.phase = 'plan';

            const mockReasonActLoop = {
                execute: mock().mockResolvedValue({
                    finalResponse: { content: 'Moving to execute' },
                    finalContent: 'Moving to execute',
                    toolExecutions: 1,
                    allToolResults: [{
                        toolName: 'next_action',
                        success: true,
                        output: 'Phase transition requested',
                        metadata: {
                            actionType: 'phase_transition',
                            requestedPhase: 'execute',
                            transitionMessage: '## Plan\n1. Create files\n2. Add tests',
                            fromAgentPubkey: 'pm-pubkey',
                            fromAgentName: 'PM Agent',
                        },
                    }],
                }),
            };

            (executor as any).reasonActLoop = mockReasonActLoop;

            const triggeringEvent: NDKEvent = {
                id: 'test-event',
                content: 'User approves plan',
            } as NDKEvent;

            await executor.execute(mockContext, triggeringEvent);

            expect(mockClaudeCodeTool.run).toHaveBeenCalledWith(
                {
                    prompt: '## Plan\n1. Create files\n2. Add tests',
                    mode: 'run',
                },
                expect.any(Object)
            );
        });

        it('should prevent infinite loops with directExecution flag', async () => {
            const mockClaudeCodeTool = {
                run: mock().mockResolvedValue({
                    success: true,
                    output: 'Claude Code output',
                }),
            };

            (ToolRegistry.getTool as any).mockImplementation((name: string) => {
                if (name === 'claude_code') return mockClaudeCodeTool;
                return null;
            });

            // Set directExecution flag to prevent auto-invocation
            mockContext.additionalContext = {
                directExecution: true,
            };

            const mockReasonActLoop = {
                execute: mock().mockResolvedValue({
                    finalResponse: { content: 'Response' },
                    finalContent: 'Response',
                    toolExecutions: 1,
                    allToolResults: [{
                        toolName: 'next_action',
                        success: true,
                        output: 'Phase transition requested',
                        metadata: {
                            actionType: 'phase_transition',
                            requestedPhase: 'plan',
                            transitionMessage: 'Transition message',
                            fromAgentPubkey: 'pm-pubkey',
                            fromAgentName: 'PM Agent',
                        },
                    }],
                }),
            };

            (executor as any).reasonActLoop = mockReasonActLoop;

            const triggeringEvent: NDKEvent = {
                id: 'test-event',
                content: 'Message',
            } as NDKEvent;

            await executor.execute(mockContext, triggeringEvent);

            // Claude Code should NOT be invoked due to directExecution flag
            expect(mockClaudeCodeTool.run).not.toHaveBeenCalled();
        });

        it('should handle Claude Code tool not available', async () => {
            (ToolRegistry.getTool as any).mockReturnValue(null); // No Claude Code tool

            const mockReasonActLoop = {
                execute: mock().mockResolvedValue({
                    finalResponse: { content: 'Response' },
                    finalContent: 'Response',
                    toolExecutions: 1,
                    allToolResults: [{
                        toolName: 'next_action',
                        success: true,
                        output: 'Phase transition requested',
                        metadata: {
                            actionType: 'phase_transition',
                            requestedPhase: 'plan',
                            transitionMessage: 'Transition message',
                            fromAgentPubkey: 'pm-pubkey',
                            fromAgentName: 'PM Agent',
                        },
                    }],
                }),
            };

            (executor as any).reasonActLoop = mockReasonActLoop;

            const triggeringEvent: NDKEvent = {
                id: 'test-event',
                content: 'Message',
            } as NDKEvent;

            // Should not throw, but additionalContext should contain error
            await executor.execute(mockContext, triggeringEvent);

            expect(mockContext.additionalContext).toMatchObject({
                claudeCodeReport: 'Claude Code tool not available',
                claudeCodeSuccess: false,
                directExecution: true,
            });
        });

        it('should handle Claude Code execution errors', async () => {
            const mockClaudeCodeTool = {
                run: mock().mockRejectedValue(new Error('Claude Code failed')),
            };

            (ToolRegistry.getTool as any).mockImplementation((name: string) => {
                if (name === 'claude_code') return mockClaudeCodeTool;
                return null;
            });

            const mockReasonActLoop = {
                execute: mock().mockResolvedValue({
                    finalResponse: { content: 'Response' },
                    finalContent: 'Response',
                    toolExecutions: 1,
                    allToolResults: [{
                        toolName: 'next_action',
                        success: true,
                        output: 'Phase transition requested',
                        metadata: {
                            actionType: 'phase_transition',
                            requestedPhase: 'plan',
                            transitionMessage: 'Transition message',
                            fromAgentPubkey: 'pm-pubkey',
                            fromAgentName: 'PM Agent',
                        },
                    }],
                }),
            };

            (executor as any).reasonActLoop = mockReasonActLoop;

            const triggeringEvent: NDKEvent = {
                id: 'test-event',
                content: 'Message',
            } as NDKEvent;

            await executor.execute(mockContext, triggeringEvent);

            expect(mockContext.additionalContext).toMatchObject({
                claudeCodeReport: 'Claude Code failed',
                claudeCodeSuccess: false,
                directExecution: true,
            });
        });

        it('should not invoke Claude Code for non-plan/execute phases', async () => {
            const mockClaudeCodeTool = {
                run: mock(),
            };

            (ToolRegistry.getTool as any).mockImplementation((name: string) => {
                if (name === 'claude_code') return mockClaudeCodeTool;
                return null;
            });

            const mockReasonActLoop = {
                execute: mock().mockResolvedValue({
                    finalResponse: { content: 'Response' },
                    finalContent: 'Response',
                    toolExecutions: 1,
                    allToolResults: [{
                        toolName: 'next_action',
                        success: true,
                        output: 'Phase transition requested',
                        metadata: {
                            actionType: 'phase_transition',
                            requestedPhase: 'review', // Not plan or execute
                            transitionMessage: 'Moving to review',
                            fromAgentPubkey: 'pm-pubkey',
                            fromAgentName: 'PM Agent',
                        },
                    }],
                }),
            };

            (executor as any).reasonActLoop = mockReasonActLoop;

            const triggeringEvent: NDKEvent = {
                id: 'test-event',
                content: 'Message',
            } as NDKEvent;

            await executor.execute(mockContext, triggeringEvent);

            // Claude Code should not be invoked for review phase
            expect(mockClaudeCodeTool.run).not.toHaveBeenCalled();
        });
    });
});
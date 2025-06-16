import type NDK from "@nostr-dev-kit/ndk";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import type { NDKUser } from "@nostr-dev-kit/ndk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectInfo } from "../../../commands/run/ProjectLoader";
import { TeamFormationError } from "../../../core/orchestration/errors";
import type { OrchestrationCoordinator } from "../../../core/orchestration/integration/OrchestrationCoordinator";
import type { StrategyExecutionResult } from "../../../core/orchestration/strategies/OrchestrationStrategy";
import { OrchestrationStrategy, type Team } from "../../../core/orchestration/types";
import type { Agent } from "../Agent";
import { AgentCommunicationHandler } from "../AgentCommunicationHandler";
import type { AgentConfigurationManager } from "../AgentConfigurationManager";
import type { ConversationStorage } from "../ConversationStorage";

// Mock implementations
const mockNDK = {
    publish: vi.fn(),
} as unknown as NDK;

const createMockAgent = (name: string, pubkey: string): Agent =>
    ({
        getName: vi.fn(() => name),
        getPubkey: vi.fn(() => pubkey),
        getSigner: vi.fn(),
        getConfig: vi.fn(() => ({
            role: `${name} agent`,
            instructions: `Instructions for ${name}`,
            systemPrompt: `System prompt for ${name}`,
        })),
        getAvailableTools: vi.fn(() => ["tool1", "tool2"]),
        getOrCreateConversationWithContext: vi.fn().mockResolvedValue({
            getMessageCount: vi.fn().mockReturnValue(0),
            addUserMessage: vi.fn(),
            getMessages: vi.fn().mockReturnValue([]),
            getMetadata: vi.fn().mockReturnValue(undefined),
            toJSON: vi.fn().mockReturnValue({ messages: [], metadata: {} }),
            isParticipant: vi.fn().mockReturnValue(false),
        }),
        getConversation: vi.fn().mockReturnValue({
            getMessageCount: vi.fn().mockReturnValue(0),
            addUserMessage: vi.fn(),
            getMessages: vi.fn().mockReturnValue([]),
            getMetadata: vi.fn().mockReturnValue(undefined),
            toJSON: vi.fn().mockReturnValue({ messages: [], metadata: {} }),
            isParticipant: vi.fn().mockReturnValue(false),
        }),
        generateResponse: vi.fn(),
        getToolRegistry: vi.fn(),
        extractConversationId: vi.fn((event) => event.id),
        saveConversationToStorage: vi.fn(),
    }) as unknown as Agent;

const mockConfigManager: AgentConfigurationManager = {
    getLLMConfig: vi.fn().mockReturnValue({ model: "test-model" }),
    getLLMConfigForAgent: vi.fn(),
    getProjectPath: vi.fn().mockReturnValue("/test/project"),
    getAllLLMConfigs: vi.fn().mockReturnValue(new Map()),
    getDefaultLLMName: vi.fn().mockReturnValue("default"),
} as unknown as AgentConfigurationManager;

const mockConversationStorage: ConversationStorage = {
    isEventProcessed: vi.fn().mockReturnValue(false),
    markEventProcessed: vi.fn(),
    saveConversation: vi.fn(),
    getConversation: vi.fn().mockReturnValue({
        getMessageCount: vi.fn().mockReturnValue(0),
        addUserMessage: vi.fn(),
        getMessages: vi.fn().mockReturnValue([]),
        getMetadata: vi.fn().mockReturnValue(undefined),
        toJSON: vi.fn().mockReturnValue({ messages: [], metadata: {} }),
        isParticipant: vi.fn().mockReturnValue(false),
    }),
} as unknown as ConversationStorage;

const mockProjectInfo: ProjectInfo = {
    projectEvent: {
        id: "project123",
        kind: 31933,
        pubkey: "projectpubkey",
        tagValue: vi.fn().mockReturnValue("test-project"),
    },
} as unknown as ProjectInfo;

describe("AgentCommunicationHandler with Orchestration", () => {
    let handler: AgentCommunicationHandler;
    let orchestrationCoordinator: OrchestrationCoordinator;
    let agents: Map<string, Agent>;

    beforeEach(() => {
        vi.clearAllMocks();

        // Create test agents
        agents = new Map([
            ["code", createMockAgent("code", "codepubkey")],
            ["planner", createMockAgent("planner", "plannerpubkey")],
            ["debugger", createMockAgent("debugger", "debuggerpubkey")],
        ]);

        // Create orchestration coordinator mock
        orchestrationCoordinator = {
            handleUserEvent: vi.fn(),
            executeTeamStrategy: vi.fn().mockResolvedValue({
                success: true,
                responses: [
                    {
                        agentName: "code",
                        response: "I'll start working on the implementation",
                        timestamp: Date.now(),
                    },
                    {
                        agentName: "planner",
                        response: "I'll create the project plan",
                        timestamp: Date.now(),
                    },
                ],
                errors: [],
                metadata: {},
            } as StrategyExecutionResult),
        } as unknown as OrchestrationCoordinator;

        // Create handler with orchestration
        handler = new AgentCommunicationHandler(
            mockConfigManager,
            mockConversationStorage,
            agents,
            mockProjectInfo,
            orchestrationCoordinator,
            mockNDK
        );

        // Set dependencies
        handler.setDependencies({
            getAgent: vi.fn((name) =>
                Promise.resolve(agents.get(name) || agents.values().next().value)
            ),
            getAgentByPubkey: vi.fn((pubkey) =>
                Promise.resolve(Array.from(agents.values()).find((a) => a.getPubkey() === pubkey))
            ),
            isEventFromAnyAgent: vi.fn((pubkey) =>
                Promise.resolve(Array.from(agents.values()).some((a) => a.getPubkey() === pubkey))
            ),
            formatAvailableAgentsForPrompt: vi.fn(() =>
                Promise.resolve("Available agents: code, planner, debugger")
            ),
            generateEnvironmentContext: vi.fn(),
            getAllAvailableAgents: vi.fn(() =>
                Promise.resolve(
                    new Map([
                        [
                            "code",
                            {
                                description: "Code agent",
                                role: "developer",
                                capabilities: "coding",
                            },
                        ],
                        [
                            "planner",
                            {
                                description: "Planner agent",
                                role: "planner",
                                capabilities: "planning",
                            },
                        ],
                        [
                            "debugger",
                            {
                                description: "Debugger agent",
                                role: "debugger",
                                capabilities: "debugging",
                            },
                        ],
                    ])
                )
            ),
        });
    });

    describe("handleChatEvent", () => {
        it("should use orchestration for new conversations without p-tags", async () => {
            const event = new NDKEvent(mockNDK);
            event.id = "event123";
            event.content = "Implement a new search feature";
            event.author = { pubkey: "userpubkey" } as NDKUser;
            event.tags = [];
            event.created_at = Date.now() / 1000;

            // Mock orchestration result
            const mockTeam: Team = {
                id: "team123",
                conversationId: "event123",
                lead: "code",
                members: ["code", "planner"],
                strategy: OrchestrationStrategy.PARALLEL_EXECUTION,
                formation: {
                    timestamp: Date.now(),
                    reasoning: "Search feature needs architecture and implementation",
                    requestAnalysis: {
                        requestType: "feature_implementation",
                        requiredCapabilities: ["coding", "planning"],
                        estimatedComplexity: 7,
                        suggestedStrategy: OrchestrationStrategy.PARALLEL_EXECUTION,
                        reasoning: "Complex feature requiring multiple skills",
                    },
                },
            };

            (
                orchestrationCoordinator.handleUserEvent as ReturnType<typeof vi.fn>
            ).mockResolvedValue({
                team: mockTeam,
                conversationId: "event123",
            });

            // Mock agent conversations
            const mockConversation = {
                getMessageCount: vi.fn().mockReturnValue(1),
                addUserMessage: vi.fn(),
                setMetadata: vi.fn(),
                getMetadata: vi.fn().mockReturnValue(undefined),
                isParticipant: vi.fn().mockReturnValue(false),
                addParticipant: vi.fn(),
                getFormattedMessages: vi.fn().mockReturnValue([
                    { role: "system", content: "You are a code agent" },
                    { role: "user", content: "Implement a new search feature" },
                ]),
                getMessages: vi.fn().mockReturnValue([
                    { role: "system", content: "You are a code agent" },
                    { role: "user", content: "Implement a new search feature" },
                ]),
                toJSON: vi.fn().mockReturnValue({}),
            };

            for (const agent of agents.values()) {
                (
                    agent.getOrCreateConversationWithContext as ReturnType<typeof vi.fn>
                ).mockResolvedValue(mockConversation);
                (agent.getConversation as ReturnType<typeof vi.fn>).mockReturnValue(
                    mockConversation
                );
                (agent.generateResponse as ReturnType<typeof vi.fn>).mockResolvedValue({
                    content: `Response from ${agent.getName()}`,
                    metadata: { model: "test-model" },
                });
            }

            await handler.handleChatEvent(event);

            // Verify orchestration was called
            expect(orchestrationCoordinator.handleUserEvent).toHaveBeenCalledWith(
                event,
                expect.objectContaining({
                    conversationId: "event123",
                    hasPTags: false,
                    availableAgents: expect.any(Map),
                    projectContext: expect.objectContaining({
                        projectInfo: mockProjectInfo,
                    }),
                })
            );

            // Verify team strategy was executed (instead of individual agent responses)
            expect(orchestrationCoordinator.executeTeamStrategy).toHaveBeenCalledWith(
                mockTeam,
                event,
                expect.any(Map)
            );
        });

        it("should skip orchestration when p-tags are present", async () => {
            const event = new NDKEvent(mockNDK);
            event.id = "event123";
            event.content = "Fix the bug in search";
            event.author = { pubkey: "userpubkey" } as NDKUser;
            event.tags = [["p", "debuggerpubkey"]];
            event.created_at = Date.now() / 1000;

            const mockConversation = {
                getMessageCount: vi.fn().mockReturnValue(1),
                addUserMessage: vi.fn(),
                setMetadata: vi.fn(),
                getMetadata: vi.fn().mockReturnValue(undefined),
                isParticipant: vi.fn().mockReturnValue(false),
                addParticipant: vi.fn(),
                getFormattedMessages: vi.fn().mockReturnValue([
                    { role: "system", content: "You are a debugger agent" },
                    { role: "user", content: "Fix the bug in search" },
                ]),
                getMessages: vi.fn().mockReturnValue([
                    { role: "system", content: "You are a debugger agent" },
                    { role: "user", content: "Fix the bug in search" },
                ]),
                toJSON: vi.fn().mockReturnValue({}),
            };

            for (const agent of agents.values()) {
                (
                    agent.getOrCreateConversationWithContext as ReturnType<typeof vi.fn>
                ).mockResolvedValue(mockConversation);
                (agent.getConversation as ReturnType<typeof vi.fn>).mockReturnValue(
                    mockConversation
                );
                (agent.generateResponse as ReturnType<typeof vi.fn>).mockResolvedValue({
                    content: `Response from ${agent.getName()}`,
                    metadata: { model: "test-model" },
                });
            }

            await handler.handleChatEvent(event, "code", undefined, ["debuggerpubkey"]);

            // Verify orchestration was NOT called
            expect(orchestrationCoordinator.handleUserEvent).not.toHaveBeenCalled();

            // Verify only p-tagged agent responded
            expect(agents.get("debugger")!.generateResponse).toHaveBeenCalled();
            expect(agents.get("code")!.generateResponse).not.toHaveBeenCalled();
            expect(agents.get("planner")!.generateResponse).not.toHaveBeenCalled();
        });

        it("should handle orchestration failures gracefully", async () => {
            const event = new NDKEvent(mockNDK);
            event.id = "event123";
            event.content = "Do something impossible";
            event.author = { pubkey: "userpubkey" } as NDKUser;
            event.tags = [];
            event.created_at = Date.now() / 1000;

            // Mock orchestration failure
            (
                orchestrationCoordinator.handleUserEvent as ReturnType<typeof vi.fn>
            ).mockRejectedValue(
                new TeamFormationError("No suitable agents found", ["unknown-capability"], [])
            );

            await handler.handleChatEvent(event);

            // Verify orchestration was attempted
            expect(orchestrationCoordinator.handleUserEvent).toHaveBeenCalled();

            // Verify no agents generated responses (system failed fast)
            for (const agent of agents.values()) {
                expect(agent.generateResponse).not.toHaveBeenCalled();
            }
        });

        it("should use existing team for ongoing conversations", async () => {
            const event = new NDKEvent(mockNDK);
            event.id = "event456";
            event.content = "Continue working on the search feature";
            event.author = { pubkey: "userpubkey" } as NDKUser;
            event.tags = [["e", "event123"]]; // Reply to previous event
            event.created_at = Date.now() / 1000;

            // Mock existing team in conversation
            const mockConversation = {
                getMessageCount: vi.fn().mockReturnValue(3),
                addUserMessage: vi.fn(),
                isParticipant: vi
                    .fn()
                    .mockImplementation(
                        (pubkey) => pubkey === "codepubkey" || pubkey === "plannerpubkey"
                    ),
                addParticipant: vi.fn(),
                getFormattedMessages: vi.fn().mockReturnValue([
                    { role: "system", content: "You are an agent" },
                    { role: "user", content: "Continue working on the search feature" },
                ]),
                getMetadata: vi.fn().mockImplementation((key) => {
                    if (key === "team") {
                        return {
                            id: "team123",
                            conversationId: "event456",
                            lead: "code",
                            members: ["code", "planner"],
                            strategy: OrchestrationStrategy.PARALLEL_EXECUTION,
                            formation: {
                                timestamp: Date.now(),
                                reasoning: "Continuing work on search feature",
                                requestAnalysis: {
                                    requestType: "feature_continuation",
                                    requiredCapabilities: ["coding", "planning"],
                                    estimatedComplexity: 5,
                                    suggestedStrategy: OrchestrationStrategy.PARALLEL_EXECUTION,
                                    reasoning: "Team already formed and working effectively",
                                },
                            },
                        } as Team;
                    }
                    return undefined;
                }),
                toJSON: vi.fn().mockReturnValue({}),
            };

            for (const agent of agents.values()) {
                (
                    agent.getOrCreateConversationWithContext as ReturnType<typeof vi.fn>
                ).mockResolvedValue(mockConversation);
                (agent.getConversation as ReturnType<typeof vi.fn>).mockReturnValue(
                    mockConversation
                );
                (agent.generateResponse as ReturnType<typeof vi.fn>).mockResolvedValue({
                    content: `Response from ${agent.getName()}`,
                    metadata: { model: "test-model" },
                });
            }

            await handler.handleChatEvent(event);

            // Verify orchestration was NOT called (team already exists)
            expect(orchestrationCoordinator.handleUserEvent).not.toHaveBeenCalled();

            // Verify team strategy was executed with existing team
            expect(orchestrationCoordinator.executeTeamStrategy).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: "team123",
                    members: ["code", "planner"],
                }),
                event,
                expect.any(Map)
            );
        });

        it("should handle agent-to-agent communication without responses", async () => {
            const event = new NDKEvent(mockNDK);
            event.id = "event123";
            event.content = "Status update from my analysis";
            event.author = { pubkey: "codepubkey" } as NDKUser; // From an agent
            event.tags = [];
            event.created_at = Date.now() / 1000;

            const mockConversation = {
                getMessageCount: vi.fn().mockReturnValue(1),
                addUserMessage: vi.fn(),
                setMetadata: vi.fn(),
                getMetadata: vi.fn().mockReturnValue(undefined),
                isParticipant: vi.fn().mockReturnValue(false),
                getMessages: vi.fn().mockReturnValue([]),
                toJSON: vi.fn().mockReturnValue({}),
            };

            for (const agent of agents.values()) {
                (
                    agent.getOrCreateConversationWithContext as ReturnType<typeof vi.fn>
                ).mockResolvedValue(mockConversation);
                (agent.getConversation as ReturnType<typeof vi.fn>).mockReturnValue(
                    mockConversation
                );
            }

            await handler.handleChatEvent(event);

            // Verify orchestration was NOT called (event from agent)
            expect(orchestrationCoordinator.handleUserEvent).not.toHaveBeenCalled();

            // Verify no agents responded (anti-chatter logic)
            for (const agent of agents.values()) {
                expect(agent.generateResponse).not.toHaveBeenCalled();
            }
        });
    });

    describe("handleTaskEvent", () => {
        it("should use orchestration for new tasks", async () => {
            const event = new NDKEvent(mockNDK);
            event.id = "task123";
            event.content = "Build a comprehensive test suite for the search feature";
            event.author = { pubkey: "userpubkey" } as NDKUser;
            event.tags = [["title", "Create Test Suite"]];
            event.created_at = Date.now() / 1000;

            // Mock orchestration result
            const mockTeam: Team = {
                id: "team456",
                conversationId: "task123",
                lead: "debugger",
                members: ["debugger", "code"],
                strategy: OrchestrationStrategy.HIERARCHICAL,
                taskDefinition: {
                    description: "Build a comprehensive test suite for the search feature",
                    successCriteria: ["All major components tested", "High code coverage"],
                    requiresGreenLight: true,
                    reviewers: ["debugger"],
                    estimatedComplexity: 7,
                },
                formation: {
                    timestamp: Date.now(),
                    reasoning: "Testing requires debugging expertise and code knowledge",
                    requestAnalysis: {
                        requestType: "testing_task",
                        requiredCapabilities: ["testing", "debugging", "code-review"],
                        estimatedComplexity: 7,
                        suggestedStrategy: OrchestrationStrategy.HIERARCHICAL,
                        reasoning: "Complex testing task requiring structured approach",
                    },
                },
            };

            (
                orchestrationCoordinator.handleUserEvent as ReturnType<typeof vi.fn>
            ).mockResolvedValue({
                team: mockTeam,
                conversationId: "task123",
            });

            const mockConversation = {
                getMessageCount: vi.fn().mockReturnValue(1),
                addUserMessage: vi.fn(),
                setMetadata: vi.fn(),
                getMetadata: vi.fn().mockReturnValue(undefined),
                isParticipant: vi.fn().mockReturnValue(false),
                addParticipant: vi.fn(),
                getFormattedMessages: vi.fn().mockReturnValue([
                    { role: "system", content: "You are an agent" },
                    { role: "user", content: "Task: Create Test Suite" },
                ]),
                getMessages: vi.fn().mockReturnValue([
                    { role: "system", content: "You are an agent" },
                    { role: "user", content: "Task: Create Test Suite" },
                ]),
                toJSON: vi.fn().mockReturnValue({}),
            };

            for (const agent of agents.values()) {
                (
                    agent.getOrCreateConversationWithContext as ReturnType<typeof vi.fn>
                ).mockResolvedValue(mockConversation);
                (agent.getConversation as ReturnType<typeof vi.fn>).mockReturnValue(
                    mockConversation
                );
                (agent.generateResponse as ReturnType<typeof vi.fn>).mockResolvedValue({
                    content: `Task response from ${agent.getName()}`,
                    metadata: { model: "test-model" },
                });
            }

            await handler.handleTaskEvent(event);

            // Verify orchestration was called with task context
            expect(orchestrationCoordinator.handleUserEvent).toHaveBeenCalledWith(
                event,
                expect.objectContaining({
                    conversationId: "task123",
                    hasPTags: false,
                    availableAgents: expect.any(Map),
                    projectContext: expect.objectContaining({
                        projectInfo: mockProjectInfo,
                    }),
                })
            );

            // Verify team strategy was executed for task
            expect(orchestrationCoordinator.executeTeamStrategy).toHaveBeenCalledWith(
                mockTeam,
                event,
                expect.any(Map)
            );
        });
    });

    describe("typing indicators", () => {
        it("should publish typing indicators with prompts during orchestration", async () => {
            const event = new NDKEvent(mockNDK);
            event.id = "event123";
            event.content = "Build a new feature";
            event.author = { pubkey: "userpubkey" } as NDKUser;
            event.tags = [];
            event.created_at = Date.now() / 1000;
            event.reply = vi.fn().mockReturnValue(new NDKEvent(mockNDK));

            const mockTeam: Team = {
                id: "team123",
                conversationId: "event123",
                lead: "code",
                members: ["code"],
                strategy: OrchestrationStrategy.SINGLE_RESPONDER,
                formation: {
                    timestamp: Date.now(),
                    reasoning: "Simple feature implementation",
                    requestAnalysis: {
                        requestType: "feature_build",
                        requiredCapabilities: ["coding"],
                        estimatedComplexity: 5,
                        suggestedStrategy: OrchestrationStrategy.SINGLE_RESPONDER,
                        reasoning: "Straightforward implementation task",
                    },
                },
            };

            (
                orchestrationCoordinator.handleUserEvent as ReturnType<typeof vi.fn>
            ).mockResolvedValue({
                team: mockTeam,
                conversationId: "event123",
            });

            const mockConversation = {
                getMessageCount: vi.fn().mockReturnValue(1),
                addUserMessage: vi.fn(),
                setMetadata: vi.fn(),
                getMetadata: vi.fn().mockReturnValue(undefined),
                isParticipant: vi.fn().mockReturnValue(false),
                addParticipant: vi.fn(),
                getFormattedMessages: vi.fn().mockReturnValue([
                    { role: "system", content: "You are a code agent" },
                    { role: "user", content: "Build a new feature" },
                ]),
                getMessages: vi.fn().mockReturnValue([
                    { role: "system", content: "You are a code agent" },
                    { role: "user", content: "Build a new feature" },
                ]),
                toJSON: vi.fn().mockReturnValue({}),
            };

            const codeAgent = agents.get("code")!;
            (
                codeAgent.getOrCreateConversationWithContext as ReturnType<typeof vi.fn>
            ).mockResolvedValue(mockConversation);
            (codeAgent.getConversation as ReturnType<typeof vi.fn>).mockReturnValue(
                mockConversation
            );

            // Mock typing indicator callback being called
            (codeAgent.generateResponse as ReturnType<typeof vi.fn>).mockImplementation(
                async (
                    _conversationId: string,
                    _llmConfig: unknown,
                    _projectPath: string,
                    _isFromAgent: boolean,
                    typingCallback?: (msg: string) => Promise<void>
                ) => {
                    // Simulate typing indicator updates
                    if (typingCallback) {
                        await typingCallback("Analyzing the request...");
                        await typingCallback("Planning the implementation...");
                    }
                    return {
                        content: "I'll implement this feature",
                        metadata: { model: "test-model" },
                    };
                }
            );

            await handler.handleChatEvent(event);

            // Verify typing indicators were published
            const publishCalls = (event.reply as ReturnType<typeof vi.fn>).mock.calls;
            expect(publishCalls.length).toBeGreaterThan(0);
        });
    });
});

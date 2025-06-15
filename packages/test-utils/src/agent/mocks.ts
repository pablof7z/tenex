import type { AgentConfig, LegacyAgentsJson } from "@tenex/types/agents";
import type { LLMConfiguration } from "@tenex/types/llm";
import { vi } from "vitest";

/**
 * Creates a mock agent configuration
 */
export function createMockAgent(overrides: Partial<AgentConfig> = {}): AgentConfig {
    return {
        name: "test-agent",
        nsec: "nsec1test...",
        npub: "npub1test...",
        pubkey: "test-agent-pubkey",
        metadata: {
            role: "Test Agent",
            description: "A test agent for unit tests",
            instructions: "Follow test instructions",
            version: "1.0.0",
        },
        ...overrides,
    };
}

/**
 * Creates a mock legacy agents.json structure
 */
export function createMockAgentsJson(
    agents: Record<string, string | { nsec: string; file?: string }> = {}
): LegacyAgentsJson {
    return {
        default: "nsec1default...",
        code: {
            nsec: "nsec1code...",
            file: "code-agent.json",
        },
        planner: "nsec1planner...",
        ...agents,
    };
}

/**
 * Creates a mock LLM configuration
 */
export function createMockLLMConfig(overrides: Partial<LLMConfiguration> = {}): LLMConfiguration {
    return {
        provider: "anthropic",
        model: "claude-3-opus-20240229",
        temperature: 0.7,
        maxTokens: 4096,
        contextWindowSize: 200000,
        enableCaching: true,
        ...overrides,
    };
}

/**
 * Creates a mock agent manager
 */
export function createMockAgentManager() {
    return {
        loadAgent: vi.fn().mockResolvedValue(createMockAgent()),
        saveAgent: vi.fn().mockResolvedValue(undefined),
        listAgents: vi.fn().mockResolvedValue(["default", "code", "planner"]),
        getAgentConfig: vi.fn().mockReturnValue(createMockAgent()),
        updateAgentConfig: vi.fn().mockResolvedValue(undefined),
    };
}

/**
 * Creates a mock conversation context
 */
export function createMockConversationContext(overrides: Record<string, unknown> = {}) {
    return {
        id: "test-conversation-id",
        agentName: "test-agent",
        projectPath: "/test/project",
        participants: ["test-agent"],
        messages: [],
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
        metadata: {},
        ...overrides,
    };
}

/**
 * Creates a mock tool
 */
export function createMockTool(name: string, overrides: Record<string, unknown> = {}) {
    return {
        name,
        description: `Mock ${name} tool`,
        parameters: {
            type: "object",
            properties: {},
            required: [],
        },
        execute: vi.fn().mockResolvedValue({ success: true }),
        ...overrides,
    };
}

/**
 * Creates a mock tool manager
 */
export function createMockToolManager() {
    const tools = new Map();

    return {
        registerTool: vi.fn((tool) => tools.set(tool.name, tool)),
        getTool: vi.fn((name) => tools.get(name)),
        listTools: vi.fn(() => Array.from(tools.keys())),
        executeTool: vi.fn().mockResolvedValue({ success: true }),
        tools,
    };
}

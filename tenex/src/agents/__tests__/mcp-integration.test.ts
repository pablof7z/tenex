import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { AgentExecutor } from "../execution/AgentExecutor";
import type { Agent } from "../types";
import { MCPService } from "@/services/mcp/MCPService";
import { ConversationManager } from "@/conversations/ConversationManager";
import { loadLLMRouter } from "@/llm";
import type { Tool } from "@/tools/types";
import type { TenexMCP } from "@/services/config/types";
import { configService } from "@/services";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";

// Mock modules
// Mock llm router
const mockChat = mock();
mock.module("@/llm", () => ({
    loadLLMRouter: mock(() => ({
        chat: mockChat,
    })),
}));

mock.module("@/services", () => ({
    configService: {
        loadConfig: mock(),
    },
}));

describe("Agent-MCP Integration", () => {
    let agent: Agent;
    let executor: AgentExecutor;
    let mcpService: MCPService;
    let conversationManager: ConversationManager;
    const projectPath = "/test/project";

    beforeEach(async () => {
        // Reset MCP service singleton
        (MCPService as any).instance = undefined;
        mcpService = MCPService.getInstance();

        // Create test agent
        const signer = NDKPrivateKeySigner.generate();
        agent = {
            name: "Test Agent",
            role: "Tester",
            instructions: "Test MCP tools",
            signer,
            pubkey: (await signer.user()).pubkey,
            tools: ["read_file"], // Native tool
            llmConfig: "default",
            slug: "test-agent",
        };

        // Create conversation manager
        conversationManager = new ConversationManager(projectPath);

        // Create executor
        executor = new AgentExecutor(agent, projectPath, conversationManager);
    });

    afterEach(async () => {
        await mcpService.shutdown();
    });

    describe("Tool availability", () => {
        it("should make MCP tools available to agents", async () => {
            // Mock MCP configuration
            const mockConfig: TenexMCP = {
                servers: {
                    "test-server": {
                        command: "node",
                        args: ["test.js"],
                    },
                },
                enabled: true,
            };

            (configService.loadConfig as any).mockResolvedValue({
                mcp: mockConfig,
            });

            // Mock MCP service to return test tools
            const mockMCPTools: Tool[] = [
                {
                    name: "test-server/database-query",
                    description: "Query the database",
                    handler: async () => "Query result",
                    parameters: [
                        {
                            name: "query",
                            type: "string",
                            description: "SQL query",
                            required: true,
                        },
                    ],
                },
                {
                    name: "test-server/api-call",
                    description: "Make an API call",
                    handler: async () => "API response",
                    parameters: [
                        {
                            name: "endpoint",
                            type: "string",
                            description: "API endpoint",
                            required: true,
                        },
                        {
                            name: "method",
                            type: "string",
                            description: "HTTP method",
                            required: false,
                        },
                    ],
                },
            ];

            const getToolsSpy = spyOn(mcpService, "getAvailableTools");
            getToolsSpy.mockResolvedValue(mockMCPTools);

            // Get available tools through executor
            const tools = await executor.getAvailableTools();

            // Should include both native and MCP tools
            expect(tools.some(t => t.name === "read_file")).toBe(true); // Native tool
            expect(tools.some(t => t.name === "test-server/database-query")).toBe(true);
            expect(tools.some(t => t.name === "test-server/api-call")).toBe(true);
        });

        it("should handle when MCP is disabled", async () => {
            const mockConfig: TenexMCP = {
                servers: {
                    "test-server": {
                        command: "node",
                        args: ["test.js"],
                    },
                },
                enabled: false,
            };

            (configService.loadConfig as any).mockResolvedValue({
                mcp: mockConfig,
            });

            const getToolsSpy = spyOn(mcpService, "getAvailableTools");
            getToolsSpy.mockResolvedValue([]);

            const tools = await executor.getAvailableTools();

            // Should only have native tools
            expect(tools.some(t => t.name === "read_file")).toBe(true);
            expect(tools.every(t => !t.name.includes("/"))).toBe(true); // No namespaced MCP tools
        });
    });

    describe("Tool execution through agent", () => {
        it("should execute MCP tools when agent requests them", async () => {
            // Mock MCP tool
            const mockMCPTool: Tool = {
                name: "test-server/process-data",
                description: "Process some data",
                handler: async (args: any) => `Processed: ${args.data}`,
                parameters: [
                    {
                        name: "data",
                        type: "string",
                        description: "Data to process",
                        required: true,
                    },
                ],
            };

            const getToolsSpy = spyOn(mcpService, "getAvailableTools");
            getToolsSpy.mockResolvedValue([mockMCPTool]);

            // Mock LLM response that uses the MCP tool
            mockChat.mockResolvedValueOnce({
                content: "I'll process that data for you.",
                tool_calls: [
                    {
                        id: "call_1",
                        type: "function",
                        function: {
                            name: "test-server/process-data",
                            arguments: JSON.stringify({ data: "Hello MCP" }),
                        },
                    },
                ],
            });

            const messages = [
                { role: "user" as const, content: "Process this data: Hello MCP" },
            ];

            const response = await executor.chat(messages, {});

            // Verify tool was called
            expect(response.content).toContain("Processed: Hello MCP");
        });

        it("should handle MCP tool errors gracefully", async () => {
            const mockMCPTool: Tool = {
                name: "test-server/failing-tool",
                description: "A tool that fails",
                handler: async () => {
                    throw new Error("MCP tool error");
                },
                parameters: [],
            };

            const getToolsSpy = spyOn(mcpService, "getAvailableTools");
            getToolsSpy.mockResolvedValue([mockMCPTool]);

            mockChat.mockResolvedValueOnce({
                content: "I'll try this tool.",
                tool_calls: [
                    {
                        id: "call_1",
                        type: "function",
                        function: {
                            name: "test-server/failing-tool",
                            arguments: "{}",
                        },
                    },
                ],
            });

            const messages = [
                { role: "user" as const, content: "Try the failing tool" },
            ];

            const response = await executor.chat(messages, {});

            // Should handle error gracefully
            expect(response.content).toContain("error");
        });

        it("should execute multiple MCP tools in sequence", async () => {
            const mockTools: Tool[] = [
                {
                    name: "server1/tool1",
                    description: "First tool",
                    handler: async (args: any) => `Tool1: ${args.input}`,
                    parameters: [
                        {
                            name: "input",
                            type: "string",
                            required: true,
                        },
                    ],
                },
                {
                    name: "server2/tool2",
                    description: "Second tool",
                    handler: async (args: any) => `Tool2: ${args.value}`,
                    parameters: [
                        {
                            name: "value",
                            type: "number",
                            required: true,
                        },
                    ],
                },
            ];

            const getToolsSpy = spyOn(mcpService, "getAvailableTools");
            getToolsSpy.mockResolvedValue(mockTools);

            // First LLM call
            mockChat.mockResolvedValueOnce({
                content: "Let me use both tools.",
                tool_calls: [
                    {
                        id: "call_1",
                        type: "function",
                        function: {
                            name: "server1/tool1",
                            arguments: JSON.stringify({ input: "test" }),
                        },
                    },
                    {
                        id: "call_2",
                        type: "function",
                        function: {
                            name: "server2/tool2",
                            arguments: JSON.stringify({ value: 42 }),
                        },
                    },
                ],
            });

            // Second LLM call (after tools)
            mockChat.mockResolvedValueOnce({
                content: "Both tools executed successfully. Tool1 returned: Tool1: test, Tool2 returned: Tool2: 42",
            });

            const messages = [
                { role: "user" as const, content: "Use both MCP tools" },
            ];

            const response = await executor.chat(messages, {});

            expect(response.content).toContain("Tool1: test");
            expect(response.content).toContain("Tool2: 42");
        });
    });

    describe("Tool namespacing", () => {
        it("should handle tool namespace conflicts", async () => {
            // Native tool and MCP tool with potential conflict
            const mockMCPTools: Tool[] = [
                {
                    name: "server/read_file", // Could conflict with native "read_file"
                    description: "Server read file command",
                    handler: async () => "Server read file result",
                    parameters: [],
                },
            ];

            const getToolsSpy = spyOn(mcpService, "getAvailableTools");
            getToolsSpy.mockResolvedValue(mockMCPTools);

            const tools = await executor.getAvailableTools();

            // Should have both tools with different names
            const nativeReadFile = tools.find(t => t.name === "read_file");
            const mcpReadFile = tools.find(t => t.name === "server/read_file");

            expect(nativeReadFile).toBeDefined();
            expect(mcpReadFile).toBeDefined();
            expect(nativeReadFile).not.toBe(mcpReadFile);
        });

        it("should validate tool names match namespace pattern", async () => {
            const mockTools: Tool[] = [
                {
                    name: "valid-server/valid-tool",
                    description: "Valid tool",
                    handler: async () => "result",
                    parameters: [],
                },
                {
                    name: "another_server/another_tool",
                    description: "Another valid tool",
                    handler: async () => "result",
                    parameters: [],
                },
            ];

            const getToolsSpy = spyOn(mcpService, "getAvailableTools");
            getToolsSpy.mockResolvedValue(mockTools);

            const tools = await executor.getAvailableTools();

            // All MCP tools should have namespace format
            const mcpTools = tools.filter(t => t.name.includes("/"));
            expect(mcpTools).toHaveLength(2);
            mcpTools.forEach(tool => {
                expect(tool.name).toMatch(/^[^/]+\/[^/]+$/);
            });
        });
    });

    describe("MCP tool prompt generation", () => {
        it("should include MCP tools in agent prompt", async () => {
            const mockMCPTools: Tool[] = [
                {
                    name: "analytics/query",
                    description: "Query analytics data",
                    handler: async () => "result",
                    parameters: [
                        {
                            name: "metric",
                            type: "string",
                            description: "Metric name",
                            required: true,
                        },
                        {
                            name: "timeRange",
                            type: "object",
                            description: "Time range",
                            required: false,
                        },
                    ],
                },
            ];

            const getToolsSpy = spyOn(mcpService, "getAvailableTools");
            getToolsSpy.mockResolvedValue(mockMCPTools);

            // Capture the messages sent to LLM
            let capturedMessages: any[] = [];
            mockChat.mockImplementation(async (messages: any[]) => {
                capturedMessages = messages;
                return { content: "Response" };
            });

            await executor.chat([{ role: "user", content: "Hello" }], {});

            // Check that system message includes MCP tools
            const systemMessage = capturedMessages.find(m => m.role === "system");
            expect(systemMessage).toBeDefined();
            expect(systemMessage.content).toContain("analytics/query");
            expect(systemMessage.content).toContain("Query analytics data");
            expect(systemMessage.content).toContain("metric");
            expect(systemMessage.content).toContain("timeRange");
        });

        it("should group MCP tools by server in prompt", async () => {
            const mockMCPTools: Tool[] = [
                {
                    name: "server1/tool1",
                    description: "Server 1 Tool 1",
                    handler: async () => "result",
                    parameters: [],
                },
                {
                    name: "server1/tool2",
                    description: "Server 1 Tool 2",
                    handler: async () => "result",
                    parameters: [],
                },
                {
                    name: "server2/tool1",
                    description: "Server 2 Tool 1",
                    handler: async () => "result",
                    parameters: [],
                },
            ];

            const getToolsSpy = spyOn(mcpService, "getAvailableTools");
            getToolsSpy.mockResolvedValue(mockMCPTools);

            let capturedMessages: any[] = [];
            mockChat.mockImplementation(async (messages: any[]) => {
                capturedMessages = messages;
                return { content: "Response" };
            });

            await executor.chat([{ role: "user", content: "Hello" }], {});

            const systemMessage = capturedMessages.find(m => m.role === "system");
            
            // Tools should be grouped by server in the prompt
            expect(systemMessage.content).toContain("server1");
            expect(systemMessage.content).toContain("server2");
        });
    });
});
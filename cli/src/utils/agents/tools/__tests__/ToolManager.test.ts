import { beforeEach, describe, expect, it } from "bun:test";
import NDK from "@nostr-dev-kit/ndk";
import { ToolManager } from "../ToolManager";
import type { ToolDefinition } from "../types";

describe("ToolManager", () => {
	let toolManager: ToolManager;

	const mockTool: ToolDefinition = {
		name: "test_tool",
		description: "A test tool",
		parameters: {
			type: "object",
			properties: {
				input: { type: "string" },
			},
			required: ["input"],
		},
		handler: async (params) => ({ output: `Processed: ${params.input}` }),
	};

	const anotherMockTool: ToolDefinition = {
		name: "another_tool",
		description: "Another test tool",
		parameters: {
			type: "object",
			properties: {
				value: { type: "number" },
			},
			required: ["value"],
		},
		handler: async (params) => ({ result: params.value * 2 }),
	};

	beforeEach(() => {
		toolManager = new ToolManager();
	});

	describe("Default Tools", () => {
		it("should register default tools on initialization", () => {
			const defaultRegistry = toolManager.getDefaultRegistry();
			const tools = defaultRegistry.getAllTools();

			// Should have default tools registered
			expect(tools.length).toBeGreaterThan(0);

			// Check for specific default tools
			const toolNames = tools.map((t) => t.name);
			expect(toolNames).toContain("claude_code");
			expect(toolNames).toContain("update_spec");
			expect(toolNames).toContain("read_specs");
		});
	});

	describe("Agent Registry Management", () => {
		it("should create a new agent registry with default tools", () => {
			const agentName = "test-agent";
			const agentRegistry = toolManager.createAgentRegistry(agentName);

			// Should have all default tools
			const defaultTools = toolManager.getDefaultRegistry().getAllTools();
			const agentTools = agentRegistry.getAllTools();

			expect(agentTools.length).toBe(defaultTools.length);

			// Verify tools are copied, not shared references
			const defaultToolNames = defaultTools.map((t) => t.name);
			const agentToolNames = agentTools.map((t) => t.name);
			expect(agentToolNames).toEqual(defaultToolNames);
		});

		it("should store and retrieve agent registries", () => {
			const agentName = "test-agent";
			const registry1 = toolManager.createAgentRegistry(agentName);
			const registry2 = toolManager.getAgentRegistry(agentName);

			expect(registry2).toBe(registry1);
		});

		it("should return undefined for non-existent agent", () => {
			const registry = toolManager.getAgentRegistry("non-existent");
			expect(registry).toBeUndefined();
		});

		it("should track multiple agent registries", () => {
			toolManager.createAgentRegistry("agent1");
			toolManager.createAgentRegistry("agent2");
			toolManager.createAgentRegistry("agent3");

			const agents = toolManager.getRegisteredAgents();
			expect(agents).toHaveLength(3);
			expect(agents).toContain("agent1");
			expect(agents).toContain("agent2");
			expect(agents).toContain("agent3");
		});
	});

	describe("Global Tool Registration", () => {
		it("should register a tool globally and update all agents", () => {
			// Create some agents first
			const agent1 = "agent1";
			const agent2 = "agent2";
			toolManager.createAgentRegistry(agent1);
			toolManager.createAgentRegistry(agent2);

			// Register a global tool
			toolManager.registerGlobalTool(mockTool);

			// Check it's in default registry
			const defaultTools = toolManager.getDefaultRegistry().getAllTools();
			expect(defaultTools.map((t) => t.name)).toContain("test_tool");

			// Check it's in all agent registries
			const agent1Registry = toolManager.getAgentRegistry(agent1);
			const agent2Registry = toolManager.getAgentRegistry(agent2);

			expect(agent1Registry?.getAllTools().map((t) => t.name)).toContain(
				"test_tool",
			);
			expect(agent2Registry?.getAllTools().map((t) => t.name)).toContain(
				"test_tool",
			);
		});

		it("should include global tools in new agent registries", () => {
			// Register global tool first
			toolManager.registerGlobalTool(mockTool);

			// Create new agent
			const agentRegistry = toolManager.createAgentRegistry("new-agent");

			// Should have the global tool
			expect(agentRegistry.getAllTools().map((t) => t.name)).toContain(
				"test_tool",
			);
		});
	});

	describe("Global Tool Unregistration", () => {
		it("should unregister a tool globally from all agents", () => {
			// Create agents and register global tool
			toolManager.createAgentRegistry("agent1");
			toolManager.createAgentRegistry("agent2");
			toolManager.registerGlobalTool(mockTool);

			// Unregister the tool
			toolManager.unregisterGlobalTool("test_tool");

			// Check it's removed from default registry
			const defaultTools = toolManager.getDefaultRegistry().getAllTools();
			expect(defaultTools.map((t) => t.name)).not.toContain("test_tool");

			// Check it's removed from all agent registries
			const agent1Registry = toolManager.getAgentRegistry("agent1");
			const agent2Registry = toolManager.getAgentRegistry("agent2");

			expect(agent1Registry?.getAllTools().map((t) => t.name)).not.toContain(
				"test_tool",
			);
			expect(agent2Registry?.getAllTools().map((t) => t.name)).not.toContain(
				"test_tool",
			);
		});
	});

	describe("Agent-Specific Tools", () => {
		it("should register a tool for a specific agent only", () => {
			const agent1 = "agent1";
			const agent2 = "agent2";
			toolManager.createAgentRegistry(agent1);
			toolManager.createAgentRegistry(agent2);

			// Register tool only for agent1
			toolManager.registerAgentTool(agent1, mockTool);

			// Check agent1 has the tool
			const agent1Tools = toolManager
				.getAgentRegistry(agent1)
				?.getAllTools()
				.map((t) => t.name);
			expect(agent1Tools).toContain("test_tool");

			// Check agent2 doesn't have the tool
			const agent2Tools = toolManager
				.getAgentRegistry(agent2)
				?.getAllTools()
				.map((t) => t.name);
			expect(agent2Tools).not.toContain("test_tool");

			// Check default registry doesn't have it
			const defaultTools = toolManager
				.getDefaultRegistry()
				.getAllTools()
				.map((t) => t.name);
			expect(defaultTools).not.toContain("test_tool");
		});

		it("should handle registering tool for non-existent agent gracefully", () => {
			// Should not throw
			expect(() => {
				toolManager.registerAgentTool("non-existent", mockTool);
			}).not.toThrow();
		});
	});

	describe("Remember Lesson Tool", () => {
		it("should enable remember_lesson tool for agents with event IDs", () => {
			const agentName = "agent-with-id";
			const mockNDK = new NDK();
			const agentEventId = "test-event-id";

			toolManager.createAgentRegistry(agentName);
			toolManager.enableRememberLessonTool(agentName, agentEventId, mockNDK);

			const agentTools = toolManager
				.getAgentRegistry(agentName)
				?.getAllTools()
				.map((t) => t.name);
			expect(agentTools).toContain("remember_lesson");
		});

		it("should not enable remember_lesson without event ID", () => {
			const agentName = "agent-without-id";
			const mockNDK = new NDK();

			toolManager.createAgentRegistry(agentName);
			toolManager.enableRememberLessonTool(agentName, "", mockNDK);

			const agentTools = toolManager
				.getAgentRegistry(agentName)
				?.getAllTools()
				.map((t) => t.name);
			expect(agentTools).not.toContain("remember_lesson");
		});
	});

	describe("Clear Functionality", () => {
		it("should clear all registries and re-register defaults", () => {
			// Setup some state
			toolManager.createAgentRegistry("agent1");
			toolManager.createAgentRegistry("agent2");
			toolManager.registerGlobalTool(mockTool);

			// Clear everything
			toolManager.clear();

			// Check agents are cleared
			expect(toolManager.getRegisteredAgents()).toHaveLength(0);
			expect(toolManager.getAgentRegistry("agent1")).toBeUndefined();

			// Check custom tool is gone but defaults remain
			const defaultTools = toolManager
				.getDefaultRegistry()
				.getAllTools()
				.map((t) => t.name);
			expect(defaultTools).not.toContain("test_tool");
			expect(defaultTools).toContain("claude_code");
			expect(defaultTools).toContain("update_spec");
		});
	});

	describe("Tool Priority", () => {
		it("should maintain tool priority order", () => {
			const agentRegistry = toolManager.createAgentRegistry("test-agent");
			const tools = agentRegistry.getAllTools();

			// claude_code tool should be first (highest priority)
			expect(tools[0].name).toBe("claude_code");
		});
	});
});

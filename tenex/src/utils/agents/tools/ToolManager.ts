import { ToolRegistry } from "@/utils/agents/tools/ToolRegistry";
import { claudeCodeTool } from "@/utils/agents/tools/claudeCode";
import { exampleTools } from "@/utils/agents/tools/examples";
import { findAgentTool } from "@/utils/agents/tools/findAgent";
import { readSpecsTool } from "@/utils/agents/tools/readSpecs";
import { rememberLessonTool } from "@/utils/agents/tools/rememberLesson";
import { researchTool } from "@/utils/agents/tools/research";
import { shellTool } from "@/utils/agents/tools/shell";
import type { ToolDefinition } from "@/utils/agents/tools/types";
import { updateSpecTool } from "@/utils/agents/tools/updateSpec";
import type NDK from "@nostr-dev-kit/ndk";

/**
 * Manages tool registries and tool lifecycle for agents
 * Handles default tools, agent-specific tools, and tool registration
 */
export class ToolManager {
    private defaultRegistry: ToolRegistry;
    private agentRegistries: Map<string, ToolRegistry>;

    constructor() {
        this.defaultRegistry = new ToolRegistry();
        this.agentRegistries = new Map();
        this.registerDefaultTools();
    }

    /**
     * Register default tools available to all agents
     */
    private registerDefaultTools(): void {
        // Register Claude Code tool first (highest priority)
        this.defaultRegistry.register(claudeCodeTool);

        // Register research tool
        this.defaultRegistry.register(researchTool);

        // Register spec tools
        this.defaultRegistry.register(updateSpecTool);
        this.defaultRegistry.register(readSpecsTool);

        // Register shell tool
        this.defaultRegistry.register(shellTool);

        // Register example tools
        for (const tool of exampleTools) {
            this.defaultRegistry.register(tool);
        }
    }

    /**
     * Create a tool registry for a specific agent
     * Copies all default tools and allows for agent-specific additions
     */
    createAgentRegistry(agentName: string): ToolRegistry {
        const agentRegistry = new ToolRegistry();

        // Copy all default tools to the agent registry
        for (const tool of this.defaultRegistry.getAllTools()) {
            agentRegistry.register(tool);
        }

        // Store the registry for future reference
        this.agentRegistries.set(agentName, agentRegistry);

        return agentRegistry;
    }

    /**
     * Get the tool registry for a specific agent
     */
    getAgentRegistry(agentName: string): ToolRegistry | undefined {
        return this.agentRegistries.get(agentName);
    }

    /**
     * Register a tool for all agents (adds to default registry)
     */
    registerGlobalTool(tool: ToolDefinition): void {
        // Add to default registry
        this.defaultRegistry.register(tool);

        // Update all existing agent registries
        for (const [_, agentRegistry] of this.agentRegistries) {
            agentRegistry.register(tool);
        }
    }

    /**
     * Unregister a tool from all agents
     */
    unregisterGlobalTool(toolName: string): void {
        // Remove from default registry
        this.defaultRegistry.unregister(toolName);

        // Remove from all existing agent registries
        for (const [_, agentRegistry] of this.agentRegistries) {
            agentRegistry.unregister(toolName);
        }
    }

    /**
     * Register a tool for a specific agent only
     */
    registerAgentTool(agentName: string, tool: ToolDefinition): void {
        const agentRegistry = this.agentRegistries.get(agentName);
        if (agentRegistry) {
            agentRegistry.register(tool);
        }
    }

    /**
     * Enable remember_lesson tool for agents with event IDs
     * This tool requires NDK and agent event ID
     */
    enableRememberLessonTool(agentName: string, agentEventId: string, ndk: NDK): void {
        const agentRegistry = this.agentRegistries.get(agentName);
        if (agentRegistry && agentEventId && ndk) {
            agentRegistry.register(rememberLessonTool);
        }
    }

    /**
     * Enable find_agent tool for an agent
     * This tool allows agents to search for and collaborate with other agents
     */
    enableFindAgentTool(agentName: string): void {
        const agentRegistry = this.agentRegistries.get(agentName);
        if (agentRegistry) {
            agentRegistry.register(findAgentTool);
        }
    }

    /**
     * Get the default tool registry
     */
    getDefaultRegistry(): ToolRegistry {
        return this.defaultRegistry;
    }

    /**
     * Get all registered agent names
     */
    getRegisteredAgents(): string[] {
        return Array.from(this.agentRegistries.keys());
    }

    /**
     * Clear all registries (useful for testing)
     */
    clear(): void {
        this.defaultRegistry = new ToolRegistry();
        this.agentRegistries.clear();
        this.registerDefaultTools();
    }
}

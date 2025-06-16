import path from "node:path";
import * as fileSystem from "@tenex/shared/fs";
import { logger } from "@tenex/shared/node";
import type { ConversationStorage } from "../ConversationStorage";
import type { ToolRegistry } from "../tools/ToolRegistry";
import type { AgentConfig } from "../types";

export async function loadAgentConfig(
    name: string,
    _nsec: string,
    projectPath: string,
    _storage?: ConversationStorage,
    configFile?: string,
    _projectName?: string,
    _toolRegistry?: ToolRegistry
): Promise<{ config: AgentConfig; agentEventId?: string }> {
    const configPath = path.join(projectPath, ".tenex", "agents", `${name}.json`);
    let config: AgentConfig = { name };

    try {
        const loadedConfig = await fileSystem.readJsonFile<AgentConfig>(configPath);
        config = { ...config, ...loadedConfig };
    } catch (_error) {
        // Silently skip if config file not found
    }

    // For orchestrator agents, load or create system prompt from file
    const hasOrchestrationCapability =
        config.capabilities?.includes("orchestration") ||
        config.role?.toLowerCase().includes("orchestrator");

    if (hasOrchestrationCapability) {
        const systemPromptPath = path.join(projectPath, ".tenex", "agents", `${name}.md`);

        try {
            const systemPromptContent = await fileSystem.readTextFile(systemPromptPath);
            if (!systemPromptContent) throw new Error("No content");
            config.systemPrompt = systemPromptContent.trim();
        } catch (_error) {
            // Create orchestrator system prompt file
            const orchestratorPrompt = `You are the ${name} agent, an orchestrator in the TENEX multi-agent system.

## Core Responsibilities
As an orchestrator agent, you serve as a coordinator between users and the TENEX system. You handle task delegation and coordinate with specialized agents when needed.

## Agent Discovery and Collaboration
When a user asks for help with a task that would benefit from specialized expertise, you should use the **find_agent** tool to discover available agents with the right capabilities.

### When to use find_agent:
- User requests a task requiring specialized skills you don't have (e.g., "create a complex software architecture", "perform security audit", "optimize database performance")
- User explicitly asks about available agents or their capabilities
- You recognize that a specialized agent would provide better assistance

### How to use find_agent:
1. **General search**: Call find_agent with no parameters to see all available agents
2. **Capability search**: Use the 'capabilities' parameter (e.g., find_agent({ capabilities: "security audit" }))
3. **Specialization search**: Use the 'specialization' parameter (e.g., find_agent({ specialization: "React TypeScript" }))
4. **Keyword search**: Use the 'keywords' parameter for additional search terms

### Example usage:
- User: "I need help designing a scalable microservices architecture"
  You: Use find_agent({ capabilities: "architecture design", specialization: "microservices" })
  
- User: "Can you help me optimize my React application's performance?"
  You: Use find_agent({ specialization: "React", capabilities: "performance optimization" })

### After finding agents:
When you find suitable agents, present them to the user with their descriptions and capabilities. The user will decide which agents to add to the project. Only the user can authorize adding new agents to the project.

Remember: You cannot add agents yourself - you can only suggest them. The final decision rests with the user.`;

            // Write the default prompt
            await fileSystem.writeTextFile(systemPromptPath, orchestratorPrompt);
            config.systemPrompt = orchestratorPrompt;
            logger.debug(`Created default system prompt for ${name}`);
        }
    }

    let agentEventId: string | undefined;

    // If a specific config file is provided, load from that directly
    if (configFile) {
        const eventConfigPath = path.join(projectPath, ".tenex", "agents", configFile);
        try {
            const eventConfig = await fileSystem.readJsonFile(eventConfigPath);

            // Extract the event ID
            agentEventId = eventConfig.eventId;

            // Override with the cached NDKAgent event configuration
            config = {
                ...config,
                description: eventConfig.description || config.description,
                role: eventConfig.role || config.role,
                instructions: eventConfig.instructions || config.instructions,
                systemPrompt: eventConfig.systemPrompt || eventConfig.instructions,
                version: eventConfig.version || config.version,
            };
            logger.info(
                `Loaded agent ${name} config from file ${configFile}. systemPrompt: ${config.systemPrompt ? "yes" : "no"}`
            );
        } catch (_error) {
            // Silently skip if config file not found
        }
    } else {
        // Fallback: Try to find cached NDKAgent event configuration by searching files
        const agentsDir = path.join(projectPath, ".tenex", "agents");
        try {
            const files = await fileSystem.listDirectory(agentsDir);
            for (const file of files) {
                if (file.endsWith(".json") && file !== `${name}.json`) {
                    try {
                        const eventConfigPath = path.join(agentsDir, file);
                        const eventConfig = await fileSystem.readJsonFile(eventConfigPath);

                        // Check if this event configuration matches the agent name
                        if (
                            eventConfig.name &&
                            eventConfig.name.toLowerCase() === name.toLowerCase()
                        ) {
                            // Extract the event ID
                            agentEventId = eventConfig.eventId;

                            // Override with the cached NDKAgent event configuration
                            config = {
                                ...config,
                                description: eventConfig.description || config.description,
                                role: eventConfig.role || config.role,
                                instructions: eventConfig.instructions || config.instructions,
                                systemPrompt: eventConfig.systemPrompt || eventConfig.instructions,
                                version: eventConfig.version || config.version,
                            };
                            break;
                        }
                    } catch (_err) {
                        // Skip files that can't be parsed
                        logger.debug(`Skipping file ${file}: cannot parse`);
                    }
                }
            }
        } catch (_error) {
            // Directory might not exist or can't be read
            logger.debug(`Cannot read agents directory for ${name}`);
        }
    }

    return { config, agentEventId };
}

export async function saveAgentConfig(
    name: string,
    config: AgentConfig,
    projectPath: string
): Promise<void> {
    const configPath = path.join(projectPath, ".tenex", "agents", `${name}.json`);
    await fileSystem.writeJsonFile(configPath, config, { spaces: 2 });
    logger.info(`Saved agent config to ${configPath}`);
}

import * as fs from "node:fs";
import * as path from "node:path";
import { logDebug, logError } from "@tenex/shared/logger";
import { AgentRegistry } from "../agents/AgentRegistry";
import { LLMConfigManager } from "../llm/ConfigManager";
import { LLMService } from "../llm/LLMService";
import { FragmentRegistry } from "../prompts/core/FragmentRegistry";
import { PromptBuilder } from "../prompts/core/PromptBuilder";
import type { AgentProfile } from "../types";
import { DebugAgent, type DebugAgentConfig } from "./DebugAgent";

export interface DebugAgentSystemConfig {
  projectPath: string;
  agentName?: string;
  llmProvider?: string;
  llmModel?: string;
}

export interface DebugAgentSystem {
  agent: DebugAgent;
  llmService: LLMService;
  promptBuilder: PromptBuilder;
  agentRegistry: AgentRegistry;
}

export async function createDebugAgentSystem(
  config: DebugAgentSystemConfig
): Promise<DebugAgentSystem> {
  try {
    // Initialize LLM service
    const configManager = new LLMConfigManager(config.projectPath);
    await configManager.loadConfigurations();
    const llmService = new LLMService(configManager);

    // Initialize prompt system
    const fragmentRegistry = new FragmentRegistry();

    // Register debug-specific fragments
    // Debug instructions fragment is already registered in common fragments

    const promptBuilder = new PromptBuilder();

    // Initialize agent registry
    const agentRegistry = new AgentRegistry(config.projectPath);

    // Get agent profile
    let agentProfile: AgentProfile | undefined;
    if (config.agentName) {
      agentProfile = agentRegistry.getAgent(config.agentName);

      if (!agentProfile) {
        logError(`Agent '${config.agentName}' not found in registry`);
        // Create a default profile
        agentProfile = {
          name: config.agentName,
          role: "debug-agent",
          description: `Debug agent: ${config.agentName}`,
          capabilities: [],
        };
      }
    } else {
      // Use default debug agent profile
      agentProfile = {
        name: "debug-agent",
        role: "debug-agent",
        description: "Default debug agent for testing",
        capabilities: [],
      };
    }

    // Create debug tools
    const tools = createDebugTools(config.projectPath);

    // Create debug agent
    const debugAgentConfig: DebugAgentConfig = {
      name: agentProfile.name,
      profile: agentProfile,
      tools,
      model: config.llmModel,
      provider: config.llmProvider,
    };

    const agent = new DebugAgent(debugAgentConfig, llmService, promptBuilder);

    logDebug("Debug agent system created", "general", "debug", {
      agent: agent.getName(),
      toolCount: tools.size,
    });

    return {
      agent,
      llmService,
      promptBuilder,
      agentRegistry,
    };
  } catch (error) {
    logError("Failed to create debug agent system:", error);
    throw error;
  }
}

function createDebugTools(projectPath: string): Map<string, (args: unknown) => Promise<unknown>> {
  const tools = new Map<string, (args: unknown) => Promise<unknown>>();

  // List files tool
  tools.set("listFiles", async (args: unknown) => {
    const typedArgs = args as { directory?: string };
    try {
      const dir = typedArgs.directory
        ? path.resolve(projectPath, typedArgs.directory)
        : projectPath;

      const files = await fs.promises.readdir(dir);
      return { files, directory: dir };
    } catch (error) {
      return { error: (error as Error).message };
    }
  });

  // Read file tool
  tools.set("readFile", async (args: unknown) => {
    const typedArgs = args as { path: string };
    try {
      const filePath = path.resolve(projectPath, typedArgs.path);
      const content = await fs.promises.readFile(filePath, "utf-8");
      return { content, path: filePath };
    } catch (error) {
      return { error: (error as Error).message };
    }
  });

  // Get project info tool
  tools.set("getProjectInfo", async () => {
    try {
      const packageJsonPath = path.join(projectPath, "package.json");
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, "utf-8"));
        return {
          name: packageJson.name,
          version: packageJson.version,
          description: packageJson.description,
          dependencies: Object.keys(packageJson.dependencies || {}),
          devDependencies: Object.keys(packageJson.devDependencies || {}),
        };
      }
      return { error: "No package.json found" };
    } catch (error) {
      return { error: (error as Error).message };
    }
  });

  // List agents tool
  tools.set("listAgents", async () => {
    try {
      const agentsDir = path.join(projectPath, ".tenex", "agents");
      if (!fs.existsSync(agentsDir)) {
        return { agents: [] };
      }

      const files = await fs.promises.readdir(agentsDir);
      const agents = files.filter((f) => f.endsWith(".md")).map((f) => f.replace(".md", ""));

      return { agents };
    } catch (error) {
      return { error: (error as Error).message };
    }
  });

  return tools;
}

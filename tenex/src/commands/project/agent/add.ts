import fs from "node:fs/promises";
import path from "node:path";
import { AgentRegistry } from "@/agents/AgentRegistry";
import { DEFAULT_AGENT_LLM_CONFIG } from "@/llm/constants";
import { logger } from "@/utils/logger";
import { input } from "@inquirer/prompts";
import { Command } from "commander";

export const agentAddCommand = new Command("add")
  .description("Add a local agent to the project")
  .option("-p, --path <path>", "Project path", process.cwd())
  .action(async (options) => {
    try {
      const projectPath = path.resolve(options.path);

      // Check if it's a TENEX project
      const tenexPath = path.join(projectPath, ".tenex");
      try {
        await fs.access(tenexPath);
      } catch {
        throw new Error("Not in a TENEX project directory");
      }

      // Interactive wizard
      const name = await input({
        message: "Agent name:",
        validate: (value) => {
          if (!value.trim()) return "Name is required";
          if (!/^[a-zA-Z0-9-_]+$/.test(value)) {
            return "Name must contain only alphanumeric characters, hyphens, and underscores";
          }
          return true;
        },
      });

      const role = await input({
        message: "Agent role:",
        validate: (value) => (value.trim() ? true : "Role is required"),
      });

      const prompt = await input({
        message: "Agent prompt/instructions:",
        validate: (value) => (value.trim() ? true : "Prompt is required"),
      });

      // Load existing registry
      const registry = new AgentRegistry(projectPath);
      await registry.loadFromProject();

      // Check if agent already exists
      const existingAgent = registry.getAgentByName(name);
      if (existingAgent) {
        throw new Error(`Agent with name "${name}" already exists`);
      }

      // Create agent config
      const agentConfig = {
        name,
        role,
        instructions: prompt,
        llmConfig: DEFAULT_AGENT_LLM_CONFIG,
      };

      // Use AgentRegistry to ensure agent (this handles all file operations and Nostr publishing)
      const agent = await registry.ensureAgent(name, agentConfig);

      logger.info(`✅ Local agent "${name}" created successfully`);
      logger.info(`   Name: ${name}`);
      logger.info(`   Pubkey: ${agent.pubkey}`);
      logger.info("   Stored in: .tenex/agents/");
    } catch (error) {
      logger.error("Failed to create agent:", error);
      process.exit(1);
    }
  });

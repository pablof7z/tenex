import { Command } from "commander";
import { input } from "@inquirer/prompts";
import { nip19 } from "nostr-tools";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { AgentRegistry } from "@/agents/AgentRegistry";
import { AgentPublisher } from "@/agents/AgentPublisher";
import { logger } from "@/utils/logger";
import { configService } from "@/services";
import path from "node:path";
import fs from "node:fs/promises";
import { getNDK, initNDK } from "@/nostr/ndkClient";
import { DEFAULT_AGENT_LLM_CONFIG } from "@/llm/constants";

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
        validate: (value) => value.trim() ? true : "Role is required",
      });

      const prompt = await input({
        message: "Agent prompt/instructions:",
        validate: (value) => value.trim() ? true : "Prompt is required",
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
        expertise: role,
        instructions: prompt,
        llmConfig: DEFAULT_AGENT_LLM_CONFIG,
        tools: ["bash", "file-system", "web-search"],
      };

      // Use AgentRegistry to ensure agent (this handles all file operations)
      const agent = await registry.ensureAgent(name, agentConfig);
      
      // Get the agent's nsec from the signer
      const nsec = (agent.signer as NDKPrivateKeySigner).privateKey;
      const pubkey = agent.pubkey;
      const npub = nip19.npubEncode(pubkey);

      // Publish kind:0 profile and agent request to Nostr
      try {
        // Load project config to get project info
        const projectConfig = await configService.loadTenexConfig(projectPath);
        
        if (!projectConfig.nsec) {
          logger.warn("Project nsec not found, skipping Nostr publishing");
        } else {
          const projectSigner = new NDKPrivateKeySigner(projectConfig.nsec);
          const projectPubkey = projectSigner.pubkey;
          const projectName = projectConfig.description || "Unknown Project";
          
          // Initialize NDK
          await initNDK();
          const ndk = getNDK();
          
          // Create agent publisher
          const publisher = new AgentPublisher(ndk);
          
          // Publish agent profile (kind:0) and request event only
          // No NDKAgent event since this is a local-only agent
          await publisher.publishAgentCreation(
            agent.signer,
            {
              name: agent.name,
              role: agent.role,
              expertise: agent.expertise,
              instructions: agent.instructions || "",
              tools: agent.tools,
              llmConfig: agent.llmConfig,
            },
            projectName,
            projectPubkey
          );
          
          logger.info("✅ Agent profile and request published to Nostr");
        }
      } catch (error) {
        logger.error("Failed to publish agent to Nostr:", error);
        logger.warn("Agent created locally but not published");
      }

      logger.info(`✅ Local agent "${name}" created successfully`);
      logger.info(`   Name: ${name}`);
      logger.info(`   Pubkey: ${agent.pubkey}`);
      logger.info(`   Stored in: .tenex/agents/`);

    } catch (error) {
      logger.error("Failed to create agent:", error);
      process.exit(1);
    }
  });
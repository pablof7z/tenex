import path from "node:path";
import type { Agent, AgentConfig } from "@/types/agent";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared";
import { ensureDirectory, fileExists, readFile, writeJsonFile } from "@tenex/shared/fs";
import type { AgentReference, AgentDefinition, AgentsJson } from "@tenex/types/agents";
import { nip19 } from "nostr-tools";
import { generateSecretKey } from "nostr-tools";

export class AgentRegistry {
  private agents: Map<string, Agent> = new Map();
  private agentsByPubkey: Map<string, Agent> = new Map();
  private registryPath: string;
  private agentsDir: string;
  private registry: AgentsJson = {};

  constructor(private projectPath: string) {
    this.registryPath = path.join(projectPath, ".tenex", "agents.json");
    this.agentsDir = path.join(projectPath, ".tenex", "agents");
  }

  async loadFromProject(): Promise<void> {
    // Ensure .tenex directory exists
    await ensureDirectory(path.join(this.projectPath, ".tenex"));
    await ensureDirectory(this.agentsDir);

    // Load agents from agents.json file
    if (await fileExists(this.registryPath)) {
      try {
        const content = await readFile(this.registryPath, "utf-8");
        this.registry = JSON.parse(content);
        logger.info(
          `Loaded agent registry with ${Object.keys(this.registry).length} agents from ${this.registryPath}`
        );
      } catch (error) {
        logger.error("Failed to load agent registry", { error });
        this.registry = {};
      }
    } else {
      logger.info("No existing agent registry found, starting with empty registry");
      this.registry = {};
    }
  }


  async ensureAgent(name: string, config: AgentConfig): Promise<Agent> {
    // Check if agent already exists
    const existingAgent = this.agents.get(name);
    if (existingAgent) {
      return existingAgent;
    }

    // Check if we have it in registry
    let registryEntry = this.registry[name];
    let agentDefinition: AgentDefinition;

    if (!registryEntry) {
      // Generate new nsec for agent
      const privateKey = generateSecretKey();
      const nsec = nip19.nsecEncode(privateKey);

      // Create new registry entry
      const fileName = `${config.eventId || name}.json`;
      registryEntry = {
        nsec,
        file: fileName,
        eventId: config.eventId,
      };

      // Save agent definition to file
      agentDefinition = {
        name: config.name,
        role: config.role,
        expertise: config.expertise || config.role,
        instructions: config.instructions || "",
        llmConfig: config.llmConfig,
        tools: config.tools,
      };

      const definitionPath = path.join(this.agentsDir, fileName);
      await writeJsonFile(definitionPath, agentDefinition);

      this.registry[name] = registryEntry;
      await this.saveRegistry();

      logger.info(`Created new agent "${name}" with nsec`);
    } else {
      // Load agent definition from file
      const definitionPath = path.join(this.agentsDir, registryEntry.file);
      if (await fileExists(definitionPath)) {
        const content = await readFile(definitionPath, "utf-8");
        agentDefinition = JSON.parse(content);
      } else {
        // Fallback: create definition from config if file doesn't exist
        agentDefinition = {
          name: config.name,
          role: config.role,
          expertise: config.expertise || config.role,
          instructions: config.instructions || "",
          llmConfig: config.llmConfig,
          tools: config.tools,
        };
        await writeJsonFile(definitionPath, agentDefinition);
      }
    }

    // Create NDKPrivateKeySigner
    const decoded = nip19.decode(registryEntry.nsec);
    if (decoded.type !== "nsec") {
      throw new Error(`Invalid nsec for agent ${name}`);
    }

    const signer = new NDKPrivateKeySigner(decoded.data);
    const pubkey = await signer.user().then((user) => user.pubkey);

    // Create Agent instance
    const agent: Agent = {
      name: agentDefinition.name,
      pubkey,
      signer,
      role: agentDefinition.role,
      expertise: agentDefinition.expertise || agentDefinition.role,
      instructions: agentDefinition.instructions,
      llmConfig: agentDefinition.llmConfig || "default",
      tools: agentDefinition.tools || [],
      eventId: registryEntry.eventId,
    };

    // Store in both maps
    this.agents.set(name, agent);
    this.agentsByPubkey.set(pubkey, agent);

    return agent;
  }

  getAgent(name: string): Agent | undefined {
    return this.agents.get(name);
  }

  getAgentByPubkey(pubkey: string): Agent | undefined {
    return this.agentsByPubkey.get(pubkey);
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  private async saveRegistry(): Promise<void> {
    await writeJsonFile(this.registryPath, this.registry);
  }

  async loadAgentBySlug(slug: string): Promise<Agent | null> {
    const registryEntry = this.registry[slug];
    if (!registryEntry) {
      return null;
    }

    // Load agent definition from file
    const definitionPath = path.join(this.agentsDir, registryEntry.file);
    if (!(await fileExists(definitionPath))) {
      logger.error(`Agent definition file not found: ${definitionPath}`);
      return null;
    }

    const content = await readFile(definitionPath, "utf-8");
    const agentDefinition: AgentDefinition = JSON.parse(content);

    // Create AgentConfig from definition
    const config: AgentConfig = {
      name: agentDefinition.name,
      role: agentDefinition.role,
      expertise: agentDefinition.expertise || agentDefinition.role,
      instructions: agentDefinition.instructions || "",
      nsec: registryEntry.nsec,
      eventId: registryEntry.eventId,
      tools: agentDefinition.tools || [],
      llmConfig: agentDefinition.llmConfig,
    };

    return this.ensureAgent(slug, config);
  }
}

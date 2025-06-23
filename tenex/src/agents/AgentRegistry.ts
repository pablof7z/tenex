import path from "node:path";
import type { Agent, AgentConfig, AgentDefinition } from "@/agents/types";
import NDK, { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { logger } from "@/utils/logger";
import { ensureDirectory, fileExists, readFile, writeJsonFile } from "@/lib/fs";
import type { TenexAgents } from "@/services/config/types";
import { configService } from "@/services";
import { AgentPublisher } from "@/agents/AgentPublisher";
import { DEFAULT_AGENT_LLM_CONFIG } from "@/llm/constants";
import { BOSS_AGENT_DEFINITION } from "./projectAgentDefinition";

export class AgentRegistry {
  private agents: Map<string, Agent> = new Map();
  private agentsByPubkey: Map<string, Agent> = new Map();
  private registryPath: string;
  private agentsDir: string;
  private registry: TenexAgents = {};

  constructor(private projectPath: string) {
    this.registryPath = path.join(projectPath, ".tenex", "agents.json");
    this.agentsDir = path.join(projectPath, ".tenex", "agents");
  }

  async loadFromProject(): Promise<void> {
    // Ensure .tenex directory exists
    await ensureDirectory(path.join(this.projectPath, ".tenex"));
    await ensureDirectory(this.agentsDir);

    // Load agents using ConfigService
    try {
      this.registry = await configService.loadTenexAgents(path.join(this.projectPath, ".tenex"));
      logger.info(
        `Loaded agent registry with ${Object.keys(this.registry).length} agents via ConfigService`
      );
      
      // Load each agent from the registry
      for (const [slug, registryEntry] of Object.entries(this.registry)) {
        await this.loadAgentBySlug(slug);
      }
      
      logger.info(`Loaded ${this.agents.size} agents into runtime`);
    } catch (error) {
      logger.error("Failed to load agent registry", { error });
      this.registry = {};
    }
  }

  async ensureAgent(name: string, config: Omit<AgentConfig, 'nsec'> & { nsec?: string }): Promise<Agent> {
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
      const signer = NDKPrivateKeySigner.generate();
      const { nsec } = signer;

      // Create new registry entry
      const fileName = `${config.eventId || name.toLowerCase().replace(/[^a-z0-9]/g, "-")}.json`;
      registryEntry = {
        nsec,
        file: fileName,
      };
      
      // Only add eventId if it exists
      if (config.eventId) {
        registryEntry.eventId = config.eventId;
      }

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
      
      // Publish kind:0 and request events for new agent
      const { nsec: _, ...configWithoutNsec } = config;
      await this.publishAgentEvents(signer, configWithoutNsec, registryEntry.eventId);
    } else {
      // Load agent definition from file
      const definitionPath = path.join(this.agentsDir, registryEntry.file);
      if (await fileExists(definitionPath)) {
        const content = await readFile(definitionPath, "utf-8");
        try {
          agentDefinition = JSON.parse(content);
          this.validateAgentDefinition(agentDefinition);
        } catch (error) {
          logger.error("Failed to parse or validate agent definition", { 
            file: registryEntry.file, 
            error 
          });
          throw new Error(`Invalid agent definition in ${registryEntry.file}: ${error}`);
        }
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
    const signer = new NDKPrivateKeySigner(registryEntry.nsec);
    const pubkey = signer.pubkey;

    // Create Agent instance
    const agent: Agent = {
      name: agentDefinition.name,
      pubkey,
      signer,
      role: agentDefinition.role,
      expertise: agentDefinition.expertise || agentDefinition.role,
      instructions: agentDefinition.instructions,
      llmConfig: agentDefinition.llmConfig || DEFAULT_AGENT_LLM_CONFIG,
      tools: agentDefinition.tools || [],
      eventId: registryEntry.eventId,
      slug: name,
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

  getAllAgentsMap(): Map<string, Agent> {
    return new Map(this.agents);
  }

  getAgentByName(name: string): Agent | undefined {
    return Array.from(this.agents.values()).find(agent => agent.name === name);
  }

  async createAgent(name: string, role: string, config: Partial<AgentConfig>): Promise<Agent & { nsec: string }> {
    // Generate new nsec for agent
    const signer = NDKPrivateKeySigner.generate();
    const { nsec, pubkey } = signer;

    // Create Agent instance
    const agent: Agent & { nsec: string } = {
      name,
      pubkey,
      signer,
      role,
      expertise: config.expertise || role,
      instructions: config.instructions || "",
      llmConfig: config.llmConfig || DEFAULT_AGENT_LLM_CONFIG,
      tools: config.tools || [],
      nsec,
      slug: name,
      // No eventId for local agents
    };

    return agent;
  }

  private async saveRegistry(): Promise<void> {
    await configService.saveProjectAgents(this.projectPath, this.registry);
  }

  /**
   * Create a new boss agent with the given configuration
   */
  async createBossAgent(slug: string, nsec: string): Promise<Agent> {
    // Create registry entry with boss flag
    const fileName = `${slug}.json`;
    const registryEntry = {
      nsec,
      file: fileName,
      boss: true,
    };

    // Save boss agent definition to file
    const definitionPath = path.join(this.agentsDir, fileName);
    await writeJsonFile(definitionPath, BOSS_AGENT_DEFINITION);

    this.registry[slug] = registryEntry;
    await this.saveRegistry();

    logger.info(`Created boss agent "${slug}" in registry`);

    // Create and return the agent with boss definition
    return this.ensureAgent(slug, {
      name: BOSS_AGENT_DEFINITION.name,
      role: BOSS_AGENT_DEFINITION.role,
      expertise: BOSS_AGENT_DEFINITION.expertise || BOSS_AGENT_DEFINITION.role,
      instructions: BOSS_AGENT_DEFINITION.instructions,
      tools: BOSS_AGENT_DEFINITION.tools || [],
      llmConfig: BOSS_AGENT_DEFINITION.llmConfig,
      nsec
    });
  }

  /**
   * Get the boss agent if one exists
   */
  getBossAgent(): Agent | undefined {
    // Find the agent with boss flag
    for (const [slug, registryEntry] of Object.entries(this.registry)) {
      if (registryEntry.boss) {
        return this.agents.get(slug);
      }
    }
    return undefined;
  }

  private async publishAgentEvents(signer: NDKPrivateKeySigner, config: Omit<AgentConfig, 'nsec'>, ndkAgentEventId?: string): Promise<void> {
    try {
      // Load project config to get project info
      const projectConfig = await configService.loadTenexConfig(this.projectPath);
      const projectName = projectConfig.description || "Unknown Project";
      
      // Get boss agent to find project pubkey
      const bossAgent = this.getBossAgent();
      if (!bossAgent) {
        logger.warn("Boss agent not found, skipping agent event publishing");
        return;
      }
      
      const projectPubkey = bossAgent.pubkey;
      
      // Initialize NDK
      const ndk = new NDK({
        explicitRelayUrls: [
          "wss://relay.damus.io",
          "wss://relay.nostr.band",
          "wss://nos.lol",
          "wss://relay.primal.net"
        ],
      });
      
      await ndk.connect();
      
      // Create agent publisher
      const publisher = new AgentPublisher(ndk);
      
      // Publish agent profile (kind:0) and request event
      await publisher.publishAgentCreation(
        signer,
        config,
        projectName,
        projectPubkey,
        ndkAgentEventId
      );
      
      logger.info(`Published agent events for "${config.name}"`);
    } catch (error) {
      logger.error("Failed to publish agent events", { error });
      // Don't throw - agent creation should succeed even if publishing fails
    }
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
    let agentDefinition: AgentDefinition;
    try {
      agentDefinition = JSON.parse(content);
      this.validateAgentDefinition(agentDefinition);
    } catch (error) {
      logger.error("Failed to parse or validate agent definition", { 
        file: definitionPath, 
        error 
      });
      throw new Error(`Invalid agent definition in ${definitionPath}: ${error}`);
    }

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

  /**
   * Validate an agent definition has all required fields
   */
  private validateAgentDefinition(definition: any): asserts definition is AgentDefinition {
    if (!definition || typeof definition !== 'object') {
      throw new Error('Agent definition must be an object');
    }

    if (!definition.name || typeof definition.name !== 'string') {
      throw new Error('Agent definition must have a name property');
    }

    if (!definition.role || typeof definition.role !== 'string') {
      throw new Error('Agent definition must have a role property');
    }

    // Optional fields with type validation
    if (definition.expertise !== undefined && typeof definition.expertise !== 'string') {
      throw new Error('Agent expertise must be a string');
    }

    if (definition.instructions !== undefined && typeof definition.instructions !== 'string') {
      throw new Error('Agent instructions must be a string');
    }

    if (definition.tools !== undefined && !Array.isArray(definition.tools)) {
      throw new Error('Agent tools must be an array');
    }

    if (definition.llmConfig !== undefined && typeof definition.llmConfig !== 'string') {
      throw new Error('Agent llmConfig must be a string');
    }
  }
}

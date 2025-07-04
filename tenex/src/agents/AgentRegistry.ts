import path from "node:path";
import { AgentPublisher } from "@/agents/AgentPublisher";
import type { Agent, AgentConfig, StoredAgentData } from "@/agents/types";
import { ensureDirectory, fileExists, readFile, writeJsonFile } from "@/lib/fs";
import { DEFAULT_AGENT_LLM_CONFIG } from "@/llm/constants";
import { getNDK } from "@/nostr";
import { configService } from "@/services";
import { getProjectContext, isProjectContextInitialized } from "@/services";
import type { TenexAgents } from "@/services/config/types";
import { logger } from "@/utils/logger";
import NDK, { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { getBuiltInAgents } from "./builtInAgents";
import { getDefaultToolsForAgent } from "./constants";
import { PM_AGENT_DEFINITION } from "./projectAgentDefinition";

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
      for (const [slug, _registryEntry] of Object.entries(this.registry)) {
        await this.loadAgentBySlug(slug);
      }

      // Load built-in agents
      await this.ensureBuiltInAgents();

      logger.info(`Loaded ${this.agents.size} agents into runtime`);
    } catch (error) {
      logger.error("Failed to load agent registry", { error });
      this.registry = {};
    }
  }

  async ensureAgent(
    name: string,
    config: Omit<AgentConfig, "nsec"> & { nsec?: string }
  ): Promise<Agent> {
    // Check if agent already exists
    const existingAgent = this.agents.get(name);
    if (existingAgent) {
      return existingAgent;
    }

    // Check if we have it in registry
    let registryEntry = this.registry[name];
    let agentDefinition: StoredAgentData;

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
        instructions: config.instructions || "",
        llmConfig: config.llmConfig,
        tools: getDefaultToolsForAgent(false, undefined, false), // All non-PM agents get same tools
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
            error,
          });
          throw new Error(`Invalid agent definition in ${registryEntry.file}: ${error}`);
        }
      } else {
        // Fallback: create definition from config if file doesn't exist
        agentDefinition = {
          name: config.name,
          role: config.role,
          instructions: config.instructions || "",
          llmConfig: config.llmConfig,
          tools: getDefaultToolsForAgent(false, undefined, false), // All non-PM agents get same tools
        };
        await writeJsonFile(definitionPath, agentDefinition);
      }
    }

    // Create NDKPrivateKeySigner
    const signer = new NDKPrivateKeySigner(registryEntry.nsec);
    const pubkey = signer.pubkey;

    // Determine agent name - use project name for PM agents
    let agentName = agentDefinition.name;
    if (registryEntry.pmAgent) {
      try {
        const { getProjectContext } = await import("@/services");
        const projectCtx = getProjectContext();
        const projectTitle = projectCtx.project.tagValue("title");
        if (projectTitle) {
          agentName = projectTitle;
        }
      } catch {
        // If project context not available, use default name
        agentName = agentDefinition.name;
      }
    }

    // Create Agent instance
    const agent: Agent = {
      name: agentName,
      pubkey,
      signer,
      role: agentDefinition.role,
      instructions: agentDefinition.instructions,
      llmConfig: agentDefinition.llmConfig || DEFAULT_AGENT_LLM_CONFIG,
      tools: [], // Will be set after creation
      eventId: registryEntry.eventId,
      slug: name,
      isPMAgent: registryEntry.pmAgent,
    };

    // Set tools based on agent type
    agent.tools = getDefaultToolsForAgent(
      registryEntry.pmAgent || false,
      undefined,
      agent.isBuiltIn
    );

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
    return Array.from(this.agents.values()).find((agent) => agent.name === name);
  }

  private async saveRegistry(): Promise<void> {
    await configService.saveProjectAgents(this.projectPath, this.registry);
  }

  /**
   * Create a new PM agent with the given configuration
   */
  async createPMAgent(slug: string, nsec: string): Promise<Agent> {
    // Create registry entry with pmAgent flag
    const fileName = `${slug}.json`;
    const registryEntry = {
      nsec,
      file: fileName,
      pmAgent: true,
    };

    // Save PM agent definition to file
    const definitionPath = path.join(this.agentsDir, fileName);
    await writeJsonFile(definitionPath, PM_AGENT_DEFINITION);

    this.registry[slug] = registryEntry;
    await this.saveRegistry();

    logger.info(`Created PM agent "${slug}" in registry`);

    // Create and return the agent with PM definition
    return this.ensureAgent(slug, {
      name: PM_AGENT_DEFINITION.name,
      role: PM_AGENT_DEFINITION.role,
      instructions: PM_AGENT_DEFINITION.instructions,
      llmConfig: PM_AGENT_DEFINITION.llmConfig,
      nsec,
    });
  }

  /**
   * Get the PM agent if one exists
   */
  getPMAgent(): Agent | undefined {
    // Find the agent with pmAgent flag
    for (const [slug, registryEntry] of Object.entries(this.registry)) {
      if (registryEntry.pmAgent) {
        return this.agents.get(slug);
      }
    }
    return undefined;
  }

  private async publishAgentEvents(
    signer: NDKPrivateKeySigner,
    config: Omit<AgentConfig, "nsec">,
    ndkAgentEventId?: string
  ): Promise<void> {
    try {
      // Load project config to get project info
      const projectConfig = await configService.loadTenexConfig(this.projectPath);
      const projectName = projectConfig.description || "Unknown Project";

      // Check if project context is initialized
      if (!isProjectContextInitialized()) {
        logger.warn("ProjectContext not initialized, skipping agent event publishing");
        return;
      }

      // Get project context for project pubkey
      const projectCtx = getProjectContext();

      const ndk = getNDK();
      await ndk.connect();

      // Create agent publisher
      const publisher = new AgentPublisher(ndk);

      // Publish agent profile (kind:0) and request event
      await publisher.publishAgentCreation(
        signer,
        config,
        projectName,
        projectCtx.project.pubkey,
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
    let agentDefinition: StoredAgentData;
    try {
      agentDefinition = JSON.parse(content);
      this.validateAgentDefinition(agentDefinition);
    } catch (error) {
      logger.error("Failed to parse or validate agent definition", {
        file: definitionPath,
        error,
      });
      throw new Error(`Invalid agent definition in ${definitionPath}: ${error}`);
    }

    // Create AgentConfig from definition
    const config: AgentConfig = {
      name: agentDefinition.name,
      role: agentDefinition.role,
      instructions: agentDefinition.instructions || "",
      nsec: registryEntry.nsec,
      eventId: registryEntry.eventId,
      tools: getDefaultToolsForAgent(false), // All non-PM agents get same tools
      llmConfig: agentDefinition.llmConfig,
    };

    return this.ensureAgent(slug, config);
  }

  /**
   * Validate an agent definition has all required fields
   */
  private validateAgentDefinition(definition: unknown): asserts definition is StoredAgentData {
    if (!definition || typeof definition !== "object") {
      throw new Error("Agent definition must be an object");
    }

    const def = definition as Record<string, unknown>;

    if (!def.name || typeof def.name !== "string") {
      throw new Error("Agent definition must have a name property");
    }

    if (!def.role || typeof def.role !== "string") {
      throw new Error("Agent definition must have a role property");
    }

    // Optional fields with type validation

    if (def.instructions !== undefined && typeof def.instructions !== "string") {
      throw new Error("Agent instructions must be a string");
    }

    if (def.tools !== undefined && !Array.isArray(def.tools)) {
      throw new Error("Agent tools must be an array");
    }

    if (def.llmConfig !== undefined && typeof def.llmConfig !== "string") {
      throw new Error("Agent llmConfig must be a string");
    }
  }

  /**
   * Ensure built-in agents are loaded
   */
  private async ensureBuiltInAgents(): Promise<void> {
    const builtInAgents = getBuiltInAgents();

    for (const def of builtInAgents) {
      // Use ensureAgent just like any other agent
      const agent = await this.ensureAgent(def.slug, {
        name: def.name,
        role: def.role,
        instructions: def.instructions || "",
        llmConfig: def.llmConfig || DEFAULT_AGENT_LLM_CONFIG,
      });

      // Mark as built-in after creation and update tools
      if (agent) {
        agent.isBuiltIn = true;
        agent.tools = getDefaultToolsForAgent(false, undefined, true);
      }
    }
  }
}

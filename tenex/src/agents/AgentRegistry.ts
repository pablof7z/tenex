import path from "node:path";
import type { Agent, AgentConfig } from "@/types/agent";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared";
import { ensureDirectory, fileExists, readFile, writeJsonFile } from "@tenex/shared/fs";
import { configurationService } from "@tenex/shared/services";
import { nip19 } from "nostr-tools";
import { generateSecretKey } from "nostr-tools";

interface AgentRegistryEntry {
  nsec: string;
  file: string;
  pubkey?: string;
  llmConfig?: string;
}

export class AgentRegistry {
  private agents: Map<string, Agent> = new Map();
  private agentsByPubkey: Map<string, Agent> = new Map();
  private registryPath: string;
  private registry: Record<string, AgentRegistryEntry> = {};

  constructor(private projectPath: string) {
    this.registryPath = path.join(projectPath, ".tenex", "agents.json");
  }

  async loadFromProject(): Promise<void> {
    // Ensure .tenex directory exists
    await ensureDirectory(path.join(this.projectPath, ".tenex"));

    // Try to load agents from both global and project locations using ConfigurationService
    try {
      // Load project agents
      const projectAgents = await this.loadAgentsFromPath(path.join(this.projectPath, ".tenex"));

      // Load global agents
      const globalAgents = await this.loadAgentsFromPath(
        path.join(process.env.HOME || "~", ".tenex")
      );

      // Merge agents (project overrides global)
      this.registry = { ...globalAgents, ...projectAgents };

      const globalCount = Object.keys(globalAgents).length;
      const projectCount = Object.keys(projectAgents).length;

      logger.info(
        `Loaded agent registry with ${Object.keys(this.registry).length} agents (${globalCount} global, ${projectCount} project)`
      );
    } catch (error) {
      logger.warn(
        "Failed to load agents through ConfigurationService, falling back to legacy loading",
        { error }
      );
      await this.loadLegacyRegistry();
    }

    // Load agent configurations from .tenex/agents directory
    const agentsDir = path.join(this.projectPath, ".tenex", "agents");
    if (await fileExists(agentsDir)) {
      // This would load agent configurations from individual files
      // For now, we'll rely on agents being created through ensureAgent
    }
  }

  private async loadAgentsFromPath(basePath: string): Promise<Record<string, AgentRegistryEntry>> {
    try {
      const agentsConfig = await configurationService.loadAgentsConfig(basePath);
      const registry: Record<string, AgentRegistryEntry> = {};

      // Handle new AgentsJson format
      if ("agents" in agentsConfig) {
        for (const [name, config] of Object.entries(agentsConfig.agents)) {
          // For now, generate nsec for agents that don't have one
          // This is temporary until we have a proper nsec management system
          const privateKey = generateSecretKey();
          const nsec = nip19.nsecEncode(privateKey);

          registry[name] = {
            nsec,
            file: `${name}.json`,
            llmConfig: config.llmConfig,
          };
        }
      }

      return registry;
    } catch (error) {
      // Return empty registry if file doesn't exist
      return {};
    }
  }

  private async loadLegacyRegistry(): Promise<void> {
    // Legacy loading from project's agents.json only
    if (await fileExists(this.registryPath)) {
      try {
        const content = await readFile(this.registryPath, "utf-8");
        this.registry = JSON.parse(content);
        logger.info(
          `Loaded legacy agent registry with ${Object.keys(this.registry).length} agents (project only)`
        );
      } catch (error) {
        logger.error("Failed to load legacy agent registry", { error });
        this.registry = {};
      }
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

    if (!registryEntry) {
      // Generate new nsec for agent
      const privateKey = generateSecretKey();
      const nsec = nip19.nsecEncode(privateKey);

      registryEntry = {
        nsec,
        file: `${config.eventId || name}.json`,
        llmConfig: config.llmConfig || "default",
      };

      this.registry[name] = registryEntry;
      await this.saveRegistry();

      logger.info(`Created new agent "${name}" with nsec`);
    }

    // Create NDKPrivateKeySigner
    const decoded = nip19.decode(registryEntry.nsec);
    if (decoded.type !== "nsec") {
      throw new Error(`Invalid nsec for agent ${name}`);
    }

    const signer = new NDKPrivateKeySigner(decoded.data);
    const pubkey = await signer.user().then((user) => user.pubkey);

    // Update registry with pubkey if not present
    if (!registryEntry.pubkey) {
      registryEntry.pubkey = pubkey;
      await this.saveRegistry();
    }

    // Create Agent instance
    const agent: Agent = {
      name: config.name,
      pubkey,
      signer,
      role: config.role,
      expertise: config.expertise || config.role,
      instructions: config.instructions,
      llmConfig: registryEntry.llmConfig || config.llmConfig || "default",
      tools: config.tools || [],
      eventId: config.eventId,
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
}

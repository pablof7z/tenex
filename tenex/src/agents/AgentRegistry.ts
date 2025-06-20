import path from "node:path";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared";
import { ensureDirectory, fileExists, readFile, writeJsonFile } from "@tenex/shared/fs";
import { nip19 } from "nostr-tools";
import { generateSecretKey } from "nostr-tools";
import type { Agent, AgentConfig } from "@/types/agent";

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

    // Load existing registry if it exists
    if (await fileExists(this.registryPath)) {
      try {
        const content = await readFile(this.registryPath, "utf-8");
        this.registry = JSON.parse(content);
        logger.info(`Loaded agent registry with ${Object.keys(this.registry).length} agents`);
      } catch (error) {
        logger.error("Failed to load agent registry", { error });
        this.registry = {};
      }
    }

    // Load agent configurations from .tenex/agents directory
    const agentsDir = path.join(this.projectPath, ".tenex", "agents");
    if (await fileExists(agentsDir)) {
      // This would load agent configurations from individual files
      // For now, we'll rely on agents being created through ensureAgent
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

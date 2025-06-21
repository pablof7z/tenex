import type { AgentRegistry as IAgentRegistry } from "@/agents/AgentRegistry";
import type { Agent, AgentConfig } from "@/types/agent";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";

export class MockAgent implements Agent {
  name: string;
  pubkey: string;
  signer: NDKPrivateKeySigner;
  role: string;
  expertise: string;
  instructions: string;
  llmConfig: string;
  tools: string[];
  eventId?: string;

  constructor(config: Partial<Agent> = {}) {
    this.name = config.name || "TestAgent";
    this.signer = config.signer || NDKPrivateKeySigner.generate();
    this.pubkey = config.pubkey || this.signer.pubkey;
    this.role = config.role || "Test Role";
    this.expertise = config.expertise || "Test Expertise";
    this.instructions = config.instructions || "Test Instructions";
    this.llmConfig = config.llmConfig || "default";
    this.tools = config.tools || [];
    this.eventId = config.eventId;
  }
}

export class MockAgentRegistry implements Partial<IAgentRegistry> {
  private agents: Map<string, Agent> = new Map();

  async loadFromProject(): Promise<void> {
    // Mock implementation
    return Promise.resolve();
  }

  async ensureAgent(name: string, config: AgentConfig): Promise<Agent> {
    const existing = this.agents.get(name);
    if (existing) return existing;

    const signer = config.nsec
      ? new NDKPrivateKeySigner(config.nsec)
      : NDKPrivateKeySigner.generate();

    const agent: Agent = {
      name: config.name,
      pubkey: config.pubkey || signer.pubkey,
      signer,
      role: config.role,
      expertise: config.expertise,
      instructions: config.instructions,
      llmConfig: config.llmConfig || "default",
      tools: config.tools || [],
      eventId: config.eventId,
    };

    this.agents.set(name, agent);
    return agent;
  }

  getAgent(name: string): Agent | undefined {
    return this.agents.get(name);
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  // Test helper methods
  addAgent(agent: Agent): void {
    this.agents.set(agent.name, agent);
  }

  clearAgents(): void {
    this.agents.clear();
  }
}

export function createMockAgent(overrides: Partial<Agent> = {}): MockAgent {
  return new MockAgent(overrides);
}

export function createMockAgentRegistry(): MockAgentRegistry {
  return new MockAgentRegistry();
}

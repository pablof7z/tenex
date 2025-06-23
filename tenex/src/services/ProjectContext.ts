import type { Hexpubkey, NDKProject } from "@nostr-dev-kit/ndk";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import type { Agent } from "@/agents/types";

/**
 * Loaded agent with runtime information
 */
export interface LoadedAgent extends Agent {
  slug: string; // Agent slug/key from agents.json
}

/**
 * ProjectContext provides system-wide access to loaded project and agents
 * Initialized during "tenex project run" by ProjectManager
 */
export class ProjectContext {
  public readonly project: NDKProject;
  public readonly signer: NDKPrivateKeySigner;
  public readonly pubkey: Hexpubkey;
  public readonly agents: Map<string, LoadedAgent>;

  constructor(
    project: NDKProject,
    projectNsec: string,
    agents: Map<string, LoadedAgent>
  ) {
    this.project = project;
    this.signer = new NDKPrivateKeySigner(projectNsec);
    this.pubkey = this.signer.pubkey;
    this.agents = new Map(agents);
  }

  // =====================================================================================
  // AGENT ACCESS HELPERS
  // =====================================================================================

  getAgent(slug: string): LoadedAgent | undefined {
    return this.agents.get(slug);
  }

  getAgentNsec(slug: string): string | undefined {
    const agent = this.getAgent(slug);
    return agent?.signer?.privateKey ? agent.signer.privateKey : undefined;
  }

  getAgentSlugs(): string[] {
    return Array.from(this.agents.keys());
  }

  hasAgent(slug: string): boolean {
    return this.agents.has(slug);
  }
}

// Module-level variable for global access
let projectContext: ProjectContext | undefined = undefined;

/**
 * Initialize the project context. Should be called once during project startup.
 */
export function setProjectContext(
  project: NDKProject,
  projectNsec: string,
  agents: Map<string, LoadedAgent>
): void {
  projectContext = new ProjectContext(project, projectNsec, agents);
}

/**
 * Get the initialized project context
 * @throws Error if not initialized
 */
export function getProjectContext(): ProjectContext {
  if (!projectContext) {
    throw new Error("ProjectContext not initialized. Call setProjectContext() first.");
  }
  return projectContext;
}

/**
 * Check if project context is initialized
 */
export function isProjectContextInitialized(): boolean {
  return projectContext !== undefined;
}

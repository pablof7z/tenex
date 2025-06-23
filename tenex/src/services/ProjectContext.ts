import type { Hexpubkey, NDKProject } from "@nostr-dev-kit/ndk";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import type { Agent } from "@/agents/types";
import { PROJECT_AGENT_SLUG } from "@/agents/projectAgentDefinition";


/**
 * ProjectContext provides system-wide access to loaded project and agents
 * Initialized during "tenex project run" by ProjectManager
 */
export class ProjectContext {
  /**
   * Event that represents this project, note that this is SIGNED
   * by the USER, so this.project.pubkey is NOT the project's pubkey but the
   * USER OWNER'S pubkey.
   *
   * - projectCtx.pubkey = The project agent's pubkey (the bot/system)
   * - projectCtx.project.pubkey = The user's pubkey (who created the project)
   */
  public readonly project: NDKProject;

  /**
   * Signer the project agent uses (hardwired to project agent's signer)
   */
  public readonly signer: NDKPrivateKeySigner;

  /**
   * Pubkey of the project agent
   */
  public readonly pubkey: Hexpubkey;
  public readonly agents: Map<string, Agent>;

  constructor(project: NDKProject, agents: Map<string, Agent>) {
    this.project = project;
    
    // Get project agent from agents map
    const projectAgent = agents.get(PROJECT_AGENT_SLUG);
    if (!projectAgent) {
      throw new Error("Project agent not found in agents registry");
    }
    
    // Hardwire to project agent's signer and pubkey
    this.signer = projectAgent.signer;
    this.pubkey = projectAgent.pubkey;
    this.agents = new Map(agents);
  }

  // =====================================================================================
  // AGENT ACCESS HELPERS
  // =====================================================================================

  getAgent(slug: string): Agent | undefined {
    return this.agents.get(slug);
  }

  getProjectAgent(): Agent {
    const projectAgent = this.agents.get(PROJECT_AGENT_SLUG);
    if (!projectAgent) {
      throw new Error("Project agent not found");
    }
    return projectAgent;
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
  agents: Map<string, Agent>
): void {
  projectContext = new ProjectContext(project, agents);
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

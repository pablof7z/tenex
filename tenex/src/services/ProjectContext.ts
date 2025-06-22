import type { NDKProject } from "@nostr-dev-kit/ndk";
import type { Agent } from "@/types/agent";

/**
 * Loaded agent with runtime information
 */
export interface LoadedAgent extends Agent {
  slug: string; // Agent slug/key from agents.json
}

/**
 * ProjectContext singleton
 * Provides system-wide access to loaded project and agents
 * Initialized during "tenex project run" by ProjectManager
 */
export class ProjectContext {
  private static instance: ProjectContext;
  private _project: NDKProject | null = null;
  private _projectNsec: string | null = null;
  private _agents: Map<string, LoadedAgent> = new Map();
  private _initialized = false;

  private constructor() {}

  static getInstance(): ProjectContext {
    if (!ProjectContext.instance) {
      ProjectContext.instance = new ProjectContext();
    }
    return ProjectContext.instance;
  }

  // =====================================================================================
  // INITIALIZATION
  // =====================================================================================

  static initialize(
    project: NDKProject,
    projectNsec: string,
    agents: Map<string, LoadedAgent>
  ): void {
    const instance = ProjectContext.getInstance();
    instance._project = project;
    instance._projectNsec = projectNsec;
    instance._agents = new Map(agents);
    instance._initialized = true;
  }

  static reset(): void {
    const instance = ProjectContext.getInstance();
    instance._project = null;
    instance._projectNsec = null;
    instance._agents.clear();
    instance._initialized = false;
  }

  // =====================================================================================
  // PROJECT ACCESS
  // =====================================================================================

  getCurrentProject(): NDKProject {
    this.ensureInitialized();
    if (!this._project) {
      throw new Error("Project not loaded");
    }
    return this._project;
  }

  getCurrentProjectNsec(): string {
    this.ensureInitialized();
    if (!this._projectNsec) {
      throw new Error("Project nsec not available");
    }
    return this._projectNsec;
  }

  // =====================================================================================
  // AGENT ACCESS
  // =====================================================================================

  getAgent(slug: string): LoadedAgent | undefined {
    this.ensureInitialized();
    return this._agents.get(slug);
  }

  getAgentNsec(slug: string): string | undefined {
    const agent = this.getAgent(slug);
    return agent?.signer?.privateKey ? agent.signer.privateKey : undefined;
  }

  getAllAgents(): Map<string, LoadedAgent> {
    this.ensureInitialized();
    return new Map(this._agents);
  }

  getAgentSlugs(): string[] {
    this.ensureInitialized();
    return Array.from(this._agents.keys());
  }

  hasAgent(slug: string): boolean {
    this.ensureInitialized();
    return this._agents.has(slug);
  }

  // =====================================================================================
  // STATUS CHECKS
  // =====================================================================================

  isInitialized(): boolean {
    return this._initialized;
  }

  hasProject(): boolean {
    return this._initialized && this._project !== null;
  }

  hasAgents(): boolean {
    return this._initialized && this._agents.size > 0;
  }

  // =====================================================================================
  // PRIVATE HELPERS
  // =====================================================================================

  private ensureInitialized(): void {
    if (!this._initialized) {
      throw new Error("ProjectContext not initialized. Call ProjectContext.initialize() first.");
    }
  }
}

// Export singleton instance for convenience
export const projectContext = ProjectContext.getInstance();

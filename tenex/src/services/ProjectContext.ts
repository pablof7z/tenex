import type { Agent } from "@/agents/types";
import type { NDKAgentLesson } from "@/events/NDKAgentLesson";
import { logger } from "@/utils/logger";
import type { Hexpubkey, NDKProject } from "@nostr-dev-kit/ndk";
import type { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";

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
    public project: NDKProject;

    /**
     * Signer the project agent uses (hardwired to orchestrator agent's signer)
     */
    public readonly signer: NDKPrivateKeySigner;

    /**
     * Pubkey of the project agent
     */
    public readonly pubkey: Hexpubkey;

    /**
     * The orchestrator agent for this project
     */
    public orchestrator: Agent;

    public agents: Map<string, Agent>;

    /**
     * Lessons learned by agents in this project
     * Key: agent pubkey, Value: array of lessons (limited to most recent 50 per agent)
     */
    public readonly agentLessons: Map<string, NDKAgentLesson[]>;

    constructor(project: NDKProject, agents: Map<string, Agent>) {
        this.project = project;

        // Debug logging
        logger.debug("Initializing ProjectContext", {
            projectId: project.id,
            projectTitle: project.tagValue("title"),
            agentsCount: agents.size,
            agentSlugs: Array.from(agents.keys()),
            agentDetails: Array.from(agents.entries()).map(([slug, agent]) => ({
                slug,
                name: agent.name,
                isOrchestrator: agent.isOrchestrator,
                isBuiltIn: agent.isBuiltIn,
            })),
        });

        // Find the orchestrator agent dynamically
        let orchestratorAgent: Agent | undefined;
        for (const agent of agents.values()) {
            if (agent.isOrchestrator) {
                orchestratorAgent = agent;
                break;
            }
        }

        if (!orchestratorAgent) {
            throw new Error(
                "Orchestrator agent not found. Ensure AgentRegistry.loadFromProject() is called before initializing ProjectContext."
            );
        }

        // Hardwire to orchestrator agent's signer and pubkey
        this.signer = orchestratorAgent.signer;
        this.pubkey = orchestratorAgent.pubkey;
        this.orchestrator = orchestratorAgent;
        this.agents = new Map(agents);
        this.agentLessons = new Map();
    }

    // =====================================================================================
    // AGENT ACCESS HELPERS
    // =====================================================================================

    getAgent(slug: string): Agent | undefined {
        return this.agents.get(slug);
    }

    getAgentByPubkey(pubkey: Hexpubkey): Agent | undefined {
        // Find the agent dynamically
        for (const agent of this.agents.values()) {
            if (agent.pubkey === pubkey) {
                return agent;
            }
        }

        return undefined;
    }

    getProjectAgent(): Agent {
        return this.orchestrator;
    }

    getAgentSlugs(): string[] {
        return Array.from(this.agents.keys());
    }

    hasAgent(slug: string): boolean {
        return this.agents.has(slug);
    }

    // =====================================================================================
    // LESSON MANAGEMENT
    // =====================================================================================

    /**
     * Add a lesson for an agent, maintaining the 50-lesson limit per agent
     */
    addLesson(agentPubkey: string, lesson: NDKAgentLesson): void {
        const existingLessons = this.agentLessons.get(agentPubkey) || [];

        // Add the new lesson at the beginning (most recent first)
        const updatedLessons = [lesson, ...existingLessons];

        // Keep only the most recent 50 lessons
        const limitedLessons = updatedLessons.slice(0, 50);

        this.agentLessons.set(agentPubkey, limitedLessons);
    }

    /**
     * Get lessons for a specific agent
     */
    getLessonsForAgent(agentPubkey: string): NDKAgentLesson[] {
        return this.agentLessons.get(agentPubkey) || [];
    }

    /**
     * Get all lessons across all agents
     */
    getAllLessons(): NDKAgentLesson[] {
        return Array.from(this.agentLessons.values()).flat();
    }

    /**
     * Safely update project data without creating a new instance.
     * This ensures all parts of the system work with consistent state.
     */
    updateProjectData(newProject: NDKProject, newAgents: Map<string, Agent>): void {
        this.project = newProject;
        this.agents = new Map(newAgents);

        // Update orchestrator reference if it exists in new agents
        for (const agent of newAgents.values()) {
            if (agent.isOrchestrator) {
                this.orchestrator = agent;
                break;
            }
        }

        logger.info("ProjectContext updated with new data", {
            projectId: newProject.id,
            projectTitle: newProject.tagValue("title"),
            totalAgents: newAgents.size,
            agentSlugs: Array.from(newAgents.keys()),
        });
    }
}

// Module-level variable for global access
let projectContext: ProjectContext | undefined = undefined;

/**
 * Initialize the project context. Should be called once during project startup.
 */
export function setProjectContext(project: NDKProject, agents: Map<string, Agent>): void {
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

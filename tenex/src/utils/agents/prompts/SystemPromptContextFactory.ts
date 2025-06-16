import type { ProjectInfo } from "@/commands/run/ProjectLoader";
import type { CachedRule } from "@/utils/RulesManager";
import type { Agent } from "@/utils/agents/Agent";
import type { SystemPromptContext } from "@/utils/agents/prompts/types";

/**
 * Factory for creating SystemPromptContext objects with all required dependencies.
 * Replaces manual context building in AgentCommunicationHandler.
 */
export class SystemPromptContextFactory {
    private projectInfo?: ProjectInfo;
    private getAllAvailableAgentsFn?: () => Promise<
        Map<string, { description: string; role: string; capabilities: string }>
    >;
    private formatAvailableAgentsForPromptFn?: (excludeAgent?: string) => Promise<string>;

    constructor(
        projectInfo?: ProjectInfo,
        dependencies?: {
            getAllAvailableAgents?: () => Promise<
                Map<string, { description: string; role: string; capabilities: string }>
            >;
            formatAvailableAgentsForPrompt?: (excludeAgent?: string) => Promise<string>;
        }
    ) {
        this.projectInfo = projectInfo;
        this.getAllAvailableAgentsFn = dependencies?.getAllAvailableAgents;
        this.formatAvailableAgentsForPromptFn = dependencies?.formatAvailableAgentsForPrompt;
    }

    /**
     * Create a complete SystemPromptContext for an agent
     */
    async createContext(agent: Agent, isAgentToAgent = false): Promise<SystemPromptContext> {
        const agentName = agent.getName();
        const agentConfig = agent.getConfig();

        // Get project rules for this agent
        const projectRules = this.getProjectRulesForAgent(agentName);

        // Get other agents information
        const otherAgents = await this.buildOtherAgentsList(agentName);

        // Get additional rules (formatted agent info + project rules)
        const additionalRules = await this.buildAdditionalRules(agentName);

        // Get available tools for this agent
        const availableTools = agent.getAvailableTools();

        return {
            agentName,
            agentConfig,
            projectInfo: this.projectInfo,
            availableTools,
            otherAgents,
            projectRules,
            additionalRules,
            isAgentToAgent,
            specCache: this.projectInfo?.specCache,
        };
    }

    /**
     * Get project rules for a specific agent
     */
    private getProjectRulesForAgent(agentName: string): CachedRule[] {
        if (!this.projectInfo?.rulesManager || !this.projectInfo?.ruleMappings) {
            return [];
        }

        return this.projectInfo.rulesManager.getRulesForAgent(
            agentName,
            this.projectInfo.ruleMappings
        );
    }

    /**
     * Build list of other agents (excluding the current agent)
     */
    private async buildOtherAgentsList(
        agentName: string
    ): Promise<Array<{ name: string; description?: string; role?: string }>> {
        if (!this.getAllAvailableAgentsFn) {
            return [];
        }

        try {
            const allAgents = await this.getAllAvailableAgentsFn();
            return Array.from(allAgents.entries())
                .filter(([name]) => name !== agentName)
                .map(([name, info]) => ({
                    name,
                    description: info.description,
                    role: info.role,
                }));
        } catch (_error) {
            // Gracefully handle missing dependency
            return [];
        }
    }

    /**
     * Build additional rules combining project rules and agent information
     */
    private async buildAdditionalRules(agentName: string): Promise<string | undefined> {
        let agentRules: string | undefined;

        // Format project rules for this agent
        if (this.projectInfo?.rulesManager && this.projectInfo?.ruleMappings) {
            const rules = this.projectInfo.rulesManager.getRulesForAgent(
                agentName,
                this.projectInfo.ruleMappings
            );
            agentRules = this.projectInfo.rulesManager.formatRulesForPrompt(rules);
        }

        // Add available agents information to the rules
        let agentsInfo: string | undefined;
        if (this.formatAvailableAgentsForPromptFn) {
            try {
                agentsInfo = await this.formatAvailableAgentsForPromptFn(agentName);
            } catch (_error) {
                // Gracefully handle missing dependency
                agentsInfo = undefined;
            }
        }

        // Combine rules and agent info
        if (agentRules && agentsInfo) {
            return `${agentRules}${agentsInfo}`;
        }
        if (agentRules) {
            return agentRules;
        }
        if (agentsInfo) {
            return agentsInfo;
        }

        return undefined;
    }

    /**
     * Update the project info (useful for dependency injection)
     */
    updateProjectInfo(projectInfo: ProjectInfo): void {
        this.projectInfo = projectInfo;
    }

    /**
     * Update the dependency functions
     */
    updateDependencies(dependencies: {
        getAllAvailableAgents?: () => Promise<
            Map<string, { description: string; role: string; capabilities: string }>
        >;
        formatAvailableAgentsForPrompt?: (excludeAgent?: string) => Promise<string>;
    }): void {
        this.getAllAvailableAgentsFn = dependencies.getAllAvailableAgents;
        this.formatAvailableAgentsForPromptFn = dependencies.formatAvailableAgentsForPrompt;
    }
}

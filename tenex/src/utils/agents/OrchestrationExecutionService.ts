import type { ProjectRuntimeInfo } from "@/commands/run/ProjectLoader";
import type { OrchestrationCoordinator } from "@/core/orchestration/integration/OrchestrationCoordinator";
import type { StrategyExecutionResult } from "@/core/orchestration/strategies/OrchestrationStrategy";
import type { Team } from "@/core/orchestration/types";
import type { Agent } from "@/utils/agents/Agent";
import type { AgentConfigurationManager } from "@/utils/agents/AgentConfigurationManager";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";
import type { LLMConfig } from "@tenex/types/llm";

export interface OrchestrationResult {
    agents: Agent[];
    team?: Team;
}

/**
 * Service for executing orchestration strategies and coordinating agent responses
 * Handles both team-based orchestration and individual agent responses
 */
export class OrchestrationExecutionService {
    constructor(
        private orchestrationCoordinator: OrchestrationCoordinator,
        private configManager?: AgentConfigurationManager
    ) {}

    /**
     * Execute orchestration strategy based on team presence
     */
    async executeResponseStrategy(
        result: OrchestrationResult,
        event: NDKEvent,
        conversationId: string,
        llmConfig: LLMConfig,
        isTaskEvent: boolean,
        processAgentResponsesFn: (
            agents: Agent[],
            event: NDKEvent,
            ndk: any,
            conversationId: string,
            llmConfig: LLMConfig,
            isTaskEvent: boolean
        ) => Promise<void>,
        _ndk?: any
    ): Promise<void> {
        if (result.team) {
            // Use orchestration strategy for team-based responses
            await this.executeOrchestrationStrategy(
                result.team,
                event,
                this.createAgentsMap(result.agents),
                conversationId,
                llmConfig
            );
        } else {
            // Use individual responses for non-team scenarios
            await this.executeIndividualResponses(
                result.agents,
                event,
                conversationId,
                llmConfig,
                isTaskEvent,
                processAgentResponsesFn,
                _ndk
            );
        }
    }

    /**
     * Execute orchestration strategy for team-based responses
     */
    async executeOrchestrationStrategy(
        team: Team,
        event: NDKEvent,
        agents: Map<string, Agent>,
        conversationId: string,
        llmConfig: LLMConfig
    ): Promise<StrategyExecutionResult> {
        logger.info(`🏗️  Executing orchestration strategy for team: ${team.id}`);
        logger.info(`   Strategy: ${team.strategy}`);
        logger.info(`   Team lead: ${team.lead}`);
        logger.info(`   Team members: ${team.members.join(", ")}`);

        const result = await this.orchestrationCoordinator.executeTeamStrategy(team, event, agents);

        logger.info(`🎯 Orchestration strategy execution completed`);
        logger.info(`   Success: ${result.success}`);
        logger.info(`   Responses: ${result.responses.length}`);
        logger.info(`   Errors: ${result.errors.length}`);

        // TODO: Add strategy response publishing when needed

        return result;
    }

    /**
     * Execute individual agent responses (fallback for non-team scenarios)
     */
    async executeIndividualResponses(
        agents: Agent[],
        event: NDKEvent,
        conversationId: string,
        llmConfig: LLMConfig,
        isTaskEvent: boolean,
        processAgentResponsesFn: (
            agents: Agent[],
            event: NDKEvent,
            ndk: any,
            conversationId: string,
            llmConfig: LLMConfig,
            isTaskEvent: boolean
        ) => Promise<void>,
        ndk?: any
    ): Promise<void> {
        logger.info(`👤 Executing individual responses for ${agents.length} agents`);
        logger.info(`   Agents: ${agents.map((a) => a.getName()).join(", ")}`);

        await processAgentResponsesFn(agents, event, ndk, conversationId, llmConfig, isTaskEvent);
    }

    /**
     * Log information about agent determination results
     */
    logResultInfo(result: OrchestrationResult): void {
        logger.info("🎯 Agent determination result:");
        logger.info(`   Agents to respond: ${result.agents.length}`);
        logger.info(`   Agent names: ${result.agents.map((a) => a.getName()).join(", ")}`);

        if (result.team) {
            logger.info(`   Team: ${result.team.id}`);
            logger.info(`   Strategy: ${result.team.strategy}`);
            logger.info(`   Lead: ${result.team.lead}`);
        } else {
            logger.info("   No team orchestration");
        }
    }

    /**
     * Check if agents will respond to the event
     */
    checkIfAgentsWillRespond(result: OrchestrationResult): boolean {
        const willRespond = result.agents.length > 0;

        if (!willRespond) {
            logger.warn("❌ No agents will respond to this event - stopping processing");
        }

        return willRespond;
    }

    /**
     * Get LLM configuration for the event
     */
    getLLMConfigForEvent(llmName?: string): LLMConfig | undefined {
        if (!this.configManager) {
            logger.error("No configuration manager available for LLM config");
            return undefined;
        }

        const llmConfig = this.configManager.getLLMConfig(llmName);

        if (!llmConfig) {
            this.logLLMConfigError(llmName);
            return undefined;
        }

        return llmConfig;
    }

    /**
     * Create agents map from agents array
     */
    private createAgentsMap(agents: Agent[]): Map<string, Agent> {
        const agentsMap = new Map<string, Agent>();
        for (const agent of agents) {
            agentsMap.set(agent.getName(), agent);
        }
        return agentsMap;
    }

    /**
     * Log LLM configuration error
     */
    private logLLMConfigError(llmName?: string): void {
        if (!this.configManager) {
            logger.error("No configuration manager available");
            return;
        }

        logger.error("No LLM configuration available for response");
        logger.error(`Requested LLM: ${llmName || "default"}`);
        logger.error(
            `Available LLMs: ${Array.from(this.configManager.getAllLLMConfigs().keys()).join(", ")}`
        );
        logger.error(`Default LLM name: ${this.configManager.getDefaultLLMName()}`);
    }
}

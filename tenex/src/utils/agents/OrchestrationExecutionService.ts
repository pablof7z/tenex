import type { OrchestrationCoordinator } from "@/core/orchestration/integration/OrchestrationCoordinator";
import type { Team } from "@/core/orchestration/types";
import type { Agent } from "@/utils/agents/Agent";
import type { AgentConfigurationManager } from "@/utils/agents/AgentConfigurationManager";
import type { EnhancedResponsePublisher } from "@/utils/agents/EnhancedResponsePublisher";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";
import type { LLMConfig } from "@tenex/types/llm";

/**
 * Service for handling orchestration execution and response coordination
 * Extracted from AgentCommunicationHandler to reduce complexity
 */
export class OrchestrationExecutionService {
    constructor(
        private orchestrationCoordinator: OrchestrationCoordinator,
        private responsePublisher: EnhancedResponsePublisher,
        private configManager: AgentConfigurationManager
    ) {}

    /**
     * Execute orchestration strategy and publish responses
     */
    async executeOrchestrationStrategy(
        team: Team,
        event: NDKEvent,
        agents: Map<string, Agent>,
        conversationId: string,
        _llmConfig: LLMConfig
    ): Promise<void> {
        logger.info(`Using orchestration strategy ${team.strategy} for team ${team.id}`);

        // Execute the team strategy
        const strategyResult = await this.orchestrationCoordinator.executeTeamStrategy(
            team,
            event,
            agents
        );

        // Publish the responses from the strategy
        await this.responsePublisher.publishStrategyResponses(
            strategyResult,
            event,
            conversationId,
            agents
        );
    }

    /**
     * Execute individual agent responses (legacy/fallback path)
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
        ndk: any
    ): Promise<void> {
        logger.info("Using individual agent response strategy (legacy behavior)");

        // Have each agent respond individually
        await processAgentResponsesFn(agents, event, ndk, conversationId, llmConfig, isTaskEvent);
    }

    /**
     * Determine and execute the appropriate response strategy
     */
    async executeResponseStrategy(
        result: { agents: Agent[]; team?: Team },
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
        ndk: any
    ): Promise<void> {
        // Check if we should use orchestration strategy
        if (result.team && this.orchestrationCoordinator) {
            await this.executeOrchestrationStrategy(
                result.team,
                event,
                result.agents.reduce((map, agent) => {
                    map.set(agent.getName(), agent);
                    return map;
                }, new Map<string, Agent>()),
                conversationId,
                llmConfig
            );
        } else {
            await this.executeIndividualResponses(
                result.agents,
                event,
                conversationId,
                llmConfig,
                isTaskEvent,
                processAgentResponsesFn,
                ndk
            );
        }
    }

    /**
     * Log result information
     */
    logResultInfo(result: { agents: Agent[]; team?: Team }): void {
        logger.info("🎯 Agent determination result:");
        logger.info(`   Agents to respond: ${result.agents.length}`);
        logger.info(`   Agent names: ${result.agents.map((a) => a.getName()).join(", ")}`);
        logger.info(`   Team: ${result.team ? result.team.id : "none"}`);
    }

    /**
     * Check if any agents will respond
     */
    checkIfAgentsWillRespond(result: { agents: Agent[]; team?: Team }): boolean {
        if (result.agents.length === 0) {
            logger.warn("❌ No agents will respond to this event - stopping processing");
            return false;
        }
        return true;
    }

    /**
     * Get LLM configuration for the event
     */
    getLLMConfigForEvent(llmName?: string): LLMConfig | undefined {
        const llmConfig = this.configManager.getLLMConfig(llmName);
        if (!llmConfig) {
            this.logLLMConfigError(llmName);
            return undefined;
        }
        return llmConfig;
    }

    /**
     * Log LLM configuration error
     */
    private logLLMConfigError(llmName?: string): void {
        logger.error("No LLM configuration available for response");
        logger.error(`Requested LLM: ${llmName || "default"}`);
        logger.error(
            `Available LLMs: ${Array.from(this.configManager.getAllLLMConfigs().keys()).join(", ")}`
        );
        logger.error(`Default LLM name: ${this.configManager.getDefaultLLMName()}`);
    }
}

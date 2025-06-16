import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type { Agent } from "../../../utils/agents/Agent";
import { Conversation } from "../../../utils/agents/Conversation";
import type { ConversationStorage } from "../../../utils/agents/ConversationStorage";
import type { AgentLogger } from "@tenex/shared/logger";
import type { TeamOrchestrator } from "../TeamOrchestrator";
import { HierarchicalStrategy } from "../strategies/HierarchicalStrategy";
import type {
    OrchestrationStrategy,
    StrategyExecutionResult,
} from "../strategies/OrchestrationStrategy";
import { ParallelExecutionStrategy } from "../strategies/ParallelExecutionStrategy";
import { SingleResponderStrategy } from "../strategies/SingleResponderStrategy";
import { PhasedDeliveryStrategy } from "../strategies/PhasedDeliveryStrategy";
import type { EventContext, Team } from "../types";

export interface OrchestrationResult {
    teamFormed: boolean;
    team?: Team;
}

export class OrchestrationCoordinator {
    private static readonly ORCHESTRATOR_AGENT_NAME = "orchestrator";
    private strategies: Map<string, OrchestrationStrategy>;

    constructor(
        private readonly orchestrator: TeamOrchestrator,
        private readonly conversationStorage: ConversationStorage,
        private readonly logger: AgentLogger
    ) {
        if (!orchestrator) throw new Error("TeamOrchestrator is required");
        if (!conversationStorage) throw new Error("ConversationStorage is required");
        if (!logger) throw new Error("Logger is required");

        // Initialize strategies
        this.strategies = new Map();
        this.strategies.set("single_responder", new SingleResponderStrategy(logger));
        this.strategies.set("hierarchical", new HierarchicalStrategy(logger));
        this.strategies.set("parallel_execution", new ParallelExecutionStrategy(logger));
        this.strategies.set("phased_delivery", new PhasedDeliveryStrategy(logger));
    }

    async handleUserEvent(event: NDKEvent, context: EventContext): Promise<OrchestrationResult> {
        this.logger.info("🎭 ORCHESTRATION COORDINATOR - handleUserEvent called");
        this.logger.info(`   Event ID: ${event.id}`);
        this.logger.info(`   Conversation ID: ${context.conversationId}`);
        this.logger.info(`   Has P-tags: ${context.hasPTags}`);
        this.logger.info(
            `   Available agents: ${Array.from(context.availableAgents.keys()).join(", ")}`
        );
        this.logger.info(`   Project: ${context.projectContext?.title || "unknown"}`);

        // Check for existing team
        this.logger.info("🔍 Checking for existing team...");
        const existingTeam = await this.getTeamForConversation(context.conversationId);

        if (existingTeam) {
            this.logger.info(
                `♻️  Found existing team: ${existingTeam.id} with members: ${existingTeam.members.join(", ")}`
            );
            return {
                teamFormed: false,
                team: existingTeam,
            };
        }
        this.logger.info("🆕 No existing team found for conversation");

        // Don't form team if there are p-tags (explicit mentions)
        if (context.hasPTags) {
            this.logger.info("🏷️  Skipping team formation - event has explicit p-tags");
            return {
                teamFormed: false,
            };
        }

        // Form new team
        this.logger.info("🎯 Starting team formation via orchestrator...");
        this.logger.info(`   Orchestrator available: ${!!this.orchestrator}`);

        try {
            const team = await this.orchestrator.analyzeAndFormTeam(
                event,
                context.availableAgents,
                context.projectContext
            );

            this.logger.info("✅ Team formation completed successfully");
            this.logger.info(`   Team ID: ${team.id}`);
            this.logger.info(`   Strategy: ${team.strategy}`);
            this.logger.info(`   Members: ${team.members.join(", ")}`);
            this.logger.info(`   Reasoning: ${team.reasoning || "none provided"}`);

            // Save team to conversation metadata
            this.logger.info("💾 Saving team to conversation metadata...");
            await this.saveTeamToConversation(context.conversationId, team);
            this.logger.info("✅ Team metadata saved successfully");

            return {
                teamFormed: true,
                team,
            };
        } catch (error) {
            this.logger.error(`💥 Team formation failed: ${error}`);
            this.logger.error(
                `   Error type: ${error instanceof Error ? error.constructor.name : typeof error}`
            );
            if (error instanceof Error) {
                this.logger.error(`   Error message: ${error.message}`);
                this.logger.error(`   Error stack: ${error.stack}`);
            }
            throw error;
        }
    }

    async getTeamForConversation(conversationId: string): Promise<Team | undefined> {
        const conversationData = await this.conversationStorage.loadConversation(
            conversationId,
            OrchestrationCoordinator.ORCHESTRATOR_AGENT_NAME
        );

        if (!conversationData) {
            return undefined;
        }

        return conversationData.metadata?.team as Team | undefined;
    }

    private async saveTeamToConversation(conversationId: string, team: Team): Promise<void> {
        // Load or create conversation
        let conversationData = await this.conversationStorage.loadConversation(
            conversationId,
            OrchestrationCoordinator.ORCHESTRATOR_AGENT_NAME
        );

        if (!conversationData) {
            // Create new conversation for orchestrator metadata
            const conversation = new Conversation(
                conversationId,
                OrchestrationCoordinator.ORCHESTRATOR_AGENT_NAME
            );
            conversation.setMetadata("team", team);
            conversationData = conversation.toJSON();
        } else {
            // Update existing conversation
            if (!conversationData.metadata) {
                conversationData.metadata = {};
            }
            conversationData.metadata.team = team;
        }

        await this.conversationStorage.saveConversation(conversationData);
    }

    async executeTeamStrategy(
        team: Team,
        event: NDKEvent,
        agents: Map<string, Agent>
    ): Promise<StrategyExecutionResult> {
        const strategy = this.strategies.get(team.strategy);
        if (!strategy) {
            throw new Error(`Unknown strategy: ${team.strategy}`);
        }

        this.logger.info(
            `Executing ${team.strategy} strategy for team ${team.id} with ${team.members.length} members`
        );

        return strategy.execute(team, event, agents, this.conversationStorage);
    }
}

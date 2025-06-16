import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { Conversation } from "../../../utils/agents/Conversation";
import type { ConversationStorage } from "../../../utils/agents/ConversationStorage";
import type { TeamOrchestrator } from "../TeamOrchestrator";
import type { EventContext, Team } from "../types";

export interface OrchestrationResult {
    teamFormed: boolean;
    team?: Team;
}

export class OrchestrationCoordinator {
    private static readonly ORCHESTRATOR_AGENT_NAME = "orchestrator";

    constructor(
        private readonly orchestrator: TeamOrchestrator,
        private readonly conversationStorage: ConversationStorage
    ) {
        if (!orchestrator) throw new Error("TeamOrchestrator is required");
        if (!conversationStorage) throw new Error("ConversationStorage is required");
    }

    async handleUserEvent(event: NDKEvent, context: EventContext): Promise<OrchestrationResult> {
        // Check for existing team
        const existingTeam = await this.getTeamForConversation(context.conversationId);

        if (existingTeam) {
            return {
                teamFormed: false,
                team: existingTeam,
            };
        }

        // Don't form team if there are p-tags (explicit mentions)
        if (context.hasPTags) {
            return {
                teamFormed: false,
            };
        }

        // Form new team
        const team = await this.orchestrator.analyzeAndFormTeam(
            event,
            context.availableAgents,
            context.projectContext
        );

        // Save team to conversation metadata
        await this.saveTeamToConversation(context.conversationId, team);

        return {
            teamFormed: true,
            team,
        };
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
}

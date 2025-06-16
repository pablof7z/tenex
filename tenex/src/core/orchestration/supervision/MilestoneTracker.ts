import type { Milestone, MilestoneStatus } from "@/core/orchestration/supervision/types";
import type { ConversationStorage } from "@/utils/agents/ConversationStorage";
import type { AgentLogger } from "@tenex/shared/logger";

export interface IMilestoneTracker {
    recordMilestone(milestone: Milestone): Promise<void>;
    getMilestones(taskId: string): Promise<Milestone[]>;
    getActiveMilestones(): Promise<Milestone[]>;
    updateMilestoneStatus(milestoneId: string, status: MilestoneStatus): Promise<void>;
}

export class MilestoneTracker implements IMilestoneTracker {
    constructor(
        private readonly logger: Logger,
        private readonly conversationStorage: ConversationStorage
    ) {
        if (!logger) throw new Error("Logger is required");
        if (!conversationStorage) throw new Error("ConversationStorage is required");
    }

    async recordMilestone(milestone: Milestone): Promise<void> {
        this.logger.debug(`Recording milestone ${milestone.id} for task ${milestone.taskId}`);

        // Get the conversation to update its metadata
        const conversation = await this.conversationStorage.getConversation(
            milestone.conversationId
        );
        if (!conversation) {
            throw new Error(`Conversation ${milestone.conversationId} not found`);
        }

        const metadata = conversation.metadata || {};
        const milestones = metadata.milestones || [];

        // Add the new milestone
        milestones.push(milestone);

        // Update conversation metadata
        await this.conversationStorage.updateConversationMetadata(milestone.conversationId, {
            milestones,
        });

        this.logger.info(
            `Recorded milestone ${milestone.id} for agent ${milestone.agentName} in task ${milestone.taskId}`
        );
    }

    async getMilestones(taskId: string): Promise<Milestone[]> {
        this.logger.debug(`Retrieving milestones for task ${taskId}`);

        const conversations = await this.conversationStorage.getAllConversations();
        const milestones: Milestone[] = [];

        for (const conversation of conversations) {
            const conversationMilestones = conversation.metadata?.milestones || [];
            const taskMilestones = conversationMilestones.filter(
                (m: Milestone) => m.taskId === taskId
            );
            milestones.push(...taskMilestones);
        }

        this.logger.debug(`Found ${milestones.length} milestones for task ${taskId}`);
        return milestones;
    }

    async getActiveMilestones(): Promise<Milestone[]> {
        this.logger.debug("Retrieving active milestones");

        const conversations = await this.conversationStorage.getAllConversations();
        const activeMilestones: Milestone[] = [];

        for (const conversation of conversations) {
            const conversationMilestones = conversation.metadata?.milestones || [];
            const active = conversationMilestones.filter(
                (m: Milestone) => m.status === "pending" || m.status === "in_progress"
            );
            activeMilestones.push(...active);
        }

        this.logger.debug(`Found ${activeMilestones.length} active milestones`);
        return activeMilestones;
    }

    async updateMilestoneStatus(milestoneId: string, status: MilestoneStatus): Promise<void> {
        this.logger.debug(`Updating milestone ${milestoneId} status to ${status}`);

        // Find the milestone across all conversations
        const conversations = await this.conversationStorage.getAllConversations();
        let foundConversationId: string | null = null;
        let foundMilestone: Milestone | null = null;
        let conversationMilestones: Milestone[] = [];

        for (const conversation of conversations) {
            const milestones = conversation.metadata?.milestones || [];
            const milestoneIndex = milestones.findIndex((m: Milestone) => m.id === milestoneId);

            if (milestoneIndex !== -1) {
                foundConversationId = conversation.id;
                foundMilestone = milestones[milestoneIndex];
                conversationMilestones = [...milestones];
                break;
            }
        }

        if (!foundConversationId || !foundMilestone) {
            throw new Error(`Milestone ${milestoneId} not found`);
        }

        this.logger.info(
            `Updating milestone ${milestoneId} status from ${foundMilestone.status} to ${status}`
        );

        // Update the milestone
        const updatedMilestone: Milestone = {
            ...foundMilestone,
            status,
            completedAt: status === "completed" ? Date.now() : undefined,
        };

        // Replace the milestone in the array
        const milestoneIndex = conversationMilestones.findIndex((m) => m.id === milestoneId);
        conversationMilestones[milestoneIndex] = updatedMilestone;

        // Update conversation metadata
        await this.conversationStorage.updateConversationMetadata(foundConversationId, {
            milestones: conversationMilestones,
        });

        this.logger.debug(`Milestone ${milestoneId} status updated successfully`);
    }
}

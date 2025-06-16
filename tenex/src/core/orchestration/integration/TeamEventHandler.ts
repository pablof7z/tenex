import type { Team } from "@/core/orchestration/types";
import type NDK from "@nostr-dev-kit/ndk";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import type { AgentLogger } from "@tenex/shared/logger";
import { EVENT_KINDS } from "@tenex/types/events";

export interface TeamEventHandler {
    publishTeamFormationEvent(
        team: Team,
        originalEvent: NDKEvent,
        ndk: NDK,
        projectNaddr?: string
    ): Promise<void>;

    publishTeamUpdateEvent(
        team: Team,
        updateType: "member_added" | "member_removed" | "strategy_changed" | "task_updated",
        details: string,
        ndk: NDK,
        projectNaddr?: string
    ): Promise<void>;

    publishTeamDisbandedEvent(
        team: Team,
        reason: string,
        ndk: NDK,
        projectNaddr?: string
    ): Promise<void>;
}

export class TeamEventHandlerImpl implements TeamEventHandler {
    private static readonly TEAM_FORMATION_KIND = 30040; // Custom kind for team formation
    private static readonly TEAM_UPDATE_KIND = 30041; // Custom kind for team updates
    private static readonly TEAM_DISBANDED_KIND = 30042; // Custom kind for team disbanding

    constructor(private readonly logger: AgentLogger) {
        if (!logger) throw new Error("Logger is required");
    }

    async publishTeamFormationEvent(
        team: Team,
        originalEvent: NDKEvent,
        ndk: NDK,
        projectNaddr?: string
    ): Promise<void> {
        try {
            const event = new NDKEvent(ndk);
            event.kind = TeamEventHandlerImpl.TEAM_FORMATION_KIND;

            // Create team formation message
            const content = {
                teamId: team.id,
                strategy: team.strategy,
                lead: team.lead,
                members: team.members,
                taskDescription: team.taskDefinition?.description,
                reasoning: team.formation.reasoning,
                estimatedComplexity: team.taskDefinition?.estimatedComplexity,
                formationTimestamp: team.formation.timestamp,
            };

            event.content = JSON.stringify(content);

            // Add tags
            event.tags = [
                ["d", team.id], // Make it replaceable
                ["e", originalEvent.id], // Reference to triggering event
                ["team-id", team.id],
                ["strategy", team.strategy],
                ["lead", team.lead],
                ...team.members.map((member) => ["member", member]),
            ];

            // Add project reference if available
            if (projectNaddr) {
                event.tags.push(["a", projectNaddr]);
            }

            await event.publish();

            this.logger.info(
                `Published team formation event for team ${team.id} with strategy ${team.strategy}`
            );
        } catch (error) {
            this.logger.error(`Failed to publish team formation event: ${error}`);
            throw error;
        }
    }

    async publishTeamUpdateEvent(
        team: Team,
        updateType: "member_added" | "member_removed" | "strategy_changed" | "task_updated",
        details: string,
        ndk: NDK,
        projectNaddr?: string
    ): Promise<void> {
        try {
            const event = new NDKEvent(ndk);
            event.kind = TeamEventHandlerImpl.TEAM_UPDATE_KIND;

            const content = {
                teamId: team.id,
                updateType,
                details,
                currentMembers: team.members,
                currentStrategy: team.strategy,
                timestamp: Date.now(),
            };

            event.content = JSON.stringify(content);

            // Add tags
            event.tags = [
                ["e", team.conversationId], // Reference to conversation
                ["team-id", team.id],
                ["update-type", updateType],
                ...team.members.map((member) => ["member", member]),
            ];

            // Add project reference if available
            if (projectNaddr) {
                event.tags.push(["a", projectNaddr]);
            }

            await event.publish();

            this.logger.info(`Published team update event for team ${team.id}: ${updateType}`);
        } catch (error) {
            this.logger.error(`Failed to publish team update event: ${error}`);
            throw error;
        }
    }

    async publishTeamDisbandedEvent(
        team: Team,
        reason: string,
        ndk: NDK,
        projectNaddr?: string
    ): Promise<void> {
        try {
            const event = new NDKEvent(ndk);
            event.kind = TeamEventHandlerImpl.TEAM_DISBANDED_KIND;

            const content = {
                teamId: team.id,
                reason,
                formedAt: team.formation.timestamp,
                disbandedAt: Date.now(),
                totalDuration: Date.now() - team.formation.timestamp,
                finalMembers: team.members,
                completedTasks: team.taskDefinition ? 1 : 0,
            };

            event.content = JSON.stringify(content);

            // Add tags
            event.tags = [
                ["d", team.id], // Make it replaceable
                ["e", team.conversationId], // Reference to conversation
                ["team-id", team.id],
                ["reason", reason],
            ];

            // Add project reference if available
            if (projectNaddr) {
                event.tags.push(["a", projectNaddr]);
            }

            await event.publish();

            this.logger.info(`Published team disbanded event for team ${team.id}: ${reason}`);
        } catch (error) {
            this.logger.error(`Failed to publish team disbanded event: ${error}`);
            throw error;
        }
    }
}

import type { CorrectionDetector } from "@/core/orchestration/reflection/CorrectionDetector";
import type { LessonGenerator } from "@/core/orchestration/reflection/LessonGenerator";
import type { LessonPublisher } from "@/core/orchestration/reflection/LessonPublisher";
import type { ReflectionResult, ReflectionTrigger } from "@/core/orchestration/reflection/types";
import type { Agent } from "@/utils/agents/Agent";
import type { Conversation } from "@/utils/agents/Conversation";
import type { ConversationStorage } from "@/utils/agents/ConversationStorage";
import type NDK from "@nostr-dev-kit/ndk";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type { AgentLogger } from "@tenex/shared/logger";

export interface ReflectionSystem {
    checkForReflection(
        event: NDKEvent,
        conversation: Conversation
    ): Promise<ReflectionTrigger | null>;

    orchestrateReflection(
        trigger: ReflectionTrigger,
        agents: Map<string, Agent>,
        ndk: NDK
    ): Promise<ReflectionResult>;
}

export class ReflectionSystemImpl implements ReflectionSystem {
    constructor(
        private readonly detector: CorrectionDetector,
        private readonly lessonGenerator: LessonGenerator,
        private readonly lessonPublisher: LessonPublisher,
        private readonly conversationStorage: ConversationStorage,
        private readonly logger: AgentLogger
    ) {
        if (!detector) throw new Error("CorrectionDetector is required");
        if (!lessonGenerator) throw new Error("LessonGenerator is required");
        if (!lessonPublisher) throw new Error("LessonPublisher is required");
        if (!conversationStorage) throw new Error("ConversationStorage is required");
        if (!logger) throw new Error("Logger is required");
    }

    async checkForReflection(
        event: NDKEvent,
        conversation: Conversation
    ): Promise<ReflectionTrigger | null> {
        const correctionAnalysis = await this.detector.isCorrection(event, conversation);

        if (!correctionAnalysis) {
            return null;
        }

        const team = conversation.getMetadata("team");

        return {
            type: "correction",
            taskId: event.id,
            conversationId: conversation.getId(),
            reason: correctionAnalysis.reason || "Correction detected",
            metadata: {
                event,
                team,
                detectedIssues: correctionAnalysis.issues,
            },
        };
    }

    async orchestrateReflection(
        trigger: ReflectionTrigger,
        agents: Map<string, Agent>,
        ndk: NDK
    ): Promise<ReflectionResult> {
        const startTime = Date.now();

        // Determine which agents should reflect
        const agentsToReflect = await this.selectAgentsForReflection(trigger, agents);

        if (agentsToReflect.length === 0) {
            this.logger.warning("No agents selected for reflection");
            return {
                lessonsGenerated: [],
                lessonsPublished: [],
                reflectionDuration: Date.now() - startTime,
            };
        }

        // Generate lessons for each agent
        this.logger.info(
            `Generating lessons for ${agentsToReflect.length} agents based on correction`
        );

        const lessons = await this.lessonGenerator.generateLessons(trigger, agentsToReflect);

        if (lessons.length === 0) {
            this.logger.info("No lessons generated from reflection");
            return {
                lessonsGenerated: [],
                lessonsPublished: [],
                reflectionDuration: Date.now() - startTime,
            };
        }

        // Deduplicate lessons
        const uniqueLessons = await this.lessonGenerator.deduplicateLessons(lessons);

        this.logger.info(
            `Generated ${uniqueLessons.length} unique lessons from ${lessons.length} total`
        );

        // Publish lessons to Nostr
        const publishedEventIds = await this.lessonPublisher.publishLessons(uniqueLessons, ndk);

        // Store reflection metadata in conversation
        // Store reflection metadata in conversation
        // For now, we'll skip loading conversation from storage
        // TODO: Implement proper conversation loading for reflection
        const conversation = null;
        if (conversation) {
            await this.storeReflectionMetadata(conversation, {
                reflectionTriggerId: (trigger.metadata?.eventId as string) || "",
                lessonsGenerated: uniqueLessons.length,
                lessonsPublished: publishedEventIds.length,
                timestamp: Date.now(),
            });
        }

        return {
            lessonsGenerated: uniqueLessons,
            lessonsPublished: uniqueLessons.filter((_, index) => index < publishedEventIds.length),
            reflectionDuration: Date.now() - startTime,
        };
    }

    private async selectAgentsForReflection(
        trigger: ReflectionTrigger,
        agents: Map<string, Agent>
    ): Promise<Agent[]> {
        const selectedAgents: Agent[] = [];

        // Get conversation to check participants
        // For now, we'll skip loading conversation from storage
        // TODO: Implement proper conversation loading for reflection
        const conversation = null;
        if (!conversation) {
            return selectedAgents;
        }

        // Check metadata for team info
        const teamId = trigger.metadata?.teamId as string;
        if (teamId) {
            // Add all agents that might be part of the team
            for (const [_, agent] of agents) {
                selectedAgents.push(agent);
            }
        } else {
            // No team - reflect based on conversation participants
            const participants = conversation.getParticipants();

            for (const [agentName, agent] of agents) {
                if (participants.includes(agentName)) {
                    selectedAgents.push(agent);
                }
            }
        }

        return selectedAgents;
    }

    private async storeReflectionMetadata(
        conversation: Conversation,
        metadata: {
            reflectionTriggerId: string;
            lessonsGenerated: number;
            lessonsPublished: number;
            timestamp: number;
        }
    ): Promise<void> {
        // Get existing reflections or initialize
        const existingReflections = (conversation.getMetadata("reflections") || []) as any[];

        // Add new reflection
        existingReflections.push(metadata);

        // Keep only last 10 reflections
        const recentReflections = existingReflections.slice(-10);

        // Update conversation metadata
        conversation.setMetadata("reflections", recentReflections);

        // Save conversation
        await this.conversationStorage.saveConversation(conversation.toJSON());
    }
}

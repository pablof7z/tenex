import type { AgentLesson } from "@/core/orchestration/reflection/types";
import type NDK from "@nostr-dev-kit/ndk";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import type { AgentLogger } from "@tenex/shared/logger";

export interface LessonPublisher {
    publishLessons(lessons: AgentLesson[], ndk: NDK): Promise<string[]>;
}

export class LessonPublisherImpl implements LessonPublisher {
    private static readonly LESSON_KIND = 4124; // Agent lesson event kind

    constructor(private readonly logger: AgentLogger) {
        if (!logger) throw new Error("Logger is required");
    }

    async publishLessons(lessons: AgentLesson[], ndk: NDK): Promise<string[]> {
        if (!ndk) throw new Error("NDK instance is required");
        if (!lessons || lessons.length === 0) {
            return [];
        }

        const publishedEventIds: string[] = [];

        // Publish each lesson as a separate event
        const publishPromises = lessons.map(async (lesson) => {
            try {
                const eventId = await this.publishLesson(lesson, ndk);
                if (eventId) {
                    return eventId;
                }
            } catch (error) {
                this.logger.error(
                    `Failed to publish lesson for agent ${lesson.agentName}: ${error}`
                );
            }
            return null;
        });

        const results = await Promise.all(publishPromises);

        // Filter out null results
        for (const eventId of results) {
            if (eventId) {
                publishedEventIds.push(eventId);
            }
        }

        this.logger.info(
            `Published ${publishedEventIds.length} of ${lessons.length} lessons to Nostr`
        );

        return publishedEventIds;
    }

    private async publishLesson(lesson: AgentLesson, ndk: NDK): Promise<string | null> {
        try {
            const event = new NDKEvent(ndk);
            event.kind = LessonPublisherImpl.LESSON_KIND;
            event.content = lesson.content;

            // Add required tags
            event.tags = [
                ["e", (lesson as any).ndkAgentEventId || lesson.agentId], // Reference to the NDKAgent event
                ["title", this.truncateLesson(lesson.content, 50)], // Short title
            ];

            // Add optional context tags
            const lessonAny = lesson as any;
            if (lessonAny.context?.errorType) {
                event.tags.push(["error-type", lessonAny.context.errorType]);
            }

            if (lessonAny.context?.preventionStrategy) {
                event.tags.push(["prevention", lessonAny.context.preventionStrategy]);
            }

            if (lessonAny.context?.relatedCapabilities?.length > 0) {
                event.tags.push(["capabilities", lessonAny.context.relatedCapabilities.join(",")]);
            }

            // Add metadata tags
            event.tags.push(
                ["confidence", (lessonAny.confidence || 0.5).toString()],
                ["agent-name", lesson.agentName],
                ["conversation-id", lessonAny.context?.conversationId || ""],
                ["trigger-event", lessonAny.context?.triggerEventId || ""]
            );

            if (lesson.context.teamId) {
                event.tags.push(["team-id", lesson.context.teamId]);
            }

            // Publish the event
            await event.publish();

            this.logger.info(
                `Published lesson for agent ${lesson.agentName}: "${this.truncateLesson(
                    lesson.lesson,
                    30
                )}..."`
            );

            return event.id;
        } catch (error) {
            this.logger.error(`Error creating lesson event: ${error}`);
            return null;
        }
    }

    private truncateLesson(lesson: string, maxLength: number): string {
        if (lesson.length <= maxLength) {
            return lesson;
        }
        return `${lesson.substring(0, maxLength)}...`;
    }
}

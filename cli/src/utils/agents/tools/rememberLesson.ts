import { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";
import type { ToolContext, ToolDefinition } from "./types";

export const rememberLessonTool: ToolDefinition = {
    name: "remember_lesson",
    description:
        "Record a lesson learned from a mistake or wrong assumption. Use this when you realize something you were mistaken about.",
    parameters: [
        {
            name: "title",
            type: "string",
            description: "A short title summarizing the lesson learned",
            required: true,
        },
        {
            name: "lesson",
            type: "string",
            description:
                "A bite-sized lesson that encapsulates what you learned from the mistake or wrong assumption",
            required: true,
        },
    ],
    execute: async (params, context?: ToolContext) => {
        try {
            if (!context) {
                return {
                    success: false,
                    output: "",
                    error: "Missing required context for remember_lesson tool",
                };
            }

            if (!context.agent || !context.agentEventId) {
                return {
                    success: false,
                    output: "",
                    error: "Missing agent or agentEventId in context for remember_lesson tool",
                };
            }

            const { ndk, agent, agentEventId } = context;

            // Create the lesson event
            const lessonEvent = new NDKEvent(ndk);
            lessonEvent.kind = 4124;
            lessonEvent.content = params.lesson;

            // Add tags
            lessonEvent.tags.push(["e", agentEventId]); // e-tag the NDKAgent event
            lessonEvent.tags.push(["title", params.title]);

            // Sign and publish
            await lessonEvent.sign(agent.getSigner());
            await lessonEvent.publish();

            logger.info(`Agent '${context.agentName}' recorded lesson: ${params.title}`);

            return {
                success: true,
                output: `Lesson recorded successfully: "${params.title}"`,
            };
        } catch (error) {
            logger.error(`Failed to record lesson: ${error}`);
            return {
                success: false,
                output: "",
                error: error instanceof Error ? error.message : "Failed to record lesson",
            };
        }
    },
};

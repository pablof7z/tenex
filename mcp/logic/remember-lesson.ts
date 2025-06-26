import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { NDKAgentLesson } from "../../tenex/src/events/NDKAgentLesson.js";
import { getConfig } from "../config.js";
import { getNDK } from "../ndk.js";
import { log } from "../utils/log.js";

export function addRememberLessonCommand(server: McpServer): void {
    server.addTool({
        name: "remember_lesson",
        description:
            "Record a lesson learned from a mistake or wrong assumption. Use this when you realize something you were mistaken about.",
        inputSchema: {
            type: "object",
            properties: {
                title: {
                    type: "string",
                    description: "A short title summarizing the lesson learned",
                },
                lesson: {
                    type: "string",
                    description:
                        "A bite-sized lesson that encapsulates what you learned from the mistake or wrong assumption",
                },
            },
            required: ["title", "lesson"],
        },
        handler: async ({ title, lesson }) => {
            try {
                const config = await getConfig();

                if (!config.agentEventId) {
                    return {
                        success: false,
                        error: "remember_lesson tool requires AGENT_EVENT_ID to be set",
                    };
                }

                const ndk = await getNDK();

                // Create the lesson event
                const lessonEvent = new NDKAgentLesson(ndk);
                lessonEvent.lesson = lesson;
                lessonEvent.title = title;

                // Add e-tag to reference the agent event
                lessonEvent.tags.push(["e", config.agentEventId]);

                // Sign and publish
                await lessonEvent.sign();
                await lessonEvent.publish();

                log(`Agent '${config.agentName || "unknown"}' recorded lesson: ${title}`);

                return {
                    success: true,
                    content: [
                        {
                            type: "text",
                            text: `Lesson recorded successfully: "${title}"`,
                        },
                    ],
                };
            } catch (error) {
                log(`ERROR: Failed to record lesson: ${error}`);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Failed to record lesson",
                };
            }
        },
    });
}

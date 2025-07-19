import { NDKAgentLesson } from "@/events/NDKAgentLesson";
import { getNDK } from "@/nostr";
import { getProjectContext } from "@/services/ProjectContext";
import { logger } from "@/utils/logger";
import { getTotalExecutionTimeSeconds } from "@/conversations/executionTime";
import { EXECUTION_TAGS } from "@/nostr/tags";
import { z } from "zod";
import type { Tool } from "../types";
import { createZodSchema } from "../types";

const learnSchema = z.object({
    title: z.string().describe("Brief title/description of what this lesson is about"),
    lesson: z.string().describe("The key insight or lesson learned - be concise and actionable"),
});

interface LearnInput {
    title: string;
    lesson: string;
}

interface LearnOutput {
    message: string;
    eventId: string;
    title: string;
}

export const learnTool: Tool<LearnInput, LearnOutput> = {
    name: "learn",
    description:
        "Record an important lesson learned during execution that should be carried forward",

    promptFragment: `When you encounter important insights or lessons during your work, use the learn tool to record them. These lessons will be available in future conversations to help avoid similar issues.

Domain Boundaries: Only record lessons within your role's sphere of control and expertise. You have access to the list of agents working with you in this project; while pondering whether to record a lesson, think: "is this specific lesson better suited for the domain expertise of another agent?"

In <thinking> tags, reason why you are the right agent to record this lesson and why this lesson is important and specific enough.`,

    parameters: createZodSchema(learnSchema),

    execute: async (input, context) => {
        const { title, lesson } = input.value;

        logger.info("🎓 Agent recording new lesson", {
            agent: context.agent.name,
            agentPubkey: context.agent.pubkey,
            title,
            lessonLength: lesson.length,
            phase: context.phase,
            conversationId: context.conversationId,
        });

        const agentSigner = context.agent.signer;
        const ndk = getNDK();
        const projectCtx = getProjectContext();

        try {
            // Create the lesson event
            const lessonEvent = new NDKAgentLesson(ndk);
            lessonEvent.title = title;
            lessonEvent.lesson = lesson;

            // Add reference to the agent event if available
            const agentEventId = context.agent.eventId;
            if (agentEventId) {
                const agentEvent = await ndk.fetchEvent(agentEventId);

                if (agentEvent) {
                    lessonEvent.agent = agentEvent;
                } else {
                    logger.warn("Could not fetch agent event for lesson", {
                        agentEventId,
                    });
                }
            }

            // Add project tag for scoping
            lessonEvent.tag(projectCtx.project);

            // Sign and publish the event
            await lessonEvent.sign(agentSigner);
            await lessonEvent.publish();

            const message = `✅ Lesson recorded: "${title}"\n\nThis lesson will be available in future conversations to help avoid similar issues.`;

            return {
                ok: true,
                value: {
                    message,
                    eventId: lessonEvent.encode(),
                    title,
                },
            };
        } catch (error) {
            logger.error("❌ Learn tool failed", {
                error: error instanceof Error ? error.message : String(error),
                agent: context.agent.name,
                agentPubkey: context.agent.pubkey,
                title,
                phase: context.phase,
                conversationId: context.conversationId,
            });

            return {
                ok: false,
                error: {
                    kind: "execution" as const,
                    tool: "learn",
                    message: error instanceof Error ? error.message : String(error),
                },
            };
        }
    },
};

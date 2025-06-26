import type { Tool, ToolExecutionContext, ToolResult } from "../types";
import { z } from "zod";
import { logger } from "@/utils/logger";
import { NDKAgentLesson } from "@/events/NDKAgentLesson";
import { getNDK } from "@/nostr";
import { getProjectContext } from "@/services/ProjectContext";
import { EXECUTION_TAGS } from "@/nostr/tags";
import { getTotalExecutionTimeSeconds } from "@/conversations/executionTime";

const learnSchema = z.object({
    title: z.string().describe("Brief title/description of what this lesson is about"),
    lesson: z.string().describe("The key insight or lesson learned - be concise and actionable"),
    keywords: z.array(z.string()).optional().describe("Keywords to help retrieve this lesson later (e.g., 'typescript', 'git', 'async')"),
});

export const learnTool: Tool = {
    name: "learn",
    description: "Record an important lesson learned during execution that should be carried forward",
    parameters: [
        {
            name: "title",
            type: "string",
            description: "Brief title/description of what this lesson is about (e.g., 'Async iteration in TypeScript', 'Git rebase workflow')",
            required: true,
        },
        {
            name: "lesson",
            type: "string",
            description: "The key insight or lesson learned. Include: what went wrong (if applicable), the key insight that fixed it, and the correct approach. Keep it concise (max 3-5 sentences).",
            required: true,
        },
        {
            name: "keywords",
            type: "array",
            description: "Keywords to help retrieve this lesson later (e.g., ['typescript', 'async', 'promises'] or ['git', 'rebase', 'conflict'])",
            required: false,
            items: {
                name: "keyword",
                type: "string",
                description: "A keyword related to this lesson",
            },
        },
    ],

    async execute(
        params: Record<string, unknown>,
        context: ToolExecutionContext
    ): Promise<ToolResult> {
        try {
            const parsed = learnSchema.parse(params);
            const { title, lesson, keywords } = parsed;

            logger.info("🎓 Agent recording new lesson", {
                agent: context.agentName,
                agentPubkey: context.agent.pubkey,
                title,
                lessonLength: lesson.length,
                keywordCount: keywords?.length || 0,
                keywords: keywords?.join(", ") || "none",
                phase: context.phase,
                conversationId: context.conversationId,
            });

            // Check if agent signer is available
            if (!context.agentSigner) {
                logger.warn("Agent signer not available, cannot publish lesson", {
                    agent: context.agentName,
                });
                return {
                    success: false,
                    error: "Agent signer not available for publishing lesson",
                };
            }

            // Get NDK instance
            const ndk = getNDK();
            if (!ndk) {
                logger.error("NDK instance not available", {
                    agent: context.agentName,
                });
                return {
                    success: false,
                    error: "NDK instance not available",
                };
            }

            // Get project context
            const projectCtx = getProjectContext();

            // Create the lesson event
            const lessonEvent = new NDKAgentLesson(ndk);
            lessonEvent.title = title;
            lessonEvent.lesson = lesson;

            // Add reference to the agent event if available
            if (context.agent.eventId) {
                lessonEvent.agent = { id: context.agent.eventId } as any;
            }

            // Add project tag for scoping
            lessonEvent.tag(projectCtx.project);

            // Add phase tag
            lessonEvent.tags.push(["phase", context.phase]);

            // Add keyword tags if provided
            if (keywords && Array.isArray(keywords)) {
                keywords.forEach(keyword => {
                    if (keyword.trim()) {
                        lessonEvent.tags.push(["t", keyword.trim().toLowerCase()]);
                    }
                });
            }

            // Add execution time tag if conversation available
            if (context.conversation) {
                const totalSeconds = getTotalExecutionTimeSeconds(context.conversation);
                lessonEvent.tags.push([EXECUTION_TAGS.NET_TIME, totalSeconds.toString()]);
            }

            // Sign and publish the event
            await lessonEvent.sign(context.agentSigner);
            await lessonEvent.publish();

            logger.info("✅ Successfully published agent lesson", {
                agent: context.agentName,
                agentPubkey: context.agent.pubkey,
                eventId: lessonEvent.id,
                title,
                keywords: keywords?.length || 0,
                phase: context.phase,
                projectId: projectCtx.project.tagId(),
                totalLessonsForAgent: projectCtx.getLessonsForAgent(context.agent.pubkey).length,
                totalLessonsInProject: projectCtx.getAllLessons().length,
            });

            return {
                success: true,
                output: `✅ Lesson recorded: "${title}"\n\nThis lesson will be available in future conversations to help avoid similar issues.`,
                metadata: {
                    eventId: lessonEvent.id,
                    title,
                    lessonLength: lesson.length,
                },
            };
        } catch (error) {
            logger.error("❌ Learn tool failed", { 
                error: error instanceof Error ? error.message : String(error),
                agent: context.agentName,
                agentPubkey: context.agent.pubkey,
                title,
                phase: context.phase,
                conversationId: context.conversationId,
            });
            return {
                success: false,
                output: "",
                error: error instanceof Error ? error.message : String(error),
            };
        }
    },
};
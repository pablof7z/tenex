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
  keywords: z
    .array(z.string())
    .optional()
    .describe("Keywords to help retrieve this lesson later (e.g., 'typescript', 'git', 'async')"),
});

interface LearnInput {
  title: string;
  lesson: string;
  keywords?: string[];
}

interface LearnOutput {
  message: string;
  eventId: string;
  title: string;
  lessonLength: number;
}

export const learnTool: Tool<LearnInput, LearnOutput> = {
  name: "learn",
  description: "Record an important lesson learned during execution that should be carried forward",

  parameters: createZodSchema(learnSchema),

  execute: async (input, context) => {
      const { title, lesson, keywords } = input.value;

      logger.info("🎓 Agent recording new lesson", {
        agent: context.agent.name,
        agentPubkey: context.agent.pubkey,
        title,
        lessonLength: lesson.length,
        keywordCount: keywords?.length || 0,
        keywords: keywords?.join(", ") || "none",
        phase: context.phase,
        conversationId: context.conversationId,
      });

      // Check if agent signer is available
      const agentSigner = context.agent.signer;
      if (!agentSigner) {
        logger.warn("Agent signer not available, cannot publish lesson", {
          agent: context.agent.name,
        });
        return {
          ok: false,
          error: {
            kind: "execution" as const,
            tool: "learn",
            message: "Agent signer not available for publishing lesson",
          },
        };
      }

      // Get NDK instance
      const ndk = getNDK();
      if (!ndk) {
        logger.error("NDK instance not available", {
          agent: context.agent.name,
        });
        return {
          ok: false,
          error: {
            kind: "execution" as const,
            tool: "learn",
            message: "NDK instance not available",
          },
        };
      }

      // Get project context
      const projectCtx = getProjectContext();

      try {
        // Create the lesson event
        const lessonEvent = new NDKAgentLesson(ndk);
        lessonEvent.title = title;
        lessonEvent.lesson = lesson;

        // Add reference to the agent event if available
        const agentEventId = context.agent.eventId;
        if (agentEventId) {
          // Fetch the actual NDKAgent event
          const agentEventFilter = {
            ids: [agentEventId],
            kinds: [4199], // NDKAgent kind
          };

          const agentEvent = await ndk.fetchEvent(agentEventFilter, {
            closeOnEose: true,
            groupable: false,
          });

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

        // Add phase tag
        lessonEvent.tags.push(["phase", context.phase]);

        // Add keyword tags if provided
        if (keywords && Array.isArray(keywords)) {
          for (const keyword of keywords) {
            if (keyword.trim()) {
              lessonEvent.tags.push(["t", keyword.trim().toLowerCase()]);
            }
          }
        }

        // Add execution time tag
        const totalSeconds = getTotalExecutionTimeSeconds(context.conversation);
        lessonEvent.tags.push([EXECUTION_TAGS.NET_TIME, totalSeconds.toString()]);

        // Sign and publish the event
        await lessonEvent.sign(agentSigner);
        await lessonEvent.publish();

        logger.info("✅ Successfully published agent lesson", {
          agent: context.agent.name,
          agentPubkey: context.agent.pubkey,
          eventId: lessonEvent.id,
          title,
          keywords: keywords?.length || 0,
          phase: context.phase,
          projectId: projectCtx.project.tagId(),
          totalLessonsForAgent: projectCtx.getLessonsForAgent(context.agent.pubkey).length,
          totalLessonsInProject: projectCtx.getAllLessons().length,
        });

        const message = `✅ Lesson recorded: "${title}"\n\nThis lesson will be available in future conversations to help avoid similar issues.`;

        return {
          ok: true,
          value: {
            message,
            eventId: lessonEvent.id,
            title,
            lessonLength: lesson.length,
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

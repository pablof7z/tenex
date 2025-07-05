import type { Agent } from "@/agents/types";
import type { Phase } from "@/conversations/phases";
import type { Conversation } from "@/conversations/types";
import type { NDKAgentLesson } from "@/events/NDKAgentLesson";
import { logger } from "@/utils/logger";
import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";

// Retrieved lessons fragment - filters and formats relevant lessons from memory
interface RetrievedLessonsArgs {
  agent: Agent;
  phase: Phase;
  conversation: Conversation;
  agentLessons: Map<string, NDKAgentLesson[]>;
}

export const retrievedLessonsFragment: PromptFragment<RetrievedLessonsArgs> = {
  id: "retrieved-lessons",
  priority: 24, // Before learn-tool-directive
  template: ({ agent, phase, agentLessons, conversation }) => {
    const allLessons: NDKAgentLesson[] = Array.from(agentLessons.values()).flat();

    if (allLessons.length === 0) {
      logger.debug("📚 No lessons available for retrieval", {
        agent: agent.name,
        phase,
      });
      return ""; // No lessons learned yet
    }

    // Separate lessons by source
    const myLessons = (agentLessons.get(agent.pubkey) || []).sort(
      (a, b) => (b.created_at ?? 0) - (a.created_at ?? 0)
    );

    const otherLessons = allLessons
      .filter((l) => l.pubkey !== agent.pubkey)
      .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));

    // Log lesson availability
    logger.debug("📚 Lesson retrieval context", {
      agent: agent.name,
      phase,
      conversationId: conversation.id,
      totalLessons: allLessons.length,
      myLessonsCount: myLessons.length,
      otherLessonsCount: otherLessons.length,
    });

    // Select top lessons to show
    const lessonsToShow = [
      ...myLessons.slice(0, 3), // Top 3 from self
      ...otherLessons.slice(0, 2), // Top 2 from others
    ].slice(0, 5); // Max 5 total

    if (lessonsToShow.length === 0) {
      logger.debug("📚 No relevant lessons after filtering", {
        agent: agent.name,
      });
      return "";
    }

    // Format lessons for the prompt
    const formattedLessons = lessonsToShow
      .map((lesson) => {
        const title = lesson.title || "Untitled Lesson";
        const content = lesson.lesson || lesson.content || "";
        // Use first sentence as summary to save tokens
        const summary = content.split(".")[0]?.trim() || content.substring(0, 100);
        const phase = lesson.tags.find((tag) => tag[0] === "phase")?.[1];
        const isOwnLesson = lesson.pubkey === agent.pubkey;

        return `- **${title}**${phase ? ` (${phase} phase)` : ""}${!isOwnLesson ? " [from another agent]" : ""}: ${summary}${!summary.endsWith(".") ? "." : ""}`;
      })
      .join("\n");

    // Log which lessons are being shown
    logger.info("📖 Injecting lessons into agent prompt", {
      agent: agent.name,
      agentPubkey: agent.pubkey,
      phase,
      conversationId: conversation.id,
      lessonsShown: lessonsToShow.length,
      lessonTitles: lessonsToShow.map((l) => ({
        title: l.title || "Untitled",
        fromAgent: l.pubkey === agent.pubkey ? "self" : "other",
        phase: l.tags.find((tag) => tag[0] === "phase")?.[1],
        keywords:
          l.tags
            .filter((tag) => tag[0] === "t")
            .map((tag) => tag[1])
            .join(", ") || "none",
        eventId: l.id,
      })),
    });

    return `## Key Lessons Learned

Review these lessons from past experiences to guide your actions:

${formattedLessons}

Remember to use the \`learn\` tool when you discover new insights or patterns.`;
  },
};

// Register the fragment
fragmentRegistry.register(retrievedLessonsFragment);

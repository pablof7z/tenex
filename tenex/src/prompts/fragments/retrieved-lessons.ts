import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";
import type { Agent } from "@/agents/types";
import type { Phase } from "@/conversations/phases";
import type { Conversation } from "@/conversations/types";

// Retrieved lessons fragment - provides guidance about using learned lessons
interface RetrievedLessonsArgs {
    agent: Agent;
    phase: Phase;
    conversation: Conversation;
}

export const retrievedLessonsFragment: PromptFragment<RetrievedLessonsArgs> = {
    id: "retrieved-lessons",
    priority: 25, // After phase context but before tool directives
    template: ({ agent, phase, conversation }) => {
        // Note: Prompt fragments must be synchronous in the current architecture
        // For now, we'll provide instructions about using learned lessons
        // A future enhancement would be to pre-fetch lessons before prompt building
        
        return `## Learning from Past Lessons

When you encounter challenges or decisions, remember that agents in this project may have recorded lessons from similar situations. These lessons are available through the project's knowledge base.

If you discover important insights during your work, use the \`learn\` tool to record them for future reference. Include relevant keywords to help other agents find your lessons.`;
    },
};

// Register the fragment
fragmentRegistry.register(retrievedLessonsFragment);
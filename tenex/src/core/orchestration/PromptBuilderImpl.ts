import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type { PromptBuilder } from "./PromptBuilder";
import type { ProjectContext } from "./types";

export class PromptBuilderImpl implements PromptBuilder {
    buildAnalysisPrompt(event: NDKEvent, context: ProjectContext): string {
        const hasConversationContext = event.tags.some(
            (tag) => tag[0] === "e" || tag[0] === "root"
        );

        let contextSection = "";
        if (context.title || context.repository || context.projectInfo) {
            contextSection = `
## Project Context
${context.title ? `- Project: ${context.title}` : ""}
${context.repository ? `- Repository: ${context.repository}` : ""}
${context.projectInfo?.title ? `- Description: ${context.projectInfo.title}` : ""}
`;
        }

        const conversationNote = hasConversationContext
            ? "\nNote: This appears to be part of an ongoing conversation. Consider the context of previous messages."
            : "";

        return `You are analyzing a user request to determine how to orchestrate a team of AI agents.

${contextSection}
## User Request
"${event.content}"
${conversationNote}

## Task
Analyze this request and determine:

1. **Request Type**: What kind of work is being requested? (e.g., "bug fix", "feature implementation", "question", "refactor", "exploration", etc.)

2. **Required Capabilities**: What skills or domains are needed? (e.g., "frontend", "backend", "database", "testing", "architecture", "debugging", etc.)

3. **Complexity**: On a scale of 1-10, how complex is this request?
   - 1-3: Simple, straightforward tasks
   - 4-6: Moderate complexity, some coordination needed
   - 7-9: Complex, requires significant coordination
   - 10: Extremely complex, requires extensive planning

4. **Strategy**: Which orchestration strategy would work best?
   - single_responder: One agent can handle this alone
   - hierarchical: Clear leadership needed with delegation
   - parallel_execution: Multiple agents work simultaneously
   - phased_delivery: Sequential phases (design → implement → test)
   - exploratory: Research and discovery needed first

5. **Reasoning**: Explain your analysis

## Response Format
Return your analysis as JSON:
{
  "requestType": "type of request",
  "requiredCapabilities": ["capability1", "capability2"],
  "estimatedComplexity": 5,
  "suggestedStrategy": "hierarchical",
  "reasoning": "Explanation of your analysis"
}`;
    }
}

import type { PromptBuilder } from "@/core/orchestration/PromptBuilder";
import type { AgentDefinition, ProjectContext } from "@/core/orchestration/types";
import type { NDKEvent } from "@nostr-dev-kit/ndk";

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

    buildCombinedAnalysisPrompt(
        event: NDKEvent,
        context: ProjectContext,
        availableAgents: Map<string, AgentDefinition>,
        maxTeamSize: number
    ): string {
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

        const agentList = Array.from(availableAgents.values())
            .map(
                (agent) =>
                    `- **${agent.name}**: ${agent.description}\n  Role: ${agent.role}\n  Capabilities: ${agent.instructions}`
            )
            .join("\n");

        return `You are an AI orchestration system that analyzes requests and forms teams of AI agents to handle them.

${contextSection}
## User Request
"${event.content}"
${conversationNote}

## Available Agents
${agentList}

## Task
Analyze this request and form a team to handle it. You need to:

### 1. Analyze the Request
Determine:
- **Request Type**: What kind of work is being requested? (e.g., "bug fix", "feature implementation", "question", "refactor", "exploration", etc.)
- **Required Capabilities**: What skills or domains are needed? (e.g., "frontend", "backend", "database", "testing", "architecture", "debugging", etc.)
- **Complexity**: On a scale of 1-10, how complex is this request?
  - 1-3: Simple, straightforward tasks
  - 4-6: Moderate complexity, some coordination needed
  - 7-9: Complex, requires significant coordination
  - 10: Extremely complex, requires extensive planning
- **Strategy**: Which orchestration strategy would work best?
  - single_responder: One agent can handle this alone
  - hierarchical: Clear leadership needed with delegation
  - parallel_execution: Multiple agents work simultaneously
  - phased_delivery: Sequential phases (design → implement → test)
  - exploratory: Research and discovery needed first
- **Reasoning**: Explain your analysis

### 2. Form the Team
Based on your analysis:
- Select the best team composition from available agents
- Choose a lead agent based on the primary focus
- Keep team size reasonable (max ${maxTeamSize} members)
- Ensure the lead agent is included in the members array

### 3. Define the Task
Create a clear task definition with:
- Description of what needs to be done
- Success criteria
- Whether green light approval is needed
- Estimated complexity (from your analysis)

## Response Format
Return your complete analysis and team formation as JSON:
{
  "analysis": {
    "requestType": "type of request",
    "requiredCapabilities": ["capability1", "capability2"],
    "estimatedComplexity": 5,
    "suggestedStrategy": "hierarchical",
    "reasoning": "Explanation of your analysis"
  },
  "team": {
    "lead": "agent-name",
    "members": ["agent-name", "other-agent-name"],
    "reasoning": "Why this team composition"
  },
  "taskDefinition": {
    "description": "Clear description of what needs to be done",
    "successCriteria": ["Criterion 1", "Criterion 2"],
    "requiresGreenLight": true/false,
    "estimatedComplexity": 5
  }
}

**IMPORTANT**: 
- The "lead" field should contain the name of the agent who will lead the team
- The "members" array should contain ALL team members (including the lead agent)
- If no suitable agents are available, set both "lead" to null and "members" to an empty array
- Always include the lead agent in the members array`;
    }
}

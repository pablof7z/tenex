import { COLLABORATION_GUIDELINES } from "../constants";
import type { PromptSection, PromptSectionBuilder, SystemPromptContext } from "../types";

/**
 * Builds the team information section listing other available agents
 */
export class TeamInformationBuilder implements PromptSectionBuilder {
    id = "team-information";
    name = "Team Information";
    defaultPriority = 70;

    build(context: SystemPromptContext): PromptSection | null {
        const { otherAgents, agentName } = context;

        if (!otherAgents || otherAgents.length === 0) {
            return null;
        }

        const parts: string[] = [];
        parts.push("## Available Agents in the System");
        parts.push("");
        parts.push(
            "You are part of a multi-agent system. The following agents are available and may be working on related tasks:"
        );
        parts.push("");

        for (const agent of otherAgents) {
            if (agent.name === agentName) continue; // Skip self

            let agentLine = `- **${agent.name}**`;
            if (agent.description) {
                agentLine += `: ${agent.description}`;
            }
            if (agent.role) {
                agentLine += ` (Role: ${agent.role})`;
            }
            parts.push(agentLine);
        }

        parts.push("");
        parts.push(COLLABORATION_GUIDELINES);

        return {
            id: this.id,
            name: this.name,
            priority: this.defaultPriority,
            content: parts.join("\n"),
            enabled: true,
        };
    }
}

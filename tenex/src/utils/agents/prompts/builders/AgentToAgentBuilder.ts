import { AGENT_TO_AGENT_INSTRUCTIONS } from "../constants";
import type { PromptSection, PromptSectionBuilder, SystemPromptContext } from "../types";

/**
 * Builds special instructions for agent-to-agent communication
 */
export class AgentToAgentBuilder implements PromptSectionBuilder {
    id = "agent-to-agent";
    name = "Agent-to-Agent Communication";
    defaultPriority = 95; // High priority to ensure it's prominent

    build(context: SystemPromptContext): PromptSection | null {
        if (!context.isAgentToAgent) {
            return null;
        }

        return {
            id: this.id,
            name: this.name,
            priority: this.defaultPriority,
            content: AGENT_TO_AGENT_INSTRUCTIONS,
            enabled: true,
        };
    }
}

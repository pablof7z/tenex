import type {
    PromptSection,
    PromptSectionBuilder,
    SystemPromptContext,
} from "@/utils/agents/prompts/types";

/**
 * Builds the agent identity section including name, role, description, and instructions
 */
export class AgentIdentityBuilder implements PromptSectionBuilder {
    id = "agent-identity";
    name = "Agent Identity";
    defaultPriority = 90;

    build(context: SystemPromptContext): PromptSection {
        const { agentName, agentConfig } = context;
        const parts: string[] = [];

        parts.push("## Your Identity");

        // Agent name
        parts.push(`Your name: "${agentName}"`);

        // Agent role
        if (agentConfig.role) {
            parts.push(`You are ${agentConfig.role}.`);
        } else {
            parts.push(`You are ${agentName}.`);
        }

        // Description
        if (agentConfig.description) {
            parts.push("");
            parts.push("### Description");
            parts.push(agentConfig.description);
        }

        // Instructions
        if (agentConfig.instructions) {
            parts.push("");
            parts.push("### Your Instructions");
            parts.push(agentConfig.instructions);
        }

        // Capabilities summary
        const configAny = agentConfig as any;
        if (configAny.model || configAny.provider) {
            parts.push("");
            parts.push("### Technical Details");
            if (configAny.provider) {
                parts.push(`- Provider: ${configAny.provider}`);
            }
            if (configAny.model) {
                parts.push(`- Model: ${configAny.model}`);
            }
        }

        return {
            id: this.id,
            name: this.name,
            priority: this.defaultPriority,
            content: parts.join("\n"),
            enabled: true,
        };
    }
}

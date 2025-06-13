import type {
	PromptSection,
	PromptSectionBuilder,
	SystemPromptContext,
} from "../types";

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

		// Agent name and role
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
		if (agentConfig.model || agentConfig.provider) {
			parts.push("");
			parts.push("### Technical Details");
			if (agentConfig.provider) {
				parts.push(`- Provider: ${agentConfig.provider}`);
			}
			if (agentConfig.model) {
				parts.push(`- Model: ${agentConfig.model}`);
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

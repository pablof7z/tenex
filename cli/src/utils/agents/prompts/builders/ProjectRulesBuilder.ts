import type { PromptSection, PromptSectionBuilder, SystemPromptContext } from "../types";

/**
 * Builds the project rules section
 */
export class ProjectRulesBuilder implements PromptSectionBuilder {
    id = "project-rules";
    name = "Project Rules";
    defaultPriority = 60;

    build(context: SystemPromptContext): PromptSection | null {
        const { projectRules, additionalRules } = context;

        if ((!projectRules || projectRules.length === 0) && !additionalRules) {
            return null;
        }

        const parts: string[] = [];
        parts.push("## Project Rules");
        parts.push("");
        parts.push("The following rules and guidelines apply to this project:");
        parts.push("");

        // Add cached rules from Nostr
        if (projectRules && projectRules.length > 0) {
            for (const rule of projectRules) {
                parts.push(`### ${rule.title}`);
                if (rule.description) {
                    parts.push(`*${rule.description}*`);
                }
                parts.push("");
                parts.push(rule.content);
                parts.push("");
            }
        }

        // Add any additional rules
        if (additionalRules) {
            if (projectRules && projectRules.length > 0) {
                parts.push("### Additional Rules");
                parts.push("");
            }
            parts.push(additionalRules);
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

import type { PromptSection, PromptSectionBuilder, SystemPromptContext } from "../types";

/**
 * Builds the project context section
 */
export class ProjectContextBuilder implements PromptSectionBuilder {
    id = "project-context";
    name = "Project Context";
    defaultPriority = 85;

    build(context: SystemPromptContext): PromptSection | null {
        const { projectInfo } = context;

        if (!projectInfo) {
            return null;
        }

        const parts: string[] = [];
        parts.push("## Project Context");

        parts.push(`You are working on the project: "${projectInfo.title}"`);

        if (projectInfo.metadata?.title) {
            parts.push(`Project Name: ${projectInfo.metadata.title}`);
        }

        if (projectInfo.repository) {
            parts.push(`Repository: ${projectInfo.repository}`);
        }

        if (projectInfo.description) {
            parts.push("");
            parts.push("### Project Description");
            parts.push(projectInfo.description);
        }

        if (projectInfo.hashtags && projectInfo.hashtags.length > 0) {
            parts.push("");
            parts.push(`Technologies/Topics: ${projectInfo.hashtags.join(", ")}`);
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

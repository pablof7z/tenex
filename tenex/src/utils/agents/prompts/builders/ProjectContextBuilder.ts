import type {
    PromptSection,
    PromptSectionBuilder,
    SystemPromptContext,
} from "@/utils/agents/prompts/types";

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

        // Project title is already shown above

        if (projectInfo.repository) {
            parts.push(`Repository: ${projectInfo.repository}`);
        }

        const projectAny = projectInfo as any;
        if (projectAny.description || projectInfo.projectEvent?.content) {
            parts.push("");
            parts.push("### Project Description");
            parts.push(projectAny.description || projectInfo.projectEvent?.content || "");
        }

        if (projectAny.hashtags && projectAny.hashtags.length > 0) {
            parts.push("");
            parts.push(`Technologies/Topics: ${projectAny.hashtags.join(", ")}`);
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

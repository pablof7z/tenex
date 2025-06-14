import type { SpecCache } from "../SpecCache";
import type { PromptSection, PromptSectionBuilder, SystemPromptContext } from "../types";

/**
 * Builder for project specifications section of system prompt
 * Includes metadata about available documentation without full content
 */
export class ProjectSpecsBuilder implements PromptSectionBuilder {
    readonly id = "project-specs";
    readonly name = "Project Specifications";
    readonly defaultPriority = 200; // After project context (300) but before team info (100)

    constructor(private specCache: SpecCache) {}

    build(context: SystemPromptContext): PromptSection | null {
        if (!this.specCache.isInitialized() || !context.projectInfo) {
            return null;
        }

        const specs = this.specCache.getAllSpecMetadata();
        if (specs.length === 0) {
            return null;
        }

        // Sort specs by last updated (most recent first)
        const sortedSpecs = specs.sort((a, b) => b.lastUpdated - a.lastUpdated);

        const content = this.buildSpecsContent(sortedSpecs);

        return {
            id: this.id,
            name: this.name,
            priority: this.defaultPriority,
            content,
            enabled: true,
        };
    }

    private buildSpecsContent(
        specs: {
            id: string;
            title: string;
            summary?: string;
            lastUpdated: number;
        }[]
    ): string {
        const lines = [
            "## Available Project Documentation",
            "",
            "The following specification documents are available for this project:",
            "",
        ];

        for (const spec of specs) {
            const lastUpdated = new Date(spec.lastUpdated * 1000).toLocaleDateString();
            lines.push(`### ${spec.title} (${spec.id})`);
            if (spec.summary) {
                lines.push(`- **Latest changes**: ${spec.summary}`);
            }
            lines.push(`- **Last updated**: ${lastUpdated}`);
            lines.push(
                `- **Access**: Use the \`read_specs\` tool with id "${spec.id}" to read the full content`
            );
            lines.push("");
        }

        lines.push(
            "**Note**: These documents contain the authoritative project information. Use the `read_specs` tool to access full content when you need detailed information about the project architecture, requirements, or specifications."
        );

        return lines.join("\n");
    }
}

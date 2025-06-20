import type { ToolContext, ToolDefinition } from "@/utils/agents/tools/types";
import { NDKArticle, type NDKFilter } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";

export const readSpecsTool: ToolDefinition = {
    name: "read_specs",
    description:
        "Read all specification documents published for this project. Returns the most recent version of each spec.",
    parameters: [
        {
            name: "spec_name",
            type: "string",
            description:
                'Optional: Specific spec name to fetch (e.g. "SPEC", "ARCHITECTURE"). If not provided, returns all specs.',
            required: false,
        },
    ],
    execute: async (params, context?: ToolContext) => {
        try {
            if (!context?.ndk) {
                return {
                    success: false,
                    output: "",
                    error: "Missing required NDK context for read_specs tool",
                };
            }

            const { ndk } = context;

            // Get the agent and project information
            if (!context.agent) {
                return {
                    success: false,
                    output: "",
                    error: "Agent context not available",
                };
            }

            if (!context.projectEvent) {
                return {
                    success: false,
                    output: "",
                    error: "Project event not available in context",
                };
            }

            // Get the project's pubkey (author of the project event)
            const projectPubkey = context.projectEvent.pubkey;

            // Build filter for NDKArticle events from the project
            const filter: NDKFilter = {
                kinds: [30023], // NDKArticle kind
                authors: [projectPubkey],
            };

            // Add project reference tag to filter specs for this specific project
            const projectDTag = context.projectEvent.dTag;
            if (projectDTag) {
                filter["#a"] = [`31933:${projectPubkey}:${projectDTag}`];
            }

            // If specific spec requested, add d tag filter
            const specName = params.spec_name as string | undefined;
            if (specName) {
                filter["#d"] = [specName.toUpperCase()];
            }

            // Fetch events
            const events = await ndk.fetchEvents(filter);

            if (!events || events.size === 0) {
                return {
                    success: true,
                    output: specName
                        ? `No ${specName.toUpperCase()} specification found.`
                        : "No specifications found for this project.",
                };
            }

            // Convert to array and sort by created_at (newest first)
            const specEvents = Array.from(events).sort(
                (a, b) => (b.created_at || 0) - (a.created_at || 0)
            );

            // Spec document interface
            interface SpecDocument {
                name: string;
                title: string;
                content: string;
                summary: string;
                published_at: number;
                event_id: string;
            }

            // Group by d tag to get only the most recent version of each spec
            const latestSpecs = new Map<string, SpecDocument>();

            for (const event of specEvents) {
                const dTag = event.tags.find((tag) => tag[0] === "d")?.[1];
                if (dTag && !latestSpecs.has(dTag)) {
                    // Create NDKArticle instance to access properties
                    const article = new NDKArticle(ndk, event.rawEvent());

                    latestSpecs.set(dTag, {
                        name: dTag,
                        title: article.title || `${dTag} Specification`,
                        content: article.content,
                        summary:
                            event.tags.find((tag) => tag[0] === "summary")?.[1] || "No summary",
                        published_at: article.published_at || event.created_at || 0,
                        event_id: event.id,
                    });
                }
            }

            // Format output for LLM consumption
            if (specName && latestSpecs.size === 1) {
                // Single spec requested
                const spec = Array.from(latestSpecs.values())[0];
                if (!spec) {
                    return {
                        success: false,
                        output: "",
                        error: "No specification found",
                    };
                }
                const output = formatSingleSpec(spec);

                return {
                    success: true,
                    output,
                };
            }
            // Multiple specs
            const output = formatMultipleSpecs(Array.from(latestSpecs.values()));

            return {
                success: true,
                output,
            };
        } catch (error) {
            logger.error(`Failed to read specs: ${error}`);
            return {
                success: false,
                output: "",
                error: error instanceof Error ? error.message : "Failed to read specifications",
            };
        }
    },
};

interface SpecDocument {
    name: string;
    title: string;
    content: string;
    summary: string;
    published_at: number;
    event_id: string;
}

function formatSingleSpec(spec: SpecDocument): string {
    const date = new Date(spec.published_at * 1000).toISOString();

    return `# ${spec.title}

**Last Updated**: ${date}
**Change Summary**: ${spec.summary}

---

${spec.content}`;
}

function formatMultipleSpecs(specs: SpecDocument[]): string {
    if (specs.length === 0) {
        return "No specifications found.";
    }

    let output = "# Project Specifications\n\n";
    output += `Found ${specs.length} specification${specs.length > 1 ? "s" : ""}:\n\n`;

    // List all specs with summaries
    for (const spec of specs) {
        const date = new Date(spec.published_at * 1000).toISOString().split("T")[0];
        output += `## ${spec.name}\n`;
        output += `- **Title**: ${spec.title}\n`;
        output += `- **Last Updated**: ${date}\n`;
        output += `- **Latest Change**: ${spec.summary}\n`;
        output += `- **Event ID**: ${spec.event_id.substring(0, 16)}...\n\n`;
    }

    output += "---\n\n";

    // Include full content of each spec
    for (const spec of specs) {
        output += `# ${spec.title}\n\n`;
        output += `**Last Change**: ${spec.summary}\n\n`;
        output += spec.content;
        output += "\n\n---\n\n";
    }

    return output.trim();
}

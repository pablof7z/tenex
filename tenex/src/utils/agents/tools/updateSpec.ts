import path from "node:path";
import { NDKArticle } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";
import type { ToolContext, ToolDefinition } from "./types";

export const updateSpecTool: ToolDefinition = {
    name: "update_spec",
    description:
        "Update or create a specification document (like SPEC.md) as an NDKArticle event. The spec will be signed by the orchestrator agent and tagged to the project. Only agents with orchestration capability can use this tool.",
    parameters: [
        {
            name: "filename",
            type: "string",
            description:
                'Base filename of the spec (e.g. "SPEC.md", "ARCHITECTURE.md"). Will be normalized to uppercase without extension for the d tag.',
            required: true,
        },
        {
            name: "content",
            type: "string",
            description: "The full content of the specification document in markdown format",
            required: true,
        },
        {
            name: "changelog",
            type: "string",
            description: "A brief description of what changed in this update",
            required: true,
        },
    ],
    execute: async (params, context?: ToolContext) => {
        try {
            if (!context) {
                return {
                    success: false,
                    output: "",
                    error: "Missing required context for update_spec tool",
                };
            }

            if (!context.agent) {
                return {
                    success: false,
                    output: "",
                    error: "Missing agent in context for update_spec tool",
                };
            }

            const { ndk, agent } = context;

            // Check if agent has orchestration capability to update specs
            const agentConfig = agent.getConfig();
            const hasOrchestrationCapability =
                agentConfig?.capabilities?.includes("orchestration") ||
                agentConfig?.role?.toLowerCase().includes("orchestrator") ||
                agentConfig?.isPrimary;

            if (!hasOrchestrationCapability) {
                return {
                    success: false,
                    output: "",
                    error: "Only agents with orchestration capability can update specifications",
                };
            }

            // Normalize the filename to create the d tag
            // Remove any path components and extension, then uppercase
            const baseName = path.basename(params.filename, path.extname(params.filename));
            const dTag = baseName.toUpperCase();

            // Create the NDKArticle event
            const specEvent = new NDKArticle(ndk);
            specEvent.kind = 30023; // NDKArticle kind
            specEvent.content = params.content;

            // Set the d tag for replaceability
            specEvent.tags.push(["d", dTag]);

            // Set title tag (use the normalized name)
            specEvent.tags.push(["title", `${dTag} Specification`]);

            // Add summary tag with the changelog
            specEvent.tags.push(["summary", params.changelog]);

            // Add published_at tag with current timestamp
            const now = Math.floor(Date.now() / 1000);
            specEvent.tags.push(["published_at", String(now)]);

            // Add project reference - MUST always include the project reference
            if (!context) {
                return {
                    success: false,
                    output: "",
                    error: "Missing required context for update_spec tool",
                };
            }

            specEvent.tag(context.projectEvent);

            // Sign and publish
            await specEvent.sign(agent.getSigner());
            await specEvent.publish();

            logger.info(`Agent ${agent.getName()} updated spec: ${dTag}`);
            logger.debug(`Spec event ID: ${specEvent.id}`);
            logger.debug(`Changelog: ${params.changelog}`);

            // Encode the event reference
            const encodedRef = `nostr:${specEvent.encode()}`;

            return {
                success: true,
                output: `Successfully updated ${dTag} specification with changelog: "${params.changelog}"\n\n${encodedRef}`,
            };
        } catch (error) {
            logger.error(`Failed to update spec: ${error}`);
            return {
                success: false,
                output: "",
                error: error instanceof Error ? error.message : "Failed to update specification",
            };
        }
    },
};

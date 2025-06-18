import path from "node:path";
import type { ToolContext, ToolDefinition } from "@/utils/agents/tools/types";
import { NDKArticle, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";
import { configurationService } from "@tenex/shared/services";
import type { ProjectConfig } from "@tenex/types/config";

export const updateSpecTool: ToolDefinition = {
    name: "update_spec",
    description:
        "Update or create a specification document (like SPEC.md) as an NDKArticle event. The spec will be signed by the project's nsec and tagged to the project. Any agent can use this tool to update project specifications.",
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

            // Normalize the filename to create the d tag
            // Remove any path components and extension, then uppercase
            const baseName = path.basename(
                params.filename as string,
                path.extname(params.filename as string)
            );
            const dTag = baseName.toUpperCase();

            // Create the NDKArticle event
            const specEvent = new NDKArticle(ndk);
            specEvent.kind = 30023; // NDKArticle kind
            specEvent.content = params.content as string;

            // Set the d tag for replaceability
            specEvent.tags.push(["d", dTag]);

            // Set title tag (use the normalized name)
            specEvent.tags.push(["title", `${dTag} Specification`]);

            // Add summary tag with the changelog
            specEvent.tags.push(["summary", params.changelog as string]);

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

            // Load project nsec from config.json to sign the spec
            const projectNsec = await loadProjectNsec();
            if (!projectNsec) {
                return {
                    success: false,
                    output: "",
                    error: "Project nsec not found in config.json. Please ensure the project was initialized properly.",
                };
            }

            const projectSigner = new NDKPrivateKeySigner(projectNsec);

            // Sign and publish with project key
            await specEvent.sign(projectSigner);
            await specEvent.publish();

            logger.info(`Agent ${context.agentName || "unknown"} updated spec: ${dTag}`);
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

// Helper function to load project nsec from config.json
async function loadProjectNsec(): Promise<string | null> {
    try {
        // Get project path from agent's working directory
        const projectPath = process.cwd();
        const configuration = await configurationService.loadConfiguration(projectPath);
        const config = configuration.config as ProjectConfig;

        return config.nsec || null;
    } catch (error) {
        logger.error("Failed to load project nsec from config", { error });
        return null;
    }
}

import type { ToolDefinition, ToolContext } from "./types";
import { NDKArticle } from "@nostr-dev-kit/ndk";
import { logger } from "../../logger";
import path from "node:path";

export const updateSpecTool: ToolDefinition = {
	name: "update_spec",
	description:
		"Update or create a specification document (like SPEC.md) as an NDKArticle event. The spec will be signed by the default agent and tagged to the project.",
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
			description:
				"The full content of the specification document in markdown format",
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
			if (!context?.ndk || !context?.agent) {
				return {
					success: false,
					output: "",
					error: "Missing required context for update_spec tool",
				};
			}

			const { ndk, agent, projectName } = context;

			// Only allow default agent to update specs
			if (agent.getName() !== "default") {
				return {
					success: false,
					output: "",
					error: "Only the default agent can update specifications",
				};
			}

			// Normalize the filename to create the d tag
			// Remove any path components and extension, then uppercase
			const baseName = path.basename(
				params.filename,
				path.extname(params.filename),
			);
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

			// Get project event to tag it
			const projectEventTag = await getProjectEventTag(ndk, projectName);
			if (projectEventTag) {
				specEvent.tags.push(projectEventTag);
			} else {
				logger.warn(`Could not find project event to tag for ${projectName}`);
			}

			// Sign and publish
			await specEvent.sign(agent.getSigner());
			await specEvent.publish();

			logger.info(`Default agent updated spec: ${dTag}`);
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
				error:
					error instanceof Error
						? error.message
						: "Failed to update specification",
			};
		}
	},
};

async function getProjectEventTag(
	ndk: any,
	projectName: string,
): Promise<string[] | null> {
	try {
		// Try to load project metadata to get the naddr
		const fs = await import("node:fs/promises");
		const metadataPath = path.join(process.cwd(), ".tenex", "metadata.json");

		try {
			const metadataContent = await fs.readFile(metadataPath, "utf-8");
			const metadata = JSON.parse(metadataContent);

			if (metadata.naddr) {
				// Parse the naddr to get the project reference
				// Format: naddr1...
				// We need to decode this to get the kind:pubkey:identifier format
				const { nip19 } = await import("nostr-tools");
				const decoded = nip19.decode(metadata.naddr);

				if (decoded.type === "naddr" && decoded.data) {
					const { kind, pubkey, identifier } = decoded.data;
					return ["a", `${kind}:${pubkey}:${identifier}`];
				}
			}
		} catch (err) {
			// Metadata file might not exist
			logger.debug("Could not read project metadata file");
		}

		// If we can't get from metadata, we'll skip the project tag
		// The spec will still be published and associated with the author
		return null;
	} catch (error) {
		logger.error(`Failed to get project event tag: ${error}`);
		return null;
	}
}

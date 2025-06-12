import path from "node:path";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import { Command } from "commander";
import { getNDK } from "../../nostr/ndkClient";
import { logger } from "../../utils/logger";
import { type AddRuleOptions, INSTRUCTION_KIND } from "./types";
import { hasProjectConfig, saveRule } from "./utils";

export const addCommand = new Command("add")
	.description("Add a rule from a Nostr event ID")
	.argument("<neventid>", "Nostr event ID (nevent or hex)")
	.option("-a, --agent <name>", "Target specific agent")
	.option("-p, --project-path <path>", "Path to project", process.cwd())
	.action(async (eventIdArg: string, options: AddRuleOptions) => {
		try {
			const projectPath = path.resolve(options.projectPath || process.cwd());

			if (!hasProjectConfig(projectPath)) {
				logger.error(
					"No .tenex directory found. Please run from a TENEX project directory.",
				);
				process.exit(1);
			}

			logger.info(`Fetching instruction event: ${eventIdArg}`);

			const ndk = await getNDK();
			const event = await ndk.fetchEvent(eventIdArg);

			if (!event) {
				logger.error(`No instruction event found with ID: ${eventIdArg}`);
				process.exit(1);
			}

			if (event.kind !== INSTRUCTION_KIND) {
				logger.error(
					`Event is not an instruction (kind ${event.kind}, expected ${INSTRUCTION_KIND})`,
				);
				process.exit(1);
			}

			const title =
				event.tags.find((tag) => tag[0] === "title")?.[1] || "Untitled Rule";
			const description =
				event.tags.find((tag) => tag[0] === "description")?.[1] || "";
			const content = event.content;

			const ruleData = {
				eventId: event.id,
				title,
				description,
				content,
			};

			const filePath = saveRule(projectPath, ruleData, options.agent);

			logger.success(`Rule "${title}" added successfully`);
			if (options.agent) {
				logger.info(`Saved for agent: ${options.agent}`);
			}
			logger.info(`File: ${filePath}`);

			process.exit(0);
		} catch (error) {
			logger.error(
				`Failed to add rule: ${error instanceof Error ? error.message : String(error)}`,
			);
			process.exit(1);
		}
	});

import path from "node:path";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { Command } from "commander";
import inquirer from "inquirer";
import { getNDK } from "../../nostr/ndkClient";
import { logger } from "../../utils/logger";
import { type GetRuleOptions, INSTRUCTION_KIND } from "./types";
import { hasProjectConfig, saveRule } from "./utils";

export const getCommand = new Command("get")
	.description("Search and add rules from Nostr")
	.argument("<search-term>", "Search term for finding rules")
	.option("-a, --agent <name>", "Target specific agent")
	.option("-p, --project-path <path>", "Path to project", process.cwd())
	.option("-l, --limit <number>", "Maximum number of results", "50")
	.action(async (searchTerm: string, options: GetRuleOptions) => {
		try {
			const projectPath = path.resolve(options.projectPath || process.cwd());

			if (!hasProjectConfig(projectPath)) {
				logger.error(
					"No .tenex directory found. Please run from a TENEX project directory.",
				);
				process.exit(1);
			}

			logger.info(`Searching for rules matching: ${searchTerm}`);

			const ndk = await getNDK();
			const events = await ndk.fetchEvents({
				kinds: [INSTRUCTION_KIND],
				limit: Number.parseInt(options.limit?.toString() || "50"),
			});

			const matchingEvents: NDKEvent[] = [];
			const searchLower = searchTerm.toLowerCase();

			for (const event of events) {
				const title = event.tags.find((tag) => tag[0] === "title")?.[1] || "";
				const description =
					event.tags.find((tag) => tag[0] === "description")?.[1] || "";
				const tags = event.tags
					.filter((tag) => tag[0] === "t")
					.map((tag) => tag[1]);

				if (
					title.toLowerCase().includes(searchLower) ||
					description.toLowerCase().includes(searchLower) ||
					tags.some((tag) => tag?.toLowerCase().includes(searchLower)) ||
					event.content.toLowerCase().includes(searchLower)
				) {
					matchingEvents.push(event);
				}
			}

			if (matchingEvents.length === 0) {
				logger.info("No matching rules found.");
				process.exit(0);
			}

			const choices = matchingEvents.map((event, index) => {
				const title =
					event.tags.find((tag) => tag[0] === "title")?.[1] || "Untitled";
				const description =
					event.tags.find((tag) => tag[0] === "description")?.[1] || "";
				const version = event.tags.find((tag) => tag[0] === "ver")?.[1] || "1";
				return {
					name: `${index + 1}. ${title} (v${version}): ${description}`,
					value: index,
				};
			});

			const { selectedIndices } = await inquirer.prompt([
				{
					type: "checkbox",
					name: "selectedIndices",
					message: "Select rules to add to your project:",
					choices,
					validate: (input) =>
						input.length > 0 || "Please select at least one rule",
				},
			]);

			for (const index of selectedIndices) {
				const event = matchingEvents[index];
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
				logger.success(`Added: ${title}`);
			}

			logger.info(`Added ${selectedIndices.length} rule(s) to your project`);
			if (options.agent) {
				logger.info(`Rules saved for agent: ${options.agent}`);
			}

			process.exit(0);
		} catch (error) {
			logger.error(
				`Failed to search rules: ${error instanceof Error ? error.message : String(error)}`,
			);
			process.exit(1);
		}
	});

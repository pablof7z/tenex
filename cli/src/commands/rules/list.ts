import path from "node:path";
import { Command } from "commander";
import { logger } from "../../utils/logger";
import type { ListRuleOptions } from "./types";
import { hasProjectConfig, loadAllRules } from "./utils";

export const listCommand = new Command("list")
	.description("List rules in the current project")
	.option("-a, --agent <name>", "List rules for specific agent")
	.option("-p, --project-path <path>", "Path to project", process.cwd())
	.action(async (options: ListRuleOptions) => {
		try {
			const projectPath = path.resolve(options.projectPath || process.cwd());

			if (!hasProjectConfig(projectPath)) {
				logger.error(
					"No .tenex directory found. Please run from a TENEX project directory.",
				);
				process.exit(1);
			}

			if (options.agent) {
				const { general, byAgent } = loadAllRules(projectPath);
				const agentRules = byAgent.get(options.agent) || [];

				if (agentRules.length === 0) {
					logger.info(`No rules found for agent: ${options.agent}`);
					process.exit(0);
				}

				logger.info(`Rules for agent "${options.agent}":`);
				agentRules.forEach((rule, index) => {
					console.log(`${index + 1}. ${rule.data.title}`);
					if (rule.data.description) {
						console.log(`   ${rule.data.description}`);
					}
				});
			} else {
				const { general, byAgent } = loadAllRules(projectPath);

				if (general.length === 0 && byAgent.size === 0) {
					logger.info("No rules found in this project.");
					logger.info(
						"Use 'tenex rules get <search-term>' to add rules from Nostr.",
					);
					process.exit(0);
				}

				if (general.length > 0) {
					logger.info("General rules (apply to all agents):");
					general.forEach((rule, index) => {
						console.log(`${index + 1}. ${rule.data.title}`);
						if (rule.data.description) {
							console.log(`   ${rule.data.description}`);
						}
					});
				}

				if (byAgent.size > 0) {
					console.log("");
					for (const [agentName, rules] of byAgent.entries()) {
						logger.info(`Rules for agent "${agentName}":`);
						rules.forEach((rule, index) => {
							console.log(`${index + 1}. ${rule.data.title}`);
							if (rule.data.description) {
								console.log(`   ${rule.data.description}`);
							}
						});
						console.log("");
					}
				}
			}

			process.exit(0);
		} catch (error) {
			logger.error(
				`Failed to list rules: ${error instanceof Error ? error.message : String(error)}`,
			);
			process.exit(1);
		}
	});

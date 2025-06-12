/**
 * TENEX CLI: init command
 * Checks for config and launches wizard if needed.
 */
import { ConfigManager } from "../config/manager";
import { runConfigWizard } from "../config/wizard";
import { logInfo } from "../utils/logger";

export async function runInit() {
	const config = ConfigManager.loadConfig();
	if (config) {
		logInfo("TENEX is already initialized. Config found at ~/.tenex/config");
		process.exit(0);
	}
	await runConfigWizard();
}

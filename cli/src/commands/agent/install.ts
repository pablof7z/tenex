/**
 * TENEX CLI: agent install command
 * No-op: feature coming soon.
 */

import { NDKClient } from "../../nostr/ndkClient";
import { ConfigManager } from "../../config/manager";
import { logInfo } from "../../utils/logger";

export async function runAgentInstall() {
    logInfo("The 'agent install' feature is coming soon.");
    const config = ConfigManager.loadConfig();
    if (config?.user?.nsec) {
        await NDKClient.publishStatusUpdate(config.user.nsec, "User ran 'agent install' (feature coming soon).", {
            command: "agent install",
        });
    }
    process.exit(0);
}

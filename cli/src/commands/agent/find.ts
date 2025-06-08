/**
 * TENEX CLI: agent find command
 * No-op: feature coming soon.
 */

import { NDKClient } from "../../nostr/ndkClient";
import { ConfigManager } from "../../config/manager";
import { logInfo } from "../../utils/logger";

export async function runAgentFind() {
    logInfo("The 'agent find' feature is coming soon.");
    const config = ConfigManager.loadConfig();
    if (config?.user?.nsec) {
        await NDKClient.publishStatusUpdate(config.user.nsec, "User ran 'agent find' (feature coming soon).", {
            command: "agent find",
        });
    }
}

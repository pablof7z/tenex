/**
 * TENEX CLI: agent find command
 * No-op: feature coming soon.
 */

import { publishStatusUpdate } from "../../nostr/ndkClient";
import { config, ndk } from "../../nostr/session";
import { logInfo } from "../../utils/logger";

export async function runAgentFind() {
    logInfo("The 'agent find' feature is coming soon.");
    if (config) {
        publishStatusUpdate("User ran 'agent find' (feature coming soon).", {
            command: "agent find",
        });
    }
}

/**
 * TENEX CLI: agent install command
 * No-op: feature coming soon.
 */

import { publishStatusUpdate } from "../../nostr/ndkClient";
import { config, ndk } from "../../nostr/session";
import { logInfo } from "../../utils/logger";

export async function runAgentInstall() {
    logInfo("The 'agent install' feature is coming soon.");
    if (config) {
        publishStatusUpdate("User ran 'agent install' (feature coming soon).", {
            command: "agent install",
        });
    }
}

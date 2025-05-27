/**
 * TENEX CLI: agent find command
 * No-op: feature coming soon.
 */
import { logInfo } from "../../utils/logger";
import { ndk, config } from "../../nostr/session";
import { publishStatusUpdate } from "../../nostr/ndkClient";

export async function runAgentFind() {
  logInfo("The 'agent find' feature is coming soon.");
  if (config) {
    publishStatusUpdate("User ran 'agent find' (feature coming soon).", {
      command: "agent find"
    });
  }
}
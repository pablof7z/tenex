/**
 * TENEX CLI: agent install command
 * No-op: feature coming soon.
 */
import { logInfo } from "../../utils/logger";
import { ndk, config } from "../../nostr/session";
import { publishStatusUpdate } from "../../nostr/ndkClient";

export async function runAgentInstall() {
  logInfo("The 'agent install' feature is coming soon.");
  if (config) {
    publishStatusUpdate("User ran 'agent install' (feature coming soon).", {
      command: "agent install"
    });
  }
}
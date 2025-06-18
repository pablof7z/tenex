#!/usr/bin/env bun

import { logger } from "@tenex/shared/logger";
// CLI entry point for TENEX
import { Command } from "commander";
import { daemonCommand } from "../src/commands/daemon";
import { runDebugSystemPrompt } from "../src/commands/debug/index";
import { projectCommand } from "../src/commands/project/index";
import { setupCommand } from "../src/commands/setup/index";
import { initNDK } from "../src/nostr/ndkClient";

const program = new Command();

program.name("tenex").description("TENEX Command Line Interface").version("0.1.0");

// Add main commands
program.addCommand(daemonCommand);
program.addCommand(projectCommand);
program.addCommand(setupCommand);

// Add debug command
const debug = program.command("debug").description("Debug commands");
debug
    .command("system-prompt")
    .description("Show the system prompt for an agent")
    .option("--agent <name>", "Agent name", "default")
    .action((options) => runDebugSystemPrompt(options));
debug
    .command("chat [agent]")
    .description("Start an interactive debug chat session with an agent")
    .option("-s, --system-prompt", "Show the agent's system prompt on first request")
    .option("-m, --message <message>", "Initial message to send")
    .action((agent, options) => {
        import("../src/commands/debug/chat").then(({ runDebugChat }) =>
            runDebugChat(agent, options)
        );
    });

// Initialize NDK before parsing commands
async function main() {
    await initNDK();
    program.parse(process.argv);
}

main().catch((error) => {
    logger.error("Fatal error in TENEX CLI", error);
    process.exit(1);
});

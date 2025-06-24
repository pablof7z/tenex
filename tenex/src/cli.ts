#!/usr/bin/env bun

import { logger } from "@/utils/logger";
// CLI entry point for TENEX
import { Command } from "commander";
import { daemonCommand } from "./commands/daemon";
import { runDebugSystemPrompt } from "./commands/debug/index";
import { inventoryCommand } from "./commands/inventory/index";
import { projectCommand } from "./commands/project/index";
import { setupCommand } from "./commands/setup/index";
import { initNDK } from "./nostr/ndkClient";

const program = new Command();

program.name("tenex").description("TENEX Command Line Interface").version("0.1.0");

// Add main commands
program.addCommand(daemonCommand);
program.addCommand(projectCommand);
program.addCommand(setupCommand);
program.addCommand(inventoryCommand);

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
    .option(
        "-l, --llm [config]",
        "LLM configuration to use (shows available configs if no value provided)"
    )
    .action((agent, options) => {
        import("./commands/debug/chat").then(({ runDebugChat }) => runDebugChat(agent, options));
    });

// Initialize NDK before parsing commands
export async function main(): Promise<void> {
    await initNDK();
    program.parse(process.argv);
}

// Only run if called directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        logger.error("Fatal error in TENEX CLI", error);
        process.exit(1);
    });
}

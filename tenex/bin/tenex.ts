#!/usr/bin/env bun

// CLI entry point for TENEX
import { Command } from "commander";
import { daemonCommand } from "../src/commands/daemon";
import { runDebugSystemPrompt } from "../src/commands/debug/index";
import { projectCommand } from "../src/commands/project/index";

const program = new Command();

program.name("tenex").description("TENEX Command Line Interface").version("0.1.0");

// Add main commands
program.addCommand(daemonCommand);
program.addCommand(projectCommand);

// Add debug command
const debug = program.command("debug").description("Debug commands");
debug
    .command("system-prompt")
    .description("Show the system prompt for an agent")
    .option("--agent <name>", "Agent name", "default")
    .action((options) => runDebugSystemPrompt(options));

program.parse(process.argv);

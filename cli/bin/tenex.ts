// CLI entry point for TENEX
import { Command } from "commander";
import { runDebugSystemPrompt } from "../src/commands/debug";
import { runProjectInit } from "../src/commands/project/init";
import { runTask } from "../src/commands/run";

const program = new Command();

program.name("tenex").description("TENEX Command Line Interface").version("0.1.0");

const project = program.command("project").description("Project commands");

project
    .command("init <path> <naddr>")
    .description("Initialize a new TENEX project from NDKProject naddr")
    .action((path, naddr) => runProjectInit({ path, naddr }));

program.command("run").description("Start TENEX project listener").action(runTask);

const debug = program.command("debug").description("Debug commands");

debug
    .command("system-prompt")
    .description("Show the system prompt for an agent")
    .option("--agent <name>", "Agent name", "default")
    .action((options) => runDebugSystemPrompt(options));

program.parse(process.argv);

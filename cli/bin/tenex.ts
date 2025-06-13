// CLI entry point for TENEX
import { Command } from "commander";
import { runProjectInit } from "../src/commands/project/init";
import { runTask } from "../src/commands/run";

const program = new Command();

program
	.name("tenex")
	.description("TENEX Command Line Interface")
	.version("0.1.0");

const project = program.command("project").description("Project commands");

project
	.command("init <path> <naddr>")
	.description("Initialize a new TENEX project from NDKProject naddr")
	.action((path, naddr) => runProjectInit({ path, naddr }));

program
	.command("run")
	.description("Start TENEX project listener")
	.action(runTask);

program.parse(process.argv);

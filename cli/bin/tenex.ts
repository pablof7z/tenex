// CLI entry point for TENEX
import { Command } from "commander";
import { runAgentFind } from "../src/commands/agent/find";
import { runAgentInstall } from "../src/commands/agent/install";
import { runAgentPublish } from "../src/commands/agent/publish";
import { runInit } from "../src/commands/init";
import { runProjectInit } from "../src/commands/project/init";
import { runTask } from "../src/commands/run";
import { rulesCommand } from "../src/commands/rules";
import { createChatCommand } from "../src/commands/chat";

const program = new Command();

program.name("tenex").description("TENEX Command Line Interface").version("0.1.0");

program.command("config").description("Initialize TENEX configuration").action(runInit);

const project = program.command("project").description("Project commands");

project
    .command("init <path> <naddr>")
    .description("Initialize a new TENEX project from NDKProject naddr")
    .action((path, naddr) => runProjectInit({ path, naddr }));

const agent = program.command("agent").description("Agent commands");

agent
    .command("publish")
    .description("Publish a new agent")
    .option("--title <title>", "Agent title")
    .option("--avatar <avatar>", "Agent avatar URL")
    .option("--description <description>", "Agent description")
    .option("--role <role>", "Agent role definition")
    .option("--instructions <instructions>", "Agent instructions")
    .option("--models <models>", "Recommended models")
    .option("--file <file...>", "File(s) or directory to include")
    .option("--goose <uri>", "Goose URI with encoded agent configuration")
    .action(runAgentPublish);

agent.command("find").description("Find agents").action(runAgentFind);

agent.command("install").description("Install an agent").action(runAgentInstall);

program.addCommand(rulesCommand);

program
    .command("run <nevent1>")
    .description("Run a task from a Nostr event")
    .option("--roo", "Use Roo (VS Code) backend")
    .option("--claude", "Use Claude backend")
    .option("--goose", "Use Goose backend")
    .action(runTask);

program.addCommand(createChatCommand());

program.parse(process.argv);

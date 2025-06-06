// CLI entry point for TENEX
import { Command } from "commander";
import { runAgentFind } from "../src/commands/agent/find";
import { runAgentInstall } from "../src/commands/agent/install";
import { runAgentPublish } from "../src/commands/agent/publish";
import { runInit } from "../src/commands/init";

const program = new Command();

program.name("tenex").description("TENEX Command Line Interface").version("0.1.0");

program.command("init").description("Initialize TENEX configuration").action(runInit);

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
    .action(runAgentPublish);

agent.command("find").description("Find agents").action(runAgentFind);

agent.command("install").description("Install an agent").action(runAgentInstall);

program.parse(process.argv);

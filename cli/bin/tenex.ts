// CLI entry point for TENEX
import { Command } from "commander";
import { runAgentFind } from "../src/commands/agent/find";
import { runAgentInstall } from "../src/commands/agent/install";
import { runAgentPublish } from "../src/commands/agent/publish";
import { runInit } from "../src/commands/init";
import { runProjectInit } from "../src/commands/project/init";
import { runTask } from "../src/commands/run";
import { rulesCommand } from "../src/commands/rules";

const program = new Command();

program.name("tenex").description("TENEX Command Line Interface").version("0.1.0");

program.command("config").description("Initialize TENEX configuration").action(runInit);

const project = program.command("project").description("Project commands");

project
    .command("init <path>")
    .description("Initialize a new TENEX project")
    .requiredOption("--name <name>", "Project name")
    .requiredOption("--nsec <nsec>", "Project nsec key")
    .option("--title <title>", "Project title")
    .option("--description <description>", "Project description")
    .option("--repo-url <url>", "Git repository URL to clone")
    .option("--hashtags <tags>", "Comma-separated hashtags")
    .option("--project-naddr <naddr>", "Project naddr (bech32 encoding)")
    .option("--template <naddr>", "Template naddr (bech32 encoding)")
    .action((path, options) => runProjectInit({ path, ...options }));

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

program.addCommand(rulesCommand);

program
    .command("run")
    .description("Run a task with an AI backend")
    .requiredOption("--project-path <path>", "Path to the project")
    .requiredOption("--task-id <id>", "Task ID")
    .option("--task-title <title>", "Task title")
    .option("--task-description <description>", "Task description")
    .option("--context <context>", "Additional context for the task")
    .option("--roo", "Use Roo backend (VS Code integration)")
    .option("--claude", "Use Claude backend (not implemented)")
    .option("--goose", "Use Goose backend (not implemented)")
    .option("--dry-run", "Show the prompt that would be sent without executing")
    .action(runTask);

program.parse(process.argv);

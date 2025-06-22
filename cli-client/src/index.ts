#!/usr/bin/env bun

import { logger } from "./logger.js";
import { Command } from "commander";
import { TenexCLI } from "./cli.js";
import { createProject } from "./commands/project-create.js";
import { startProject } from "./commands/project-start.js";

const program = new Command();

program
    .name("tenex-cli-client")
    .description("CLI client for TENEX project communication")
    .version("1.0.0");

program
    .command("chat")
    .description("Start a chat session with a TENEX project")
    .action(async () => {
        const cli = new TenexCLI();
        await cli.start();
    });

const projectCommand = program.command("project").description("Project management commands");

projectCommand
    .command("create")
    .description("Create a new TENEX project")
    .requiredOption("--name <name>", "Project name")
    .requiredOption("--nsec <nsec>", "Your Nostr private key")
    .option("--description <description>", "Project description")
    .option("--repo <url>", "Git repository URL")
    .option("--hashtags <tags>", "Comma-separated hashtags")
    .action(createProject);

projectCommand
    .command("start")
    .description("Send a project start event (triggers daemon to start project)")
    .requiredOption("--nsec <nsec>", "Your Nostr private key")
    .requiredOption("--project <naddr>", "Project NADDR or identifier")
    .action(startProject);

program
    .command("help")
    .description("Show usage information")
    .action(() => {
        logger.info(`
🚀 TENEX CLI Client

Usage:
  tenex-cli-client chat                      Start a chat session
  tenex-cli-client project create            Create a new project
  tenex-cli-client project start             Send project start event

Environment Variables:
  NSEC            Your Nostr private key (nsec1...)
  PROJECT_NADDR   Project NADDR to connect to (optional)

Examples:
  # Interactive chat
  export NSEC=nsec1xyz...
  export PROJECT_NADDR=naddr1abc...
  tenex-cli-client chat

  # Create project
  tenex-cli-client project create --name "My Project" --nsec nsec1xyz...

  # Start project
  tenex-cli-client project start --project naddr1abc... --nsec nsec1xyz...

Features:
  • Start new threads with projects
  • Reply to existing threads  
  • Mention agents with @agent syntax
  • Real-time typing indicators
  • Agent response listening
  • Session management
  • Project creation and management
        `);
    });

if (process.argv.length <= 2) {
    program.help();
} else {
    program.parse();
}

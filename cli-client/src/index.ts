#!/usr/bin/env bun

import { Command } from "commander";
import { TenexCLI } from "./cli.js";

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

program
    .command("help")
    .description("Show usage information")
    .action(() => {
        console.log(`
🚀 TENEX CLI Client

Usage:
  tenex-cli-client chat    Start a chat session

Environment Variables:
  NSEC            Your Nostr private key (nsec1...)
  PROJECT_NADDR   Project NADDR to connect to (optional)

Examples:
  export NSEC=nsec1xyz...
  export PROJECT_NADDR=naddr1abc...
  tenex-cli-client chat

Features:
  • Start new threads with projects
  • Reply to existing threads  
  • Mention agents with @agent syntax
  • Real-time typing indicators
  • Agent response listening
  • Session management
        `);
    });

if (process.argv.length <= 2) {
    program.help();
} else {
    program.parse();
}

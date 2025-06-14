#!/usr/bin/env bun

import { spawn } from "node:child_process";
import chalk from "chalk";
import { ToolExecutor } from "./ToolExecutor";
import { ToolParser } from "./ToolParser";
import { ToolRegistry } from "./ToolRegistry";
import { claudeCodeTool } from "./claudeCode";

// Test the Claude Code tool
async function testClaudeCodeTool() {
    console.log(chalk.bold.blue("\n=== Testing Claude Code Tool ===\n"));

    // Create a tool registry and register the Claude Code tool
    const registry = new ToolRegistry();
    registry.register(claudeCodeTool);

    // Create a tool executor
    const executor = new ToolExecutor(registry);

    // Test via tool
    console.log(chalk.yellow("Testing via tool"));
    const test2 = {
        id: "test2",
        name: "write_code",
        arguments: {
            task: "Create a simple hello world function",
            context: "Just return Hello, World!",
        },
    };

    try {
        const result = await executor.executeTool(test2);
        console.log(chalk.green("\nFinal Result:"), result.output);
    } catch (error) {
        console.error(chalk.red("Error:"), error);
    }
}

// Run the test
if (import.meta.main) {
    testClaudeCodeTool().catch(console.error);
}

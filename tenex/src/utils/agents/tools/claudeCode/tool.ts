import { spawn } from "node:child_process";
import { ClaudeCodeOutputParser } from "@/utils/agents/tools/claudeCode/ClaudeCodeOutputParser";
import type { ClaudeCodeOptions } from "@/utils/agents/tools/claudeCode/types";
import type { ToolContext, ToolDefinition } from "@/utils/agents/tools/types";
import { logDebug, logError, logInfo } from "@tenex/shared/logger";
import { NDKTask } from "@nostr-dev-kit/ndk";
import chalk from "chalk";

export const claudeCodeTool: ToolDefinition = {
    name: "claude_code",
    description:
        "ACTUALLY IMPLEMENT code changes by invoking Claude Code. Use this tool when you need to WRITE, MODIFY, CREATE, or ANALYZE code files. This tool does the actual work - it doesn't just create a task, it executes the implementation. Use claude_code for: writing new code, modifying existing files, debugging, refactoring, creating new features, fixing bugs, or any hands-on coding work.",
    parameters: [
        {
            name: "title",
            type: "string",
            description:
                "A concise title (3-8 words) describing what this code task will accomplish.",
            required: true,
        },
        {
            name: "prompt",
            type: "string",
            description:
                "The detailed prompt for Claude Code. Claude Code will determine what context and files it needs.",
            required: true,
        },
    ],
    execute: async (params, toolContext?: ToolContext) => {
        const title = params.title as string;
        const prompt = params.prompt as string;

        logInfo(chalk.blue("\n🚀 Starting Claude Code..."));
        logDebug(chalk.gray(`Title: "${title}"`));
        logDebug(chalk.gray(`Prompt: "${prompt.substring(0, 100)}..."`));

        // Create NDKTask for this claude_code execution
        let taskEvent: NDKTask | undefined;
        if (
            toolContext?.ndk &&
            toolContext?.projectEvent &&
            toolContext?.rootEventId &&
            toolContext?.agent
        ) {
            try {
                taskEvent = new NDKTask(toolContext.ndk);
                taskEvent.title = title;
                taskEvent.content = prompt;

                // Tag the task with the project
                taskEvent.tag(toolContext.projectEvent);

                // E-tag the thread if we have a rootEventId
                taskEvent.tags.push(["e", toolContext.rootEventId]);

                // Add agent tag if available
                if (toolContext.agentName) {
                    taskEvent.tags.push(["agent", toolContext.agentName]);
                }

                // Add tool tag to identify this as a claude_code task
                taskEvent.tags.push(["tool", "claude_code"]);

                // Sign and publish the task using agent's signer
                await taskEvent.sign(toolContext.agent.getSigner());
                await taskEvent.publish();

                logInfo(chalk.green(`📋 Created task: ${title}`));
                logDebug(chalk.gray(`Task ID: ${taskEvent.id}`));
            } catch (error) {
                logError(chalk.red(`Failed to create task: ${error}`));
                // Continue without task if creation fails
            }
        }

        try {
            const result = await executeClaudeCode(
                {
                    prompt: prompt,
                    verbose: true,
                    outputFormat: "stream-json",
                    dangerouslySkipPermissions: true,
                },
                toolContext,
                taskEvent
            );

            return {
                success: true,
                output: result,
            };
        } catch (error) {
            return {
                success: false,
                output: "",
                error: error instanceof Error ? error.message : "Claude Code execution failed",
            };
        }
    },
};

function executeClaudeCode(
    options: ClaudeCodeOptions,
    toolContext?: ToolContext,
    taskEvent?: NDKTask
): Promise<string> {
    return new Promise((resolve, reject) => {
        // Match the working command format
        const args = [
            "-p",
            "--dangerously-skip-permissions",
            "--output-format",
            "stream-json",
            "--verbose",
            options.prompt,
        ];

        // Show the actual command being run
        logDebug(
            `${chalk.gray("Command:")} claude ${args.map((arg) => (arg.includes(" ") ? `'${arg}'` : arg)).join(" ")}`
        );
        logDebug(`${chalk.gray("Working directory:")} ${options.projectPath || process.cwd()}`);
        logInfo(chalk.yellow("\nExecuting Claude Code...\n"));

        const claudeProcess = spawn("claude", args, {
            cwd: options.projectPath || process.cwd(),
            env: { ...process.env },
            stdio: ["ignore", "pipe", "inherit"], // ignore stdin, pipe stdout, inherit stderr
        });

        logDebug(`${chalk.gray("Claude process PID:")} ${claudeProcess.pid}`);

        const parser = new ClaudeCodeOutputParser(toolContext, taskEvent);
        let finalResult = "";
        let hasError = false;

        // Set encoding for better string handling
        if (claudeProcess.stdout) {
            claudeProcess.stdout.setEncoding("utf8");
        }

        claudeProcess.stdout?.on("data", (chunk: string) => {
            console.log("[CC] Received chunk:", chunk); // Debugging output
            const messages = parser.parseLines(chunk);

            // Capture the final result
            for (const message of messages) {
                console.log("[CC] Parsed message:", message); // Debugging output
                if (message.type === "result") {
                    if (message.result) {
                        finalResult = message.result;
                    }
                    if (message.is_error) {
                        hasError = true;
                    }
                }
            }
        });

        // stderr is inherited, so it will show directly in console

        claudeProcess.on("close", (code) => {
            if (code !== 0 || hasError) {
                reject(new Error(`Claude Code exited with code ${code}`));
            } else {
                // Include summary statistics in the result
                const stats = [];
                if (parser.getMessageCount() > 0) {
                    stats.push(`${parser.getMessageCount()} messages`);
                }
                if (parser.getTotalCost() > 0) {
                    stats.push(`$${parser.getTotalCost().toFixed(4)}`);
                }

                const summary = stats.length > 0 ? ` (${stats.join(", ")})` : "";
                resolve(finalResult || `Code task completed successfully${summary}`);
            }
        });

        claudeProcess.on("error", (error) => {
            logError(`${chalk.red("Failed to start Claude Code:")} ${error.message}`);
            if (error.message.includes("ENOENT")) {
                logError(chalk.yellow("\nMake sure Claude CLI is installed and in your PATH"));
                logError(chalk.yellow("Install with: npm install -g @anthropic-ai/claude-cli"));
            }
            reject(new Error(`Failed to start Claude Code: ${error.message}`));
        });
    });
}

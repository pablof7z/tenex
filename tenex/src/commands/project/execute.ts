import { TaskExecutor } from "@/services/TaskExecutor";
import { ensureProjectInitialized } from "@/utils/projectInitialization";
import { shutdownNDK } from "@/nostr/ndkClient";
import { logger } from "@/utils/logger";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";

export const projectExecuteCommand = new Command("execute")
    .description("Execute a standalone task using Claude Code")
    .argument("<prompt>", "The task instruction to execute")
    .option("--no-branch", "Skip creating a git branch for execution")
    .action(async (prompt: string, options) => {
        const spinner = ora("Initializing task execution...").start();

        try {
            // Initialize project context (includes NDK setup)
            await ensureProjectInitialized(process.cwd());

            spinner.text = "Creating task and starting execution...";

            // Create task executor
            const executor = new TaskExecutor();

            // Execute the task
            const result = await executor.execute({
                prompt,
                createBranch: options.branch !== false,
            });

            spinner.stop();

            if (result.success) {
                console.log(chalk.green("\n✓ Task execution completed successfully"));
                console.log(chalk.gray("Task ID:"), result.task.id);
                if (result.branch) {
                    console.log(chalk.gray("Branch:"), result.branch);
                }
                if (result.sessionId) {
                    console.log(chalk.gray("Session ID:"), result.sessionId);
                }
                if (result.totalCost) {
                    console.log(chalk.gray("Cost:"), `$${result.totalCost.toFixed(4)} USD`);
                }
                if (result.messageCount) {
                    console.log(chalk.gray("Messages:"), result.messageCount);
                }
                if (result.duration) {
                    console.log(chalk.gray("Duration:"), `${Math.round(result.duration / 1000)}s`);
                }
            } else {
                console.error(chalk.red("\n✗ Task execution failed"));
                console.error(chalk.gray("Task ID:"), result.task.id);
                if (result.error) {
                    console.error(chalk.gray("Error:"), result.error);
                }
                process.exit(1);
            }
        } catch (error) {
            spinner.stop();
            console.error(chalk.red("\n✗ Failed to execute task"));
            console.error(chalk.gray(error instanceof Error ? error.message : String(error)));
            logger.error("Task execution failed", { error });
            process.exit(1);
        } finally {
            await shutdownNDK();
        }
    });

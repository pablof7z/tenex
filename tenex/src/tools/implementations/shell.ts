import type { Tool } from "../types";
import { success, failure, createZodSchema } from "../types";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "@/utils/logger";

const execAsync = promisify(exec);

const shellSchema = z.object({
    command: z.string().describe("The shell command to execute"),
    cwd: z
        .string()
        .optional()
        .describe("Working directory for the command (defaults to project root)"),
    timeout: z.number().optional().describe("Command timeout in milliseconds (default: 30000)"),
});

/**
 * Shell tool - allows agents to execute shell commands
 * Restricted to project-manager agent for safety
 */
export const shellTool: Tool<
    {
        command: string;
        cwd?: string;
        timeout?: number;
    },
    string
> = {
    name: "shell",
    description: "Execute shell commands in the project directory",

    parameters: createZodSchema(shellSchema),

    execute: async (input, context) => {
        const { command, cwd, timeout = 30000 } = input.value;

        // Safety check - only project-manager can use this tool
        if (context.agent.slug !== "project-manager") {
            return failure({
                kind: "validation",
                field: "agent",
                message: "Shell tool is restricted to project-manager agent only",
            });
        }

        const workingDir = cwd || context.projectPath;

        logger.info("Executing shell command", {
            command,
            cwd: workingDir,
            agent: context.agent.name,
            timeout,
        });

        try {
            const { stdout, stderr } = await execAsync(command, {
                cwd: workingDir,
                timeout,
                env: {
                    ...process.env,
                    // Ensure safe environment
                    PATH: process.env.PATH,
                    HOME: process.env.HOME,
                },
            });

            const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : "");

            logger.info("Shell command completed", {
                command,
                hasStdout: !!stdout,
                hasStderr: !!stderr,
            });

            return success(output);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);

            logger.error("Shell command failed", {
                command,
                error: errorMessage,
            });

            return failure({
                kind: "execution",
                tool: "shell",
                message: `Command failed: ${errorMessage}`,
            });
        }
    },
};

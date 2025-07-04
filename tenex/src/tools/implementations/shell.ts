import { exec } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import type { Tool, ToolExecutionContext, ToolResult } from "../types";
import { parseToolParams } from "../utils";

const execAsync = promisify(exec);

const ShellArgsSchema = z.object({
    command: z.string().min(1, "command must be a non-empty string"),
});

export const shellTool: Tool = {
    name: "shell",
    description: "Execute a shell command in the project directory",
    parameters: [
        {
            name: "command",
            type: "string",
            description: "The shell command to execute",
            required: true,
        },
    ],

    async execute(
        params: Record<string, unknown>,
        context: ToolExecutionContext
    ): Promise<ToolResult> {
        const parseResult = parseToolParams(ShellArgsSchema, params);
        if (!parseResult.success) {
            return parseResult.errorResult;
        }

        const { command } = parseResult.data;

        try {
            const { stdout, stderr } = await execAsync(command, {
                cwd: context.projectPath,
                env: { ...process.env, NO_COLOR: "1" },
            });

            return {
                success: true,
                output: stdout || stderr,
            };
        } catch (error: unknown) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    },
};

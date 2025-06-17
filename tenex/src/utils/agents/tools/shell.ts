import { spawn } from "node:child_process";
import type { ToolContext, ToolDefinition } from "@/utils/agents/tools/types";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";

export const shellTool: ToolDefinition = {
    name: "shell",
    description:
        "Execute shell commands with real-time output streaming via ephemeral Nostr events",
    parameters: [
        {
            name: "command",
            type: "string",
            description: "The shell command to execute",
            required: true,
        },
        {
            name: "cwd",
            type: "string",
            description:
                "The working directory to execute the command in (defaults to current directory)",
            required: false,
        },
    ],
    execute: async (params, context?: ToolContext) => {
        try {
            if (!context) {
                return {
                    success: false,
                    output: "",
                    error: "Missing required context for shell tool",
                };
            }

            const { ndk, conversationId, projectEvent } = context;
            const { command, cwd = process.cwd() } = params;

            // Generate unique execution ID
            const executionId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

            // Create initial event for command execution start
            const startEvent = new NDKEvent(ndk);
            startEvent.kind = 24200;
            startEvent.content = JSON.stringify({
                type: "command_start",
                command,
                cwd,
                timestamp: Date.now(),
                executionId,
            });

            // Add project reference if available
            if (projectEvent) {
                startEvent.tags.push(["a", projectEvent.tagId()]);
            }

            // Add conversation/thread reference
            if (conversationId) {
                startEvent.tags.push(["e", conversationId]);
            }

            await startEvent.publish();

            return new Promise((resolve) => {
                const output: string[] = [];
                const errors: string[] = [];

                // Spawn the process
                const child = spawn(command as string, [], {
                    shell: true,
                    cwd: cwd as string | undefined,
                    env: process.env,
                });

                // Handle stdout
                child.stdout.on("data", async (data: Buffer) => {
                    const chunk = data.toString();
                    output.push(chunk);

                    // Publish stdout event
                    const stdoutEvent = new NDKEvent(ndk);
                    stdoutEvent.kind = 24200;
                    stdoutEvent.content = JSON.stringify({
                        type: "stdout",
                        data: chunk,
                        timestamp: Date.now(),
                        executionId,
                    });

                    if (projectEvent) {
                        stdoutEvent.tags.push(["a", projectEvent.tagId()]);
                    }
                    if (conversationId) {
                        stdoutEvent.tags.push(["e", conversationId]);
                    }

                    await stdoutEvent.publish();
                });

                // Handle stderr
                child.stderr.on("data", async (data: Buffer) => {
                    const chunk = data.toString();
                    errors.push(chunk);

                    // Publish stderr event
                    const stderrEvent = new NDKEvent(ndk);
                    stderrEvent.kind = 24200;
                    stderrEvent.content = JSON.stringify({
                        type: "stderr",
                        data: chunk,
                        timestamp: Date.now(),
                        executionId,
                    });

                    if (projectEvent) {
                        stderrEvent.tags.push(["a", projectEvent.tagId()]);
                    }
                    if (conversationId) {
                        stderrEvent.tags.push(["e", conversationId]);
                    }

                    await stderrEvent.publish();
                });

                // Handle process exit
                child.on("close", async (code: number | null) => {
                    // Publish completion event
                    const completeEvent = new NDKEvent(ndk);
                    completeEvent.kind = 24200;
                    completeEvent.content = JSON.stringify({
                        type: "command_complete",
                        command,
                        cwd,
                        exitCode: code,
                        timestamp: Date.now(),
                        executionId,
                    });

                    if (projectEvent) {
                        completeEvent.tags.push(["a", projectEvent.tagId()]);
                    }
                    if (conversationId) {
                        completeEvent.tags.push(["e", conversationId]);
                    }

                    await completeEvent.publish();

                    const fullOutput = output.join("");
                    const fullErrors = errors.join("");

                    logger.info(`Shell command completed: ${command}`, {
                        exitCode: code,
                        outputLength: fullOutput.length,
                        errorLength: fullErrors.length,
                    });

                    resolve({
                        success: code === 0,
                        output: fullOutput,
                        error: fullErrors,
                    });
                });

                // Handle process errors
                child.on("error", async (error: Error) => {
                    // Publish error event
                    const errorEvent = new NDKEvent(ndk);
                    errorEvent.kind = 24200;
                    errorEvent.content = JSON.stringify({
                        type: "command_error",
                        command,
                        cwd,
                        error: error.message,
                        timestamp: Date.now(),
                        executionId,
                    });

                    if (projectEvent) {
                        errorEvent.tags.push(["a", projectEvent.tagId()]);
                    }
                    if (conversationId) {
                        errorEvent.tags.push(["e", conversationId]);
                    }

                    await errorEvent.publish();

                    logger.error(`Shell command error: ${command}`, { error });

                    resolve({
                        success: false,
                        output: output.join(""),
                        error: `Failed to execute command: ${error.message}`,
                    });
                });
            });
        } catch (error) {
            logger.error("Shell tool error", { error });
            return {
                success: false,
                output: "",
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    },
};

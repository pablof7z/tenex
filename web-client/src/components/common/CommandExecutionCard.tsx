import type { NDKKind } from "@nostr-dev-kit/ndk";
import { useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";
import { Card } from "../ui/card";

interface CommandData {
    type: "command_start" | "stdout" | "stderr" | "command_complete" | "command_error";
    command?: string;
    cwd?: string;
    data?: string;
    exitCode?: number;
    error?: string;
    timestamp: number;
    executionId?: string;
}

interface CommandExecutionCardProps {
    projectId: string;
    conversationId?: string;
}

export function CommandExecutionCard({ projectId, conversationId }: CommandExecutionCardProps) {
    const [executions, setExecutions] = useState<
        Map<
            string,
            {
                command: string;
                cwd: string;
                output: string[];
                errors: string[];
                status: "running" | "completed" | "error";
                exitCode?: number;
                startTime: number;
            }
        >
    >(new Map());

    // Subscribe to command execution events
    const { events } = useSubscribe([
        {
            kinds: [24200 as NDKKind],
            "#a": [projectId],
            ...(conversationId ? { "#e": [conversationId] } : {}),
        },
    ]);

    useEffect(() => {
        for (const event of events) {
            try {
                const data: CommandData = JSON.parse(event.content);

                if (data.type === "command_start" && data.command) {
                    // Start new execution
                    const key = data.executionId || `${data.command}-${data.timestamp}`;
                    setExecutions((prev) => {
                        const next = new Map(prev);
                        next.set(key, {
                            command: data.command!,
                            cwd: data.cwd || process.cwd(),
                            output: [],
                            errors: [],
                            status: "running",
                            startTime: data.timestamp,
                        });
                        return next;
                    });
                } else {
                    // Update existing execution
                    setExecutions((prev) => {
                        const next = new Map(prev);

                        // Find the execution this event belongs to
                        let targetExec = null;

                        if (data.executionId) {
                            // Use executionId if available
                            targetExec = next.get(data.executionId);
                        } else {
                            // Fallback: find the most recent execution
                            for (const [, exec] of next) {
                                if (data.timestamp >= exec.startTime) {
                                    targetExec = exec;
                                }
                            }
                        }

                        if (targetExec) {
                            switch (data.type) {
                                case "stdout":
                                    if (data.data) {
                                        targetExec.output.push(data.data);
                                    }
                                    break;
                                case "stderr":
                                    if (data.data) {
                                        targetExec.errors.push(data.data);
                                    }
                                    break;
                                case "command_complete":
                                    targetExec.status = "completed";
                                    targetExec.exitCode = data.exitCode;
                                    break;
                                case "command_error":
                                    targetExec.status = "error";
                                    if (data.error) {
                                        targetExec.errors.push(data.error);
                                    }
                                    break;
                            }
                        }

                        return next;
                    });
                }
            } catch (error) {
                console.error("Failed to parse command event:", error);
            }
        }
    }, [events]);

    if (executions.size === 0) {
        return null;
    }

    return (
        <div className="space-y-3">
            {Array.from(executions.entries()).map(([executionId, exec]) => (
                <Card key={executionId} className="p-4">
                    <div className="flex items-start gap-3">
                        <div
                            className={cn(
                                "p-2 rounded-lg",
                                exec.status === "running" && "bg-blue-100 text-blue-700",
                                exec.status === "completed" &&
                                    exec.exitCode === 0 &&
                                    "bg-green-100 text-green-700",
                                exec.status === "completed" &&
                                    exec.exitCode !== 0 &&
                                    "bg-red-100 text-red-700",
                                exec.status === "error" && "bg-red-100 text-red-700"
                            )}
                        >
                            <Terminal className="h-4 w-4" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <code className="text-sm font-mono font-semibold">
                                    {exec.command}
                                </code>
                                {exec.status === "running" && (
                                    <span className="text-xs text-muted-foreground animate-pulse">
                                        Running...
                                    </span>
                                )}
                                {exec.status === "completed" && (
                                    <span
                                        className={cn(
                                            "text-xs",
                                            exec.exitCode === 0 ? "text-green-600" : "text-red-600"
                                        )}
                                    >
                                        Exit code: {exec.exitCode}
                                    </span>
                                )}
                            </div>

                            <div className="text-xs text-muted-foreground mb-2">{exec.cwd}</div>

                            {(exec.output.length > 0 || exec.errors.length > 0) && (
                                <div className="mt-2 bg-gray-900 text-gray-100 rounded-md p-3 max-h-80 overflow-y-auto">
                                    <pre className="text-xs font-mono whitespace-pre-wrap">
                                        {exec.output.join("")}
                                        {exec.errors.length > 0 && (
                                            <span className="text-red-400">
                                                {exec.errors.join("")}
                                            </span>
                                        )}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
}

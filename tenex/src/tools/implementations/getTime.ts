import type { Tool, ToolExecutionContext, ToolResult } from "../types";

export const getTimeTool: Tool = {
    name: "get_time",
    description: "Get the current date and time in ISO 8601 format",
    parameters: [], // No parameters needed

    async execute(
        _params: Record<string, unknown>,
        _context: ToolExecutionContext
    ): Promise<ToolResult> {
        const now = new Date();
        return {
            success: true,
            output: now.toISOString(),
        };
    },
};

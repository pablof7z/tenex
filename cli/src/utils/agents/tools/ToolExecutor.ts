import type { ToolRegistry } from "./ToolRegistry";
import type { ToolCall, ToolContext, ToolResponse, ToolResult } from "./types";

export class ToolExecutor {
    constructor(private registry: ToolRegistry) {}

    // Execute a single tool call
    async executeTool(toolCall: ToolCall, context?: ToolContext): Promise<ToolResponse> {
        const tool = this.registry.getTool(toolCall.name);

        if (!tool) {
            return {
                tool_call_id: toolCall.id,
                output: `Error: Tool '${toolCall.name}' not found`,
            };
        }

        try {
            // Validate required parameters
            const missingParams = tool.parameters
                .filter((p) => p.required !== false)
                .filter((p) => !(p.name in toolCall.arguments))
                .map((p) => p.name);

            if (missingParams.length > 0) {
                return {
                    tool_call_id: toolCall.id,
                    output: `Error: Missing required parameters: ${missingParams.join(", ")}`,
                };
            }

            // Execute the tool
            const result = await tool.execute(toolCall.arguments, context);

            // Check if the result has a renderInChat property
            const response: ToolResponse = {
                tool_call_id: toolCall.id,
                output: result.success
                    ? result.output
                    : `Error: ${result.error || "Unknown error"}`,
            };

            // Pass through renderInChat if present
            if (result.success && "renderInChat" in result && result.renderInChat) {
                response.renderInChat = result.renderInChat;
            }

            return response;
        } catch (error) {
            return {
                tool_call_id: toolCall.id,
                output: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            };
        }
    }

    // Execute multiple tool calls in parallel
    async executeTools(toolCalls: ToolCall[], context?: ToolContext): Promise<ToolResponse[]> {
        const promises = toolCalls.map((call) => this.executeTool(call, context));
        return Promise.all(promises);
    }

    // Format tool responses for inclusion in conversation
    formatToolResponses(responses: ToolResponse[]): string {
        if (responses.length === 0) {
            return "";
        }

        let formatted = "\n\nTool Results:\n";
        for (const response of responses) {
            formatted += `\n<tool_response id="${response.tool_call_id}">\n`;
            formatted += response.output;
            formatted += "\n</tool_response>\n";
        }

        return formatted;
    }
}

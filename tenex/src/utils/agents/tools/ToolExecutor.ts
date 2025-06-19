import type { ToolRegistry } from "@/utils/agents/tools/ToolRegistry";
import type { ToolCall, ToolContext, ToolResponse, ToolResult } from "@/utils/agents/tools/types";

export class ToolExecutor {
    constructor(private registry: ToolRegistry) {}

    // Execute a single tool call
    async executeTool(toolCall: ToolCall, context?: ToolContext): Promise<ToolResponse> {
        let tool = this.registry.getTool(toolCall.name);
        let actualToolName = toolCall.name;

        // If tool not found, try fuzzy matching for common prefixes
        if (!tool) {
            const commonPrefixes = ['default_api.', 'api.', 'tools.'];
            
            for (const prefix of commonPrefixes) {
                if (toolCall.name.startsWith(prefix)) {
                    const cleanName = toolCall.name.slice(prefix.length);
                    const cleanTool = this.registry.getTool(cleanName);
                    
                    if (cleanTool) {
                        tool = cleanTool;
                        actualToolName = cleanName;
                        console.warn(`Tool called with unexpected prefix '${prefix}'. Using '${cleanName}' instead.`);
                        break;
                    }
                }
            }
        }

        if (!tool) {
            const availableTools = this.registry.getAllTools().map(t => t.name).join(', ');
            return {
                tool_call_id: toolCall.id,
                output: `Error: Tool '${toolCall.name}' not found. Available tools: ${availableTools}`,
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
                response.renderInChat = result.renderInChat as { type: string; data: unknown };
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

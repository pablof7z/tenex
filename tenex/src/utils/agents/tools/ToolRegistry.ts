import type {
    AnthropicToolFormat,
    JSONSchema,
    OpenAIToolFormat,
    ToolDefinition,
    ToolParameter,
} from "./types";

export class ToolRegistry {
    private tools: Map<string, ToolDefinition> = new Map();

    register(tool: ToolDefinition): void {
        if (this.tools.has(tool.name)) {
            throw new Error(`Tool '${tool.name}' is already registered`);
        }
        this.tools.set(tool.name, tool);
    }

    unregister(toolName: string): void {
        this.tools.delete(toolName);
    }

    getTool(toolName: string): ToolDefinition | undefined {
        return this.tools.get(toolName);
    }

    getAllTools(): ToolDefinition[] {
        return Array.from(this.tools.values());
    }

    // Generate system prompt explaining available tools
    generateSystemPrompt(): string {
        const tools = this.getAllTools();
        if (tools.length === 0) {
            return "";
        }

        let prompt = "You have access to the following tools:\n\n";

        // Add special instructions for spec tools if available
        const updateSpecTool = tools.find((t) => t.name === "update_spec");
        const readSpecsTool = tools.find((t) => t.name === "read_specs");
        if (updateSpecTool || readSpecsTool) {
            prompt += "📖 SPECIFICATION MANAGEMENT:\n";
            if (updateSpecTool) {
                prompt +=
                    '- When system architecture, requirements, or implementation details change, update SPEC.md using "update_spec"\n';
                prompt +=
                    "- Keep SPEC.md as a living document that reflects the CURRENT state, not historical changes\n";
            }
            prompt += "\n";
        }

        for (const tool of tools) {
            prompt += `Tool: ${tool.name}\n`;
            prompt += `Description: ${tool.description}\n`;
            prompt += "Parameters:\n";

            for (const param of tool.parameters) {
                prompt += `  - ${param.name} (${param.type}${param.required ? ", required" : ""}): ${param.description}\n`;
                if (param.enum) {
                    prompt += `    Allowed values: ${param.enum.join(", ")}\n`;
                }
            }
            prompt += "\n";
        }

        prompt += `To use a tool, respond with a JSON block in this format:
<tool_use>
{
  "tool": "tool_name",
  "arguments": {
    "param1": "value1",
    "param2": "value2"
  }
}
</tool_use>

You can use multiple tools in a single response by including multiple <tool_use> blocks.`;

        return prompt;
    }

    // Convert to Anthropic tool format
    toAnthropicFormat(): AnthropicToolFormat[] {
        return this.getAllTools().map((tool) => ({
            name: tool.name,
            description: tool.description,
            input_schema: {
                type: "object" as const,
                properties: this.parametersToSchema(tool.parameters),
                required: tool.parameters.filter((p) => p.required !== false).map((p) => p.name),
            },
        }));
    }

    // Convert to OpenAI function format
    toOpenAIFormat(): OpenAIToolFormat[] {
        return this.getAllTools().map((tool) => ({
            type: "function" as const,
            function: {
                name: tool.name,
                description: tool.description,
                parameters: {
                    type: "object" as const,
                    properties: this.parametersToSchema(tool.parameters),
                    required: tool.parameters
                        .filter((p) => p.required !== false)
                        .map((p) => p.name),
                },
            },
        }));
    }

    private parametersToSchema(parameters: ToolParameter[]): Record<string, JSONSchema> {
        const schema: Record<string, JSONSchema> = {};

        for (const param of parameters) {
            const paramSchema: JSONSchema = {
                type: param.type,
                description: param.description,
            };

            if (param.enum) {
                paramSchema.enum = param.enum;
            }

            if (param.type === "object" && param.properties) {
                paramSchema.properties = this.parametersToSchema(
                    Object.entries(param.properties).map(([name, prop]) => ({
                        ...prop,
                        name,
                    }))
                );
            }

            if (param.type === "array" && param.items) {
                paramSchema.items = {
                    type: param.items.type,
                    description: param.items.description,
                };
            }

            schema[param.name] = paramSchema;
        }

        return schema;
    }
}

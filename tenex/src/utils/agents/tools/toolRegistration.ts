import type {
  AnthropicToolFormat,
  JSONSchema,
  OpenAIToolFormat,
  ToolDefinition,
  ToolParameter,
} from "@/utils/agents/tools/types";

// Global tool registry
const toolRegistry = new Map<string, ToolDefinition>();

export function registerTool(tool: ToolDefinition): void {
  if (toolRegistry.has(tool.name)) {
    throw new Error(`Tool '${tool.name}' is already registered`);
  }
  toolRegistry.set(tool.name, tool);
}

export function unregisterTool(toolName: string): void {
  toolRegistry.delete(toolName);
}

export function getTool(toolName: string): ToolDefinition | undefined {
  return toolRegistry.get(toolName);
}

export function getAllTools(): ToolDefinition[] {
  return Array.from(toolRegistry.values());
}

export function clearTools(): void {
  toolRegistry.clear();
}

// Generate system prompt explaining available tools
export function generateToolSystemPrompt(): string {
  const tools = getAllTools();
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

  prompt += `To use a tool, include a JSON block WITHIN your response content:
<tool_use>
{
  "tool": "tool_name",
  "arguments": {
    "param1": "value1",
    "param2": "value2"
  }
}
</tool_use>

Important:
- Place <tool_use> blocks within your CONTENT SECTION, not after the SIGNAL
- You can use multiple tools by including multiple <tool_use> blocks
- Continue your response naturally after each tool use
- The SIGNAL section should come AFTER all content and tool uses`;

  return prompt;
}

// Convert to Anthropic tool format
export function toAnthropicToolFormat(): AnthropicToolFormat[] {
  return getAllTools().map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: "object" as const,
      properties: parametersToSchema(tool.parameters),
      required: tool.parameters.filter((p) => p.required !== false).map((p) => p.name),
    },
  }));
}

// Convert to OpenAI function format
export function toOpenAIToolFormat(): OpenAIToolFormat[] {
  return getAllTools().map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object" as const,
        properties: parametersToSchema(tool.parameters),
        required: tool.parameters.filter((p) => p.required !== false).map((p) => p.name),
      },
    },
  }));
}

function parametersToSchema(parameters: ToolParameter[]): Record<string, JSONSchema> {
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
      paramSchema.properties = parametersToSchema(
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

// Backward compatibility: Create a ToolRegistry class that uses the functions
export class ToolRegistry {
  register(tool: ToolDefinition): void {
    registerTool(tool);
  }

  unregister(toolName: string): void {
    unregisterTool(toolName);
  }

  getTool(toolName: string): ToolDefinition | undefined {
    return getTool(toolName);
  }

  getAllTools(): ToolDefinition[] {
    return getAllTools();
  }

  generateSystemPrompt(): string {
    return generateToolSystemPrompt();
  }

  toAnthropicFormat(): AnthropicToolFormat[] {
    return toAnthropicToolFormat();
  }

  toOpenAIFormat(): OpenAIToolFormat[] {
    return toOpenAIToolFormat();
  }
}

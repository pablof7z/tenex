import type { Tool } from "@/tools/types";
import { createZodSchema, mcpSchemaToZod } from "@/tools/zod-schema";
import { logger } from "@/utils/logger";
import { z } from "zod";

interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: {
    properties?: Record<string, any>;
    required?: string[];
  };
}

/**
 * Converts an MCP tool definition to our type-safe tool system using Zod
 */
export function adaptMCPTool(
  mcpTool: MCPTool,
  serverName: string,
  executeFn: (args: Record<string, unknown>) => Promise<unknown>
): Tool {
  const namespacedName = `mcp__${serverName}__${mcpTool.name}`;

  // Convert MCP input schema to Zod schema
  const zodSchema = mcpTool.inputSchema ? mcpSchemaToZod(mcpTool.inputSchema) : z.object({});

  // Add description to the schema
  const schemaWithDescription = zodSchema.describe(`${mcpTool.name} parameters for ${serverName}`);

  // Create the parameter schema using our Zod adapter
  const parameters = createZodSchema(schemaWithDescription);

  // Create a Tool that wraps the MCP tool
  const tool: Tool<any, any> = {
    name: namespacedName,
    description: mcpTool.description || `Tool from ${serverName}`,
    parameters,

    execute: async (input) => {
        try {
          logger.debug(`Executing MCP tool: ${namespacedName}`, {
            serverName,
            toolName: mcpTool.name,
            args: input.value,
          });

          const result = await executeFn(input.value);

          return {
            ok: true,
            value: result,
          };
        } catch (error) {
          logger.error(`MCP tool execution failed: ${namespacedName}`, {
            serverName,
            toolName: mcpTool.name,
            error: error instanceof Error ? error.message : String(error),
          });

          return {
            ok: false,
            error: {
              kind: "execution" as const,
              tool: namespacedName,
              message: error instanceof Error ? error.message : String(error),
              cause: error,
            },
          };
        }
    },
  };

  return tool;
}

/**
 * Type-safe MCP tool with proper inference
 */
export interface TypedMCPTool<TInput extends z.ZodType<any>>
  extends Tool<z.infer<TInput>, any> {
  readonly inputSchema: TInput;
}

/**
 * Create a strongly-typed MCP tool
 */
export function createTypedMCPTool<TInput extends z.ZodType<any>>(config: {
  name: string;
  serverName: string;
  description?: string;
  inputSchema: TInput;
  execute: (args: z.infer<TInput>) => Promise<unknown>;
}): TypedMCPTool<TInput> {
  const namespacedName = `mcp__${config.serverName}__${config.name}`;

  const tool: TypedMCPTool<TInput> = {
    name: namespacedName,
    description: config.description || `Tool from ${config.serverName}`,
    parameters: createZodSchema(config.inputSchema),
    inputSchema: config.inputSchema,

    execute: async (input) => {
        try {
          logger.debug(`Executing typed MCP tool: ${namespacedName}`, {
            serverName: config.serverName,
            toolName: config.name,
            args: input.value,
          });

          const result = await config.execute(input.value);

          return {
            ok: true,
            value: result,
          };
        } catch (error) {
          logger.error(`Typed MCP tool execution failed: ${namespacedName}`, {
            serverName: config.serverName,
            toolName: config.name,
            error: error instanceof Error ? error.message : String(error),
          });

          return {
            ok: false,
            error: {
              kind: "execution" as const,
              tool: namespacedName,
              message: error instanceof Error ? error.message : String(error),
              cause: error,
            },
          };
        }
    },
  };

  return tool;
}

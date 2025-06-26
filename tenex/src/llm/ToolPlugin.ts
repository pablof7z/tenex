import { Plugin, type PluginExecutionContext } from "multi-llm-ts";
import type { Tool, ToolExecutionContext, PluginParameter } from "@/tools/types";

/**
 * Adapter that converts TENEX Tool to multi-llm-ts Plugin
 * Follows SRP: Only responsible for bridging between Tool and Plugin interfaces
 */
export class ToolPlugin extends Plugin {
    constructor(
        private readonly tool: Tool,
        private readonly tenexContext: ToolExecutionContext
    ) {
        super();
    }

    serializeInTools(): boolean {
        return true;
    }

    isEnabled(): boolean {
        return true;
    }

    getName(): string {
        return this.tool.name;
    }

    getDescription(): string {
        return this.tool.description;
    }

    getParameters(): PluginParameter[] {
        // Return parameters in the array format expected by multi-llm-ts
        return this.tool.parameters.map((param) => ({
            name: param.name,
            type: param.type,
            description: param.description,
            required: param.required,
            ...(param.enum ? { enum: param.enum } : {}),
        }));
    }

    getPreparationDescription(_tool: string): string {
        return `Preparing ${this.tool.name}...`;
    }

    getRunningDescription(_tool: string, args: Record<string, unknown>): string {
        const argsStr = Object.keys(args).length > 0 ? ` with ${JSON.stringify(args)}` : "";
        return `Running ${this.tool.name}${argsStr}`;
    }

    getCompletedDescription(_tool: string, _args: Record<string, unknown>, _results: unknown): string {
        return `Completed ${this.tool.name}`;
    }

    async execute(
        _context: PluginExecutionContext,
        parameters: Record<string, unknown>
    ): Promise<unknown> {
        // Execute the tool with TENEX context
        const result = await this.tool.execute(parameters, this.tenexContext);

        // Return the result directly - multi-llm-ts will handle it
        return result;
    }
}

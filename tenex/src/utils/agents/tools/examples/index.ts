import type { ToolDefinition } from "@/utils/agents/tools/types";

// Example tool: Get current time
export const getTimeTool: ToolDefinition = {
  name: "get_time",
  description: "Get the current time in various formats",
  parameters: [
    {
      name: "format",
      type: "string",
      description: "The time format",
      required: false,
      enum: ["iso", "unix", "locale"],
    },
  ],
  execute: async (params) => {
    const now = new Date();
    let output: string;

    switch (params.format) {
      case "unix":
        output = Math.floor(now.getTime() / 1000).toString();
        break;
      case "locale":
        output = now.toLocaleString();
        break;
      default:
        output = now.toISOString();
    }

    return {
      success: true,
      output,
    };
  },
};

// Export all example tools
export const exampleTools = [getTimeTool];

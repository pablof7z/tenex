import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";

interface ToolsFragmentArgs {
    tools: string[] | { name: string; description?: string }[];
}

export const toolsFragment: PromptFragment<ToolsFragmentArgs> = {
    id: "available-tools",
    priority: 30,
    template: ({ tools }) => {
        if (tools.length === 0) {
            return "";
        }

        const toolsList = tools.map((tool) => {
            if (typeof tool === "string") {
                return tool;
            }
            return tool.description ? `${tool.name} - ${tool.description}` : tool.name;
        });

        return `Available tools:\n${toolsList.map((t) => `- ${t}`).join("\n")}`;
    },
};

interface ToolContinuationArgs {
    processedContent: string;
}

export const toolContinuationFragment: PromptFragment<ToolContinuationArgs> = {
    id: "tool-continuation-prompt",
    priority: 50,
    template: ({ processedContent }) => {
        return `The tools in your previous response have been executed. Here are the results:\n\n${processedContent}\n\nBased on these results, please continue with your task.`;
    },
};

// Auto-register
fragmentRegistry.register(toolsFragment);
fragmentRegistry.register(toolContinuationFragment);

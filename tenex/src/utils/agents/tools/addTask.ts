import type { ToolContext, ToolDefinition } from "@/utils/agents/tools/types";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";
import { EVENT_KINDS } from "@tenex/types/events";

export const addTaskTool: ToolDefinition = {
    name: "add_task",
    description:
        "Publish a task to the project, making it visible to all agents and users. Use this to create structured development tasks.",
    parameters: [
        {
            name: "title",
            type: "string",
            description: "A concise title for the task",
            required: true,
        },
        {
            name: "explanation",
            type: "string",
            description:
                "Detailed explanation of what needs to be done, including context and requirements",
            required: true,
        },
        {
            name: "estimated_complexity",
            type: "number",
            description: "Estimated complexity from 1 (simple) to 10 (very complex)",
            required: true,
        },
    ],
    execute: async (params, context?: ToolContext) => {
        try {
            if (!context) {
                return {
                    success: false,
                    output: "",
                    error: "Missing required context for add_task tool",
                };
            }

            if (!context.agent) {
                return {
                    success: false,
                    output: "",
                    error: "Missing agent in context for add_task tool",
                };
            }

            const { ndk, agent, projectEvent } = context;

            // Validate complexity range
            const complexity = Number(params.estimated_complexity);
            if (complexity < 1 || complexity > 10 || !Number.isInteger(complexity)) {
                return {
                    success: false,
                    output: "",
                    error: "estimated_complexity must be an integer between 1 and 10",
                };
            }

            // Create the task event
            const taskEvent = new NDKEvent(ndk);
            taskEvent.kind = EVENT_KINDS.TASK;
            taskEvent.content = String(params.explanation);

            // Add tags
            taskEvent.tags.push(["title", String(params.title)]);
            taskEvent.tags.push(["complexity", complexity.toString()]);

            // Add project reference
            taskEvent.tag(projectEvent);

            // Add thread reference if we're in a conversation
            if (context.conversationId) {
                taskEvent.tags.push(["e", context.conversationId, "", "root"]);
            }

            // Sign and publish
            await taskEvent.sign(agent.getSigner());
            await taskEvent.publish();

            logger.info(
                `Agent '${context.agentName}' created task: ${String(params.title)} (complexity: ${complexity})`
            );

            return {
                success: true,
                output: `Task created successfully: "${String(params.title)}" with complexity ${complexity}/10`,
            };
        } catch (error) {
            logger.error(`Failed to create task: ${error}`);
            return {
                success: false,
                output: "",
                error: error instanceof Error ? error.message : "Failed to create task",
            };
        }
    },
};

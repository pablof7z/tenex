import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    addGitCommitDetailsCommand,
    addGitResetToCommitCommand,
    addGitValidateCommitCommand,
} from "../logic/git-reset.js";
import {
    addPublishCommand,
    addPublishTaskStatusUpdateCommand,
    addPublishTypingIndicatorCommand,
} from "../logic/publish.js";
import { addRememberLessonCommand } from "../logic/remember-lesson.js";
import { getConfig } from "../config.js";
import { log } from "../utils/log.js";

// Define the MCP server instance
const mcpServer = new McpServer({
    name: "tenex",
    version: "0.5.0",
    capabilities: {
        resources: {},
    },
});

// Function to start the MCP server
export async function startMcpServer(): Promise<void> {
    try {
        // Register publish commands
        addPublishCommand(mcpServer);
        addPublishTaskStatusUpdateCommand(mcpServer);
        addPublishTypingIndicatorCommand(mcpServer);

        // Register git reset commands
        addGitResetToCommitCommand(mcpServer);
        addGitCommitDetailsCommand(mcpServer);
        addGitValidateCommitCommand(mcpServer);

        // Register remember_lesson command only if AGENT_EVENT_ID is set
        const config = await getConfig();
        if (config.agentEventId) {
            addRememberLessonCommand(mcpServer);
            log("remember_lesson tool registered (AGENT_EVENT_ID is set)");
        }

        // Connect the server to the transport
        log("Starting tenex MCP server...");
        const transport = new StdioServerTransport();
        await mcpServer.connect(transport);
        log("tenex MCP server connected.");
    } catch (error) {
        console.error("Error starting tenex MCP server:", error);
        process.exit(1);
    }
}

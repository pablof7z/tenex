import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    addPublishCommand,
    addPublishTaskStatusUpdateCommand,
} from "../logic/publish.js";
import { log } from "../utils/log.js";

// Define the MCP server instance
const mcpServer = new McpServer({
    name: "tenex", // Renamed server
    version: "0.1.0", // Simplified version
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

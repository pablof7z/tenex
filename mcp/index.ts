import { startMcpServer } from "./commands/mcp.js";
import { initConfig } from "./config.js";
import { initNDK } from "./ndk.js";

// Load config (will be modified to load env var)
const config = initConfig();

// Initialize NDK with the loaded configuration
// This assumes initNDK will handle the case where the key comes from env
initNDK(config);

// Directly run the MCP server
startMcpServer();

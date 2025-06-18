#!/usr/bin/env bun

import { logger } from "@tenex/shared/logger";

// Test different modules and verbosity levels
console.log("=== Testing TENEX Logging System ===\n");

// General logging
console.log("1. General logging (always shows):");
logger.info("This is a general info message");
logger.warning("This is a warning message");
logger.error("This is an error message");

// Module-specific logging
console.log("\n2. Module-specific logging:");

const agentLogger = logger.forModule("agent");
agentLogger.info("Agent starting (normal verbosity)");
agentLogger.info("Agent processing details", "verbose");
agentLogger.debug("Agent debug info", "debug");

const teamLogger = logger.forModule("team");
teamLogger.info("Team formed (normal verbosity)");
teamLogger.info("Team coordination details", "verbose");
teamLogger.debug("Team debug info", "debug");

const llmLogger = logger.forModule("llm");
llmLogger.info("LLM request (normal verbosity)");
llmLogger.info("LLM configuration details", "verbose");
llmLogger.debug("LLM prompts and responses", "debug");

const conversationLogger = logger.forModule("conversation");
conversationLogger.info("Conversation started (normal verbosity)");
conversationLogger.info("Speaker selection details", "verbose");
conversationLogger.debug("Turn management debug", "debug");

// Agent logger with context
console.log("\n3. Agent logger with context:");
const contextualLogger = logger.createAgent("TestAgent", "TestProject");
contextualLogger.setModule("agent");
contextualLogger.info("Agent message with context");
contextualLogger.info("Detailed agent operation", "verbose");

console.log("\n=== Configuration ===");
console.log(`LOG_LEVEL: ${process.env.LOG_LEVEL || "normal"}`);
console.log(`LOG_MODULE_AGENT: ${process.env.LOG_MODULE_AGENT || "default"}`);
console.log(`LOG_MODULE_TEAM: ${process.env.LOG_MODULE_TEAM || "default"}`);
console.log(`LOG_MODULE_LLM: ${process.env.LOG_MODULE_LLM || "default"}`);
console.log(`LOG_MODULE_CONVERSATION: ${process.env.LOG_MODULE_CONVERSATION || "default"}`);

console.log("\n=== Test Complete ===");
console.log("\nTry running with different configurations:");
console.log("  LOG_LEVEL=verbose bun run scripts/test-logging.ts");
console.log("  LOG_MODULE_AGENT=debug LOG_MODULE_LLM=silent bun run scripts/test-logging.ts");
console.log("  LOG_LEVEL=silent bun run scripts/test-logging.ts");

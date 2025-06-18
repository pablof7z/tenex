/**
 * @tenex/types - Centralized type definitions for TENEX
 *
 * This package provides all shared TypeScript type definitions used across
 * the TENEX ecosystem, including web-client, CLI, MCP server, and tenexd.
 *
 * Note: This package does NOT re-wrap NDK event classes (NDKEvent, NDKArticle,
 * NDKAgent, etc). Use the @nostr-dev-kit/ndk library directly for those.
 * This package provides:
 * - Content structure interfaces
 * - Configuration types
 * - Metadata types
 * - Tool and LLM types
 * - Error handling utilities
 */

// Re-export all type modules
export * from "./agents/index.js";
export * from "./config/index.js";
export * from "./conversations/index.js";
export * from "./events/index.js";
export * from "./llm/index.js";
export * from "./projects/index.js";
export * from "./tools/index.js";
export * from "./utils/index.js";

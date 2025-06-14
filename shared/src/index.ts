// Main exports for @tenex/shared package
export * from "./config/index.js";
export * from "./logger.js";
export * from "./nostr.js";
export * from "./types/index.js";
export * from "./utils/business.js";

// Node.js specific exports - don't import these in browser environments
// export * from "./projects.js"; // Contains fs imports
// export * from "./agents/index.js"; // May contain fs imports
// export * from "./fs/index.js"; // Contains Node.js fs module

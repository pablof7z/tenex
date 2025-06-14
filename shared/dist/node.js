// Node.js specific exports for @tenex/shared package
// Only import this in Node.js environments (CLI, MCP, tenexd)
export * from "./index.js"; // Re-export all browser-safe exports
export * from "./projects.js";
export * from "./agents/index.js";
export * from "./fs/index.js";
// Export fileSystem object for backward compatibility
import * as fileSystemUtils from "./fs/filesystem.js";
export const fileSystem = fileSystemUtils;
//# sourceMappingURL=node.js.map
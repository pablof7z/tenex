// Main exports for @tenex/shared package - browser-safe only
export * from "./utils/business.js";
export * from "./types/index.js";
export * from "./logger.js";
export * from "./config/relays.js"; // Only export relays, not the full config module

// Node.js specific exports are not included in the main export
// Import them directly from subpaths if needed:
// import { ProjectService } from "@tenex/shared/projects"
// import { FileSystem } from "@tenex/shared/fs"
// import { ConfigLoader } from "@tenex/shared/config"

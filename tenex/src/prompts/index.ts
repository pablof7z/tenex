// Export core functionality
export { PromptBuilder } from "./core/PromptBuilder";
export { FragmentRegistry, fragmentRegistry } from "./core/FragmentRegistry";
export type { PromptFragment, FragmentConfig } from "./core/types";

// Export template builders
export * from "./templates";

// Import all fragments to ensure they're registered when the module is imported
import "./fragments/agentFragments";
import "./fragments/available-agents";
import "./fragments/execute-task-prompt";
import "./fragments/inventory";
import "./fragments/learn-tool";
import "./fragments/mcp-tools";
import "./fragments/phase";
import "./fragments/pm-routing";
import "./fragments/project";
import "./fragments/retrieved-lessons";

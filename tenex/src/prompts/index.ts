// Export core functionality
export { PromptBuilder } from "./core/PromptBuilder";
export { FragmentRegistry, fragmentRegistry } from "./core/FragmentRegistry";
export type { PromptFragment, FragmentConfig } from "./core/types";

// Export template builders
export * from "./templates";

// Import all fragments to ensure they're registered when the module is imported
import "./fragments/agentFragments";
import "./fragments/available-agents";
import "./fragments/context";
import "./fragments/execute-task-prompt";
import "./fragments/generic";
import "./fragments/phase";
import "./fragments/phase-prompts";
import "./fragments/pm-routing";
import "./fragments/project";
import "./fragments/tools";

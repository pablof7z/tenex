// Export core functionality
export { PromptBuilder } from "./core/PromptBuilder";
export { FragmentRegistry, fragmentRegistry } from "./core/FragmentRegistry";
export type { PromptFragment, FragmentConfig } from "./core/types";

// Export template builders
export * from "./templates";

// Import all fragments to ensure they're registered when the module is imported
import "./fragments/agent";
import "./fragments/agent-specific";
import "./fragments/common";
import "./fragments/context";
import "./fragments/generic";
import "./fragments/project";
import "./fragments/routing";
import "./fragments/tools";

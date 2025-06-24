// Re-exports for functional approach - prefer direct imports from utils
export { createExecutionBranch } from "@/utils/git/createExecutionBranch";
export { executeClaudeCode } from "@/utils/claude/executeClaudeCode";

// Re-export types
export type { GitBranchResult } from "@/utils/git/createExecutionBranch";
export type { 
    ClaudeExecutionOptions, 
    ClaudeExecutionResult 
} from "@/utils/claude/executeClaudeCode";

// Import the core tool types from the centralized location
import type { 
  ToolInvocation, 
  ToolExecutionContext, 
  ToolExecutionResult, 
  ToolExecutor 
} from "@/types/tool";

// Tool parameter types
export type ShellToolParameters = {
  command: string;
};

export type FileReadParameters = {
  path: string;
};

export type FileWriteParameters = {
  path: string;
  content: string;
};

export type FileEditParameters = {
  path: string;
  oldContent: string;
  newContent: string;
};

export type FileToolParameters = 
  | FileReadParameters 
  | FileWriteParameters 
  | FileEditParameters;

export type ClaudeCodeToolParameters = {
  mode: "run" | "plan";
  prompt: string;
};

export type ToolParameters = 
  | ShellToolParameters 
  | FileToolParameters 
  | ClaudeCodeToolParameters
  | Record<string, string | number | boolean>;

// Tool execution result types
export type ToolOutput = 
  | string          // Command output, file content
  | number          // Exit codes, file sizes
  | boolean         // Success flags
  | object          // Structured data
  | null;

export interface ToolExecutionMetadata {
  exitCode?: number;
  fileSize?: number;
  encoding?: string;
  mimeType?: string;
  duration?: number;
  [key: string]: string | number | boolean | undefined;
}

// Re-export the core tool types for backwards compatibility
export type { 
  ToolInvocation, 
  ToolExecutionContext, 
  ToolExecutionResult, 
  ToolExecutor 
};

export interface ToolPattern {
  pattern: RegExp;
  parser: (match: RegExpMatchArray) => ToolInvocation | null;
}

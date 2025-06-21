export interface ToolInvocation {
  toolName: string;
  action: string;
  parameters: Record<string, any>;
  rawMatch: string;
}

export interface ToolExecutionContext {
  projectPath: string;
  conversationId: string;
  agentName: string;
  phase: string;
}

export interface ToolExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  duration: number;
  metadata?: Record<string, any>;
}

export interface ToolExecutor {
  name: string;
  execute(invocation: ToolInvocation, context: ToolExecutionContext): Promise<ToolExecutionResult>;
  canExecute(toolName: string): boolean;
}

export interface ToolPattern {
  pattern: RegExp;
  parser: (match: RegExpMatchArray) => ToolInvocation | null;
}

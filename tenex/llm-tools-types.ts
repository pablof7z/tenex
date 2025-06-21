export interface FunctionCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface TimeToolArguments {
  timezone?: string;
  format?: "12h" | "24h";
}

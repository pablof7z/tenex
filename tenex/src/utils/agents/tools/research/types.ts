export interface ResearchOptions {
  query: string;
  projectPath?: string;
  outputFormat?: "markdown" | "stream-json";
  verbose?: boolean;
}

export interface ResearchMessage {
  type: "status" | "result" | "error" | "progress";
  message?: string;
  result?: string;
  is_error?: boolean;
  timestamp?: string;
}

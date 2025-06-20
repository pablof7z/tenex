export interface ClaudeCodeMessage {
  type: "assistant" | "user" | "tool_use" | "result" | "system";
  message?: {
    id: string;
    type: string;
    role: string;
    model: string;
    content: Array<{
      type: "text";
      text: string;
    }>;
    stop_reason: string | null;
    stop_sequence: string | null;
    usage: {
      input_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
      output_tokens: number;
      service_tier?: string;
    };
  };
  tool_use?: {
    id: string;
    name: string;
    input: unknown;
  };
  parent_tool_use_id?: string | null;
  session_id?: string;
  subtype?: "success" | "error";
  cost_usd?: number;
  is_error?: boolean;
  duration_ms?: number;
  duration_api_ms?: number;
  num_turns?: number;
  result?: string;
  total_cost?: number;
  usage?: {
    input_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    output_tokens: number;
    server_tool_use?: {
      web_search_requests: number;
    };
  };
}

export interface ClaudeCodeOptions {
  prompt: string;
  verbose?: boolean;
  outputFormat?: "stream-json";
  dangerouslySkipPermissions?: boolean;
  projectPath?: string;
  claudeSessionId?: string;
}

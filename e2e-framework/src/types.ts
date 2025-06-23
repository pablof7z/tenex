import type { NDKEvent } from '@nostr-dev-kit/ndk';

export interface ProjectOptions {
  name: string;
  description?: string;
  template?: string;
  agents?: string[];
  instructions?: string[];
}

export interface ProjectInfo {
  naddr: string;
  name: string;
  description?: string;
}

export interface ConversationOptions {
  message: string;
  title?: string;
}

export interface WaitOptions {
  timeout?: number;
  content?: string;
}

export interface ReplyOptions {
  timeout?: number;
  validate?: (event: NDKEvent) => boolean;
}

export interface CompletionOptions {
  timeout?: number;
  indicators?: string[];
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ScenarioOptions {
  llmConfig?: LLMConfig;
  relays?: string[];
  debug?: boolean;
  logFile?: string;
}

export interface LLMConfig {
  provider: 'openai' | 'anthropic';
  model: string;
  apiKey?: string;
}

export interface TenexConfig {
  whitelistedPubkeys: string[];
  llmConfigs?: LLMConfig[];
}

export interface ScenarioResult {
  name: string;
  success: boolean;
  duration: number;
  error: Error | null;
}

export interface ScenarioConfig {
  llmProvider?: 'openai' | 'anthropic';
  llmModel?: string;
  timeout?: number;
  retries?: number;
}

export class TestError extends Error {
  constructor(
    message: string,
    public context: {
      scenario?: string;
      step?: string;
      project?: string;
      stdout?: string;
      stderr?: string;
    }
  ) {
    super(message);
    this.name = 'TestError';
  }
}
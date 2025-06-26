/**
 * Central configuration for the E2E testing framework
 */

export interface FrameworkConfig {
  // Timeouts
  timeouts: {
    default: number;
    fileWait: number;
    daemonStart: number;
    eventWait: number;
    processExit: number;
    conversationReply: number;
    conversationCompletion: number;
  };
  
  // Reserved for future use
  // polling section removed - using file watchers instead
  
  // Nostr configuration
  nostr: {
    defaultRelays: string[];
  };
  
  // CLI configuration
  cli: {
    path: string;
  };
  
  // Process configuration
  process: {
    killSignal: string;
  };
  
  // Test environment
  environment: {
    tempDirPrefix: string;
  };
  
  // Conversation configuration
  conversation: {
    completionIndicators: string[];
  };
}

// Default configuration values
export const DEFAULT_CONFIG: FrameworkConfig = {
  timeouts: {
    default: 30000,        // 30 seconds
    fileWait: 30000,       // 30 seconds
    daemonStart: 30000,    // 30 seconds
    eventWait: 30000,      // 30 seconds
    processExit: 30000,    // 30 seconds
    conversationReply: 30000,     // 30 seconds
    conversationCompletion: 60000 // 60 seconds
  },
  
  // Polling removed - using file system watchers instead
  
  nostr: {
    defaultRelays: [
      'ws://localhost:10547',
    ]
  },
  
  cli: {
    path: '../cli-client/src/index.ts'
  },
  
  process: {
    killSignal: 'SIGTERM'
  },
  
  environment: {
    tempDirPrefix: 'tenex-e2e-'
  },
  
  conversation: {
    completionIndicators: ['done', 'completed', 'finished', 'created', 'implemented']
  }
};

// Allow overriding via environment variables
export function loadConfig(): FrameworkConfig {
  const config = { ...DEFAULT_CONFIG };
  
  // Override from environment variables if present
  if (process.env['TENEX_E2E_DEFAULT_TIMEOUT']) {
    config.timeouts.default = parseInt(process.env['TENEX_E2E_DEFAULT_TIMEOUT']);
  }
  
  if (process.env['TENEX_E2E_DAEMON_TIMEOUT']) {
    config.timeouts.daemonStart = parseInt(process.env['TENEX_E2E_DAEMON_TIMEOUT']);
  }
  
  if (process.env['TENEX_E2E_RELAYS']) {
    config.nostr.defaultRelays = process.env['TENEX_E2E_RELAYS'].split(',');
  }
  
  if (process.env['TENEX_E2E_CLI_PATH']) {
    config.cli.path = process.env['TENEX_E2E_CLI_PATH'];
  }
  
  return config;
}

// Singleton instance
let configInstance: FrameworkConfig | null = null;

export function getConfig(): FrameworkConfig {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

// For testing - reset the singleton
export function resetConfig(): void {
  configInstance = null;
}
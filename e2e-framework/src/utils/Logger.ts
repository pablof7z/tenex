import { appendFile } from 'node:fs/promises';

/**
 * Log levels for structured logging.
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

/**
 * Log entry structure.
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: any;
}

/**
 * Logger configuration options.
 */
export interface LoggerOptions {
  /** Enable debug logging */
  debug?: boolean;
  /** Path to log file (if not provided, logs to console only) */
  logFile?: string;
  /** Component name for log entries */
  component?: string;
}

/**
 * Structured logger for the E2E framework.
 * Provides consistent logging format and supports both console and file output.
 * 
 * @example
 * ```typescript
 * const logger = new Logger({
 *   component: 'Orchestrator',
 *   debug: true,
 *   logFile: './test.log'
 * });
 * 
 * logger.info('Starting test scenario', { scenario: 'file-creation' });
 * logger.error('Test failed', { error: error.message });
 * ```
 */
export class Logger {
  private options: Required<LoggerOptions>;
  
  constructor(options: LoggerOptions = {}) {
    this.options = {
      debug: options.debug ?? false,
      logFile: options.logFile ?? '',
      component: options.component ?? 'E2E'
    };
  }
  
  /**
   * Creates a child logger with a specific component name.
   * 
   * @param component - Component name for the child logger
   * @returns A new logger instance
   */
  child(component: string): Logger {
    return new Logger({
      ...this.options,
      component: `${this.options.component}:${component}`
    });
  }
  
  /**
   * Logs a debug message.
   * Only logged if debug mode is enabled.
   */
  debug(message: string, data?: any): void {
    if (this.options.debug) {
      this.log(LogLevel.DEBUG, message, data);
    }
  }
  
  /**
   * Logs an info message.
   */
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }
  
  /**
   * Logs a warning message.
   */
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }
  
  /**
   * Logs an error message.
   */
  error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, message, data);
  }
  
  private async log(level: LogLevel, message: string, data?: any): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component: this.options.component,
      message,
      data
    };
    
    // Console output
    const color = this.getColor(level);
    const resetColor = '\x1b[0m';
    const formattedMessage = `${color}[${entry.timestamp}] [${entry.level}] [${entry.component}]${resetColor} ${message}`;
    
    console.log(formattedMessage);
    if (data !== undefined) {
      console.log(JSON.stringify(data, null, 2));
    }
    
    // File output
    if (this.options.logFile) {
      try {
        const logLine = JSON.stringify(entry) + '\n';
        await appendFile(this.options.logFile, logLine);
      } catch (error) {
        // Don't fail if logging fails, but warn about it
        console.warn(`Failed to write to log file: ${(error as Error).message}`);
      }
    }
  }
  
  private getColor(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: return '\x1b[36m'; // Cyan
      case LogLevel.INFO: return '\x1b[32m';  // Green
      case LogLevel.WARN: return '\x1b[33m';  // Yellow
      case LogLevel.ERROR: return '\x1b[31m'; // Red
      default: return '\x1b[0m';              // Reset
    }
  }
}

// Global logger instance
let globalLogger: Logger | null = null;

/**
 * Gets or creates the global logger instance.
 * 
 * @param options - Logger options (only used on first call)
 * @returns The global logger instance
 */
export function getLogger(options?: LoggerOptions): Logger {
  if (!globalLogger) {
    globalLogger = new Logger(options);
  }
  return globalLogger;
}

/**
 * Resets the global logger instance.
 * Useful for testing.
 */
export function resetLogger(): void {
  globalLogger = null;
}
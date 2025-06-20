import { logDebug, logError } from "@tenex/shared/logger";

export interface SafeJSONParseOptions {
  fallback?: any;
  logErrors?: boolean;
  context?: string;
}

/**
 * Safely parse JSON with error handling and optional fallback
 */
export function safeJSONParse<T = any>(
  content: string,
  options: SafeJSONParseOptions = {}
): T | undefined {
  const { fallback = undefined, logErrors = true, context } = options;

  try {
    return JSON.parse(content) as T;
  } catch (error) {
    if (logErrors) {
      const errorContext = context ? ` (${context})` : "";
      logDebug(`Failed to parse JSON${errorContext}: ${error}`);
    }
    return fallback;
  }
}

/**
 * Parse JSON and throw a descriptive error if it fails
 */
export function strictJSONParse<T = any>(content: string, context?: string): T {
  try {
    return JSON.parse(content) as T;
  } catch (error) {
    const errorContext = context ? ` in ${context}` : "";
    throw new Error(
      `Invalid JSON${errorContext}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Safely stringify JSON with error handling
 */
export function safeJSONStringify(
  value: any,
  replacer?: (key: string, value: any) => any,
  space?: string | number
): string | undefined {
  try {
    return JSON.stringify(value, replacer, space);
  } catch (error) {
    logError(`Failed to stringify JSON: ${error}`);
    return undefined;
  }
}

// TENEX CLI: Logger Utility
// Re-export from shared logger with CLI-specific configuration
import {
	configureLogger,
	logDebug as sharedLogDebug,
	logError as sharedLogError,
	logInfo as sharedLogInfo,
	logSuccess as sharedLogSuccess,
	logWarning as sharedLogWarning,
	logger as sharedLogger,
} from "@tenex/shared/logger";

// Configure logger for CLI (use labels instead of emojis)
configureLogger({ useEmoji: false, useLabels: true });

// Re-export functions for backward compatibility
export const logInfo = sharedLogInfo;
export const logError = sharedLogError;
export const logSuccess = sharedLogSuccess;
export const logWarning = sharedLogWarning;
export const logger = sharedLogger;

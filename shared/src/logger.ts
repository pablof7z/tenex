export interface LoggerConfig {
	useEmoji?: boolean;
	useLabels?: boolean;
}

let globalConfig: LoggerConfig = {
	useEmoji: true,
	useLabels: false,
};

export function configureLogger(config: Partial<LoggerConfig>): void {
	globalConfig = { ...globalConfig, ...config };
}

export function logError(message: string, error?: any): void {
	const prefix = globalConfig.useEmoji
		? "❌"
		: globalConfig.useLabels
			? "[ERROR]"
			: "";
	console.error(prefix ? `${prefix} ${message}` : message, error || "");
}

export function logInfo(message: string, ...args: any[]): void {
	const prefix = globalConfig.useEmoji
		? "ℹ️ "
		: globalConfig.useLabels
			? "[INFO]"
			: "";
	console.log(prefix ? `${prefix} ${message}` : message, ...args);
}

export function logSuccess(message: string): void {
	const prefix = globalConfig.useEmoji
		? "✅"
		: globalConfig.useLabels
			? "[SUCCESS]"
			: "";
	console.log(prefix ? `${prefix} ${message}` : message);
}

export function logWarning(message: string, ...args: any[]): void {
	const prefix = globalConfig.useEmoji
		? "⚠️ "
		: globalConfig.useLabels
			? "[WARNING]"
			: "";
	console.warn(prefix ? `${prefix} ${message}` : message, ...args);
}

export function logDebug(message: string, ...args: any[]): void {
	const prefix = globalConfig.useLabels ? "[DEBUG]" : "";
	console.log(prefix ? `${prefix} ${message}` : message, ...args);
}

// Export a logger object for compatibility
export const logger = {
	info: logInfo,
	error: logError,
	success: logSuccess,
	warn: logWarning,
	warning: logWarning,
	debug: logDebug,
};

import chalk from "chalk";

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

export function logError(message: string, error?: unknown): void {
	const prefix = globalConfig.useEmoji
		? "❌"
		: globalConfig.useLabels
			? "[ERROR]"
			: "";
	const fullMessage = prefix ? `${prefix} ${message}` : message;
	console.error(chalk.redBright(fullMessage), error || "");
}

export function logInfo(message: string, ...args: unknown[]): void {
	const prefix = globalConfig.useEmoji
		? "ℹ️"
		: globalConfig.useLabels
			? "[INFO]"
			: "";
	const fullMessage = prefix ? `${prefix} ${message}` : message;
	console.log(chalk.blueBright(fullMessage), ...args);
}

export function logSuccess(message: string): void {
	const prefix = globalConfig.useEmoji
		? "✅"
		: globalConfig.useLabels
			? "[SUCCESS]"
			: "";
	const fullMessage = prefix ? `${prefix} ${message}` : message;
	console.log(chalk.greenBright(fullMessage));
}

export function logWarning(message: string, ...args: unknown[]): void {
	const prefix = globalConfig.useEmoji
		? "⚠️"
		: globalConfig.useLabels
			? "[WARNING]"
			: "";
	const fullMessage = prefix ? `${prefix} ${message}` : message;
	console.warn(chalk.yellowBright(fullMessage), ...args);
}

export function logDebug(message: string, ...args: unknown[]): void {
	const prefix = globalConfig.useEmoji
		? "🔍"
		: globalConfig.useLabels
			? "[DEBUG]"
			: "";
	const fullMessage = prefix ? `${prefix} ${message}` : message;
	console.log(chalk.magentaBright(fullMessage), ...args);
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

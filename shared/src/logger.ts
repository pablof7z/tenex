import chalk from "chalk";

export interface LoggerConfig {
    useEmoji?: boolean;
    useLabels?: boolean;
    debugEnabled?: boolean;
}

let globalConfig: LoggerConfig = {
    useEmoji: true,
    useLabels: false,
    debugEnabled: typeof process !== "undefined" && process.env?.DEBUG === "true",
};

export function configureLogger(config: Partial<LoggerConfig>): void {
    globalConfig = { ...globalConfig, ...config };
}

// Agent color assignment for consistent coloring
const agentColors = [
    chalk.red,
    chalk.green,
    chalk.yellow,
    chalk.blue,
    chalk.magenta,
    chalk.cyan,
    chalk.white,
    chalk.gray,
    chalk.redBright,
    chalk.greenBright,
    chalk.yellowBright,
    chalk.blueBright,
    chalk.magentaBright,
    chalk.cyanBright,
];

const agentColorMap = new Map<string, typeof chalk.red>();

function getAgentColor(agentName: string): typeof chalk.red {
    if (!agentColorMap.has(agentName)) {
        const index = agentColorMap.size % agentColors.length;
        const color = agentColors[index] || chalk.white;
        agentColorMap.set(agentName, color);
    }
    return agentColorMap.get(agentName) || chalk.white;
}

export function logError(message: string, error?: unknown): void {
    const prefix = globalConfig.useEmoji ? "❌" : globalConfig.useLabels ? "[ERROR]" : "";
    const fullMessage = prefix ? `${prefix} ${message}` : message;
    console.error(chalk.redBright(fullMessage), error || "");
}

export function logInfo(message: string, ...args: unknown[]): void {
    const prefix = globalConfig.useEmoji ? "ℹ️" : globalConfig.useLabels ? "[INFO]" : "";
    const fullMessage = prefix ? `${prefix} ${message}` : message;
    console.log(chalk.blueBright(fullMessage), ...args);
}

export function logSuccess(message: string): void {
    const prefix = globalConfig.useEmoji ? "✅" : globalConfig.useLabels ? "[SUCCESS]" : "";
    const fullMessage = prefix ? `${prefix} ${message}` : message;
    console.log(chalk.greenBright(fullMessage));
}

export function logWarning(message: string, ...args: unknown[]): void {
    const prefix = globalConfig.useEmoji ? "⚠️" : globalConfig.useLabels ? "[WARNING]" : "";
    const fullMessage = prefix ? `${prefix} ${message}` : message;
    console.warn(chalk.yellowBright(fullMessage), ...args);
}

export function logDebug(message: string, ...args: unknown[]): void {
    if (!globalConfig.debugEnabled) return;

    const prefix = globalConfig.useEmoji ? "🔍" : globalConfig.useLabels ? "[DEBUG]" : "";
    const fullMessage = prefix ? `${prefix} ${message}` : message;
    console.log(chalk.magentaBright(fullMessage), ...args);
}

// Agent Logger class for contextual logging
export class AgentLogger {
    private projectName?: string;
    private agentName: string;
    private color: typeof chalk.red;

    constructor(agentName: string, projectName?: string) {
        this.agentName = agentName;
        this.projectName = projectName;
        this.color = getAgentColor(agentName);
    }

    private formatMessage(emoji: string, message: string, colorFn: typeof chalk.red): string {
        const projectPrefix = this.projectName ? `${chalk.gray(`[${this.projectName}]`)} ` : "";
        const agentPrefix = `${this.color(`[${this.agentName}]`)} `;
        const emojiPrefix = globalConfig.useEmoji ? `${emoji} ` : "";
        const coloredMessage = colorFn(message);
        return `${projectPrefix}${agentPrefix}${emojiPrefix}${coloredMessage}`;
    }

    info(message: string, ...args: unknown[]): void {
        console.log(this.formatMessage("ℹ️", message, chalk.blueBright), ...args);
    }

    success(message: string, ...args: unknown[]): void {
        console.log(this.formatMessage("✅", message, chalk.greenBright), ...args);
    }

    warning(message: string, ...args: unknown[]): void {
        console.warn(this.formatMessage("⚠️", message, chalk.yellowBright), ...args);
    }

    error(message: string, error?: unknown): void {
        console.error(this.formatMessage("❌", message, chalk.redBright), error || "");
    }

    debug(message: string, ...args: unknown[]): void {
        if (globalConfig.debugEnabled) {
            console.log(this.formatMessage("🔍", message, chalk.magentaBright), ...args);
        }
    }
}

// Factory function for creating agent loggers
export function createAgentLogger(agentName: string, projectName?: string): AgentLogger {
    return new AgentLogger(agentName, projectName);
}

// Export a logger object for compatibility
export const logger = {
    info: logInfo,
    error: logError,
    success: logSuccess,
    warn: logWarning,
    warning: logWarning,
    debug: logDebug,
    createAgent: createAgentLogger,
};

import chalk from "chalk";

export type VerbosityLevel = "silent" | "normal" | "verbose" | "debug";

export type LogModule = 
    | "agent"
    | "team"
    | "conversation"
    | "llm"
    | "nostr"
    | "orchestration"
    | "tools"
    | "general";

export interface ModuleVerbosityConfig {
    default: VerbosityLevel;
    modules?: {
        [moduleName: string]: VerbosityLevel;
    };
}

export interface LoggerConfig {
    useEmoji?: boolean;
    useLabels?: boolean;
    debugEnabled?: boolean;
    moduleVerbosity?: ModuleVerbosityConfig;
}

const verbosityLevels: Record<VerbosityLevel, number> = {
    silent: 0,
    normal: 1,
    verbose: 2,
    debug: 3,
};

let globalConfig: LoggerConfig = {
    useEmoji: true,
    useLabels: false,
    debugEnabled: typeof process !== "undefined" && process.env?.DEBUG === "true",
    moduleVerbosity: parseModuleVerbosity(),
};

function parseModuleVerbosity(): ModuleVerbosityConfig {
    const config: ModuleVerbosityConfig = {
        default: (process.env?.LOG_LEVEL as VerbosityLevel) || "normal",
        modules: {},
    };

    // Parse module-specific verbosity from environment variables
    // Format: LOG_MODULE_<MODULE>=<level>
    // Example: LOG_MODULE_TEAM=debug LOG_MODULE_LLM=silent
    if (typeof process !== "undefined" && process.env) {
        Object.keys(process.env).forEach(key => {
            const match = key.match(/^LOG_MODULE_(.+)$/);
            if (match) {
                const moduleName = match[1].toLowerCase();
                const level = process.env[key] as VerbosityLevel;
                if (level && verbosityLevels[level] !== undefined) {
                    config.modules![moduleName] = level;
                }
            }
        });
    }

    return config;
}

export function configureLogger(config: Partial<LoggerConfig>): void {
    globalConfig = { ...globalConfig, ...config };
    if (!globalConfig.moduleVerbosity) {
        globalConfig.moduleVerbosity = parseModuleVerbosity();
    }
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

function shouldLog(level: string, module?: LogModule, verbosityRequired: VerbosityLevel = "normal"): boolean {
    // Always show errors and warnings
    if (level === "error" || level === "warning") return true;
    
    // Debug logs respect the debug flag
    if (level === "debug" && !globalConfig.debugEnabled) return false;

    // Get module-specific verbosity
    const moduleConfig = globalConfig.moduleVerbosity;
    const moduleVerbosity = module && moduleConfig?.modules?.[module] 
        ? moduleConfig.modules[module] 
        : moduleConfig?.default || "normal";

    const currentLevel = verbosityLevels[moduleVerbosity];
    const requiredLevel = verbosityLevels[verbosityRequired];

    return currentLevel >= requiredLevel;
}

function formatModulePrefix(module?: LogModule): string {
    if (!module || !globalConfig.moduleVerbosity?.modules?.[module]) return "";
    return chalk.dim(`[${module.toUpperCase()}] `);
}

export function logError(message: string, error?: unknown, module?: LogModule): void {
    if (!shouldLog("error", module)) return;
    const prefix = globalConfig.useEmoji ? "❌" : globalConfig.useLabels ? "[ERROR]" : "";
    const modulePrefix = formatModulePrefix(module);
    const fullMessage = prefix ? `${prefix} ${modulePrefix}${message}` : `${modulePrefix}${message}`;
    console.error(chalk.redBright(fullMessage), error || "");
}

export function logInfo(message: string, module?: LogModule, verbosity: VerbosityLevel = "normal", ...args: unknown[]): void {
    if (!shouldLog("info", module, verbosity)) return;
    const prefix = globalConfig.useEmoji ? "ℹ️" : globalConfig.useLabels ? "[INFO]" : "";
    const modulePrefix = formatModulePrefix(module);
    const fullMessage = prefix ? `${prefix} ${modulePrefix}${message}` : `${modulePrefix}${message}`;
    console.log(chalk.blueBright(fullMessage), ...args);
}

export function logSuccess(message: string, module?: LogModule, verbosity: VerbosityLevel = "normal"): void {
    if (!shouldLog("success", module, verbosity)) return;
    const prefix = globalConfig.useEmoji ? "✅" : globalConfig.useLabels ? "[SUCCESS]" : "";
    const modulePrefix = formatModulePrefix(module);
    const fullMessage = prefix ? `${prefix} ${modulePrefix}${message}` : `${modulePrefix}${message}`;
    console.log(chalk.greenBright(fullMessage));
}

export function logWarning(message: string, module?: LogModule, verbosity: VerbosityLevel = "normal", ...args: unknown[]): void {
    if (!shouldLog("warning", module, verbosity)) return;
    const prefix = globalConfig.useEmoji ? "⚠️" : globalConfig.useLabels ? "[WARNING]" : "";
    const modulePrefix = formatModulePrefix(module);
    const fullMessage = prefix ? `${prefix} ${modulePrefix}${message}` : `${modulePrefix}${message}`;
    console.warn(chalk.yellowBright(fullMessage), ...args);
}

export function logDebug(message: string, module?: LogModule, verbosity: VerbosityLevel = "debug", ...args: unknown[]): void {
    if (!shouldLog("debug", module, verbosity)) return;
    const prefix = globalConfig.useEmoji ? "🔍" : globalConfig.useLabels ? "[DEBUG]" : "";
    const modulePrefix = formatModulePrefix(module);
    const fullMessage = prefix ? `${prefix} ${modulePrefix}${message}` : `${modulePrefix}${message}`;
    console.log(chalk.magentaBright(fullMessage), ...args);
}

// Agent Logger class for contextual logging
export class AgentLogger {
    private projectName?: string;
    private agentName: string;
    private color: typeof chalk.red;
    private module: LogModule = "agent";

    constructor(agentName: string, projectName?: string) {
        this.agentName = agentName;
        this.projectName = projectName;
        this.color = getAgentColor(agentName);
    }

    setModule(module: LogModule): void {
        this.module = module;
    }

    private formatMessage(emoji: string, message: string, colorFn: typeof chalk.red, verbosity: VerbosityLevel): string {
        if (!shouldLog("info", this.module, verbosity)) return "";
        const projectPrefix = this.projectName ? `${chalk.gray(`[${this.projectName}]`)} ` : "";
        const agentPrefix = `${this.color(`[${this.agentName}]`)} `;
        const emojiPrefix = globalConfig.useEmoji ? `${emoji} ` : "";
        const modulePrefix = formatModulePrefix(this.module);
        const coloredMessage = colorFn(message);
        return `${projectPrefix}${agentPrefix}${modulePrefix}${emojiPrefix}${coloredMessage}`;
    }

    info(message: string, verbosity: VerbosityLevel = "normal", ...args: unknown[]): void {
        if (!shouldLog("info", this.module, verbosity)) return;
        const formatted = this.formatMessage("ℹ️", message, chalk.blueBright, verbosity);
        if (formatted) console.log(formatted, ...args);
    }

    success(message: string, verbosity: VerbosityLevel = "normal", ...args: unknown[]): void {
        if (!shouldLog("success", this.module, verbosity)) return;
        const formatted = this.formatMessage("✅", message, chalk.greenBright, verbosity);
        if (formatted) console.log(formatted, ...args);
    }

    warning(message: string, verbosity: VerbosityLevel = "normal", ...args: unknown[]): void {
        if (!shouldLog("warning", this.module, verbosity)) return;
        const formatted = this.formatMessage("⚠️", message, chalk.yellowBright, verbosity);
        if (formatted) console.warn(formatted, ...args);
    }

    error(message: string, error?: unknown): void {
        // Errors always show
        const formatted = this.formatMessage("❌", message, chalk.redBright, "normal");
        console.error(formatted, error || "");
    }

    debug(message: string, verbosity: VerbosityLevel = "debug", ...args: unknown[]): void {
        if (!shouldLog("debug", this.module, verbosity)) return;
        const formatted = this.formatMessage("🔍", message, chalk.magentaBright, verbosity);
        if (formatted) console.log(formatted, ...args);
    }
}

// Factory function for creating agent loggers
export function createAgentLogger(agentName: string, projectName?: string): AgentLogger {
    return new AgentLogger(agentName, projectName);
}

// Scoped logger for easier module-specific logging
export class ScopedLogger {
    constructor(private module: LogModule) {}

    info(message: string, verbosity: VerbosityLevel = "normal", ...args: unknown[]): void {
        logInfo(message, this.module, verbosity, ...args);
    }

    success(message: string, verbosity: VerbosityLevel = "normal"): void {
        logSuccess(message, this.module, verbosity);
    }

    warning(message: string, verbosity: VerbosityLevel = "normal", ...args: unknown[]): void {
        logWarning(message, this.module, verbosity, ...args);
    }

    error(message: string, error?: unknown): void {
        logError(message, error, this.module);
    }

    debug(message: string, verbosity: VerbosityLevel = "debug", ...args: unknown[]): void {
        logDebug(message, this.module, verbosity, ...args);
    }
}

// Export a logger object for compatibility
export const logger = {
    info: (message: string, ...args: unknown[]) => logInfo(message, undefined, "normal", ...args),
    error: (message: string, error?: unknown) => logError(message, error),
    success: (message: string) => logSuccess(message),
    warn: (message: string, ...args: unknown[]) => logWarning(message, undefined, "normal", ...args),
    warning: (message: string, ...args: unknown[]) => logWarning(message, undefined, "normal", ...args),
    debug: (message: string, ...args: unknown[]) => logDebug(message, undefined, "debug", ...args),
    createAgent: createAgentLogger,
    forModule: (module: LogModule) => new ScopedLogger(module),
};

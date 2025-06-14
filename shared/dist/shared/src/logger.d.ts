export interface LoggerConfig {
    useEmoji?: boolean;
    useLabels?: boolean;
    debugEnabled?: boolean;
}
export declare function configureLogger(config: Partial<LoggerConfig>): void;
export declare function logError(message: string, error?: unknown): void;
export declare function logInfo(message: string, ...args: unknown[]): void;
export declare function logSuccess(message: string): void;
export declare function logWarning(message: string, ...args: unknown[]): void;
export declare function logDebug(message: string, ...args: unknown[]): void;
export declare class AgentLogger {
    private projectName?;
    private agentName;
    private color;
    constructor(agentName: string, projectName?: string);
    private formatMessage;
    info(message: string, ...args: unknown[]): void;
    success(message: string, ...args: unknown[]): void;
    warning(message: string, ...args: unknown[]): void;
    error(message: string, error?: unknown): void;
    debug(message: string, ...args: unknown[]): void;
}
export declare function createAgentLogger(agentName: string, projectName?: string): AgentLogger;
export declare const logger: {
    info: typeof logInfo;
    error: typeof logError;
    success: typeof logSuccess;
    warn: typeof logWarning;
    warning: typeof logWarning;
    debug: typeof logDebug;
    createAgent: typeof createAgentLogger;
};
//# sourceMappingURL=logger.d.ts.map
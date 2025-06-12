export interface LoggerConfig {
    useEmoji?: boolean;
    useLabels?: boolean;
}
export declare function configureLogger(config: Partial<LoggerConfig>): void;
export declare function logError(message: string, error?: any): void;
export declare function logInfo(message: string, ...args: any[]): void;
export declare function logSuccess(message: string): void;
export declare function logWarning(message: string, ...args: any[]): void;
export declare function logDebug(message: string, ...args: any[]): void;
export declare const logger: {
    info: typeof logInfo;
    error: typeof logError;
    success: typeof logSuccess;
    warn: typeof logWarning;
    warning: typeof logWarning;
    debug: typeof logDebug;
};

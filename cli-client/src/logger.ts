export const logger = {
    info: (message: string, ...args: unknown[]) => console.log(message, ...args),
    error: (message: string, error?: unknown) => console.error(message, error || ""),
    success: (message: string) => console.log(message),
    warn: (message: string, ...args: unknown[]) => console.warn(message, ...args),
    warning: (message: string, ...args: unknown[]) => console.warn(message, ...args),
    debug: (message: string, ...args: unknown[]) => console.log(message, ...args),
};
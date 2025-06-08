// TENEX CLI: Logger Utility
export function logInfo(message: string) {
    console.log("[INFO]", message);
}

export function logError(message: string) {
    console.error("[ERROR]", message);
}

export function logSuccess(message: string) {
    console.log("[SUCCESS]", message);
}

export function logWarning(message: string) {
    console.warn("[WARNING]", message);
}

export const logger = {
    info: logInfo,
    error: logError,
    success: logSuccess,
    warn: logWarning,
    debug: (message: string) => console.log("[DEBUG]", message),
};

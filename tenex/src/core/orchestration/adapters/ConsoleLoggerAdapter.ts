import { logger as sharedLogger } from "@tenex/shared/logger";
import type { LogContext, Logger } from "../types";

/**
 * Adapter that implements the orchestration Logger interface
 * using the shared logger from @tenex/shared
 */
export class ConsoleLoggerAdapter implements Logger {
    constructor(private readonly prefix?: string) {}

    info(message: string, context?: LogContext): void {
        const prefixedMessage = this.prefix ? `[${this.prefix}] ${message}` : message;
        if (context && Object.keys(context).length > 0) {
            sharedLogger.info(prefixedMessage, context);
        } else {
            sharedLogger.info(prefixedMessage);
        }
    }

    error(message: string, context?: LogContext): void {
        const prefixedMessage = this.prefix ? `[${this.prefix}] ${message}` : message;
        if (context && Object.keys(context).length > 0) {
            sharedLogger.error(prefixedMessage, context);
        } else {
            sharedLogger.error(prefixedMessage);
        }
    }

    warn(message: string, context?: LogContext): void {
        const prefixedMessage = this.prefix ? `[${this.prefix}] ${message}` : message;
        if (context && Object.keys(context).length > 0) {
            sharedLogger.warn(prefixedMessage, context);
        } else {
            sharedLogger.warn(prefixedMessage);
        }
    }

    debug(message: string, context?: LogContext): void {
        const prefixedMessage = this.prefix ? `[${this.prefix}] ${message}` : message;
        if (context && Object.keys(context).length > 0) {
            sharedLogger.debug(prefixedMessage, context);
        } else {
            sharedLogger.debug(prefixedMessage);
        }
    }
}

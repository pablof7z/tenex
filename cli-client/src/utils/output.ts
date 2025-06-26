import { logger } from "../logger.js";

export interface OutputOptions {
    json?: boolean;
}

export function outputResult(data: any, options: OutputOptions, formatter?: (data: any) => void): void {
    if (options.json) {
        console.log(JSON.stringify(data, null, 2));
    } else if (formatter) {
        formatter(data);
    } else {
        logger.info(data);
    }
}

export function outputError(error: Error | string, options: OutputOptions): void {
    if (options.json) {
        console.log(JSON.stringify({
            error: true,
            message: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : undefined
        }, null, 2));
    } else {
        logger.error(error instanceof Error ? error.message : error);
    }
}
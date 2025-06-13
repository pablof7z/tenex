/**
 * Common error handling utilities for TENEX
 */
/**
 * Type guard to check if a value is an Error instance
 */
export function isError(err) {
    return err instanceof Error;
}
/**
 * Safely extract error message from unknown error type
 */
export function getErrorMessage(err) {
    if (err instanceof Error)
        return err.message;
    if (typeof err === 'string')
        return err;
    return String(err);
}
/**
 * Safely extract error stack from unknown error type
 */
export function getErrorStack(err) {
    if (err instanceof Error)
        return err.stack;
    return undefined;
}
/**
 * Create a standardized error object from unknown error
 */
export function normalizeError(err) {
    if (err instanceof Error)
        return err;
    if (typeof err === 'string')
        return new Error(err);
    return new Error(String(err));
}

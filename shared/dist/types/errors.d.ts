/**
 * Common error handling utilities for TENEX
 */
export type ErrorType = Error | string | unknown;
/**
 * Type guard to check if a value is an Error instance
 */
export declare function isError(err: unknown): err is Error;
/**
 * Safely extract error message from unknown error type
 */
export declare function getErrorMessage(err: unknown): string;
/**
 * Safely extract error stack from unknown error type
 */
export declare function getErrorStack(err: unknown): string | undefined;
/**
 * Create a standardized error object from unknown error
 */
export declare function normalizeError(err: unknown): Error;

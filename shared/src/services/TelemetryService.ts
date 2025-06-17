/**
 * OpenTelemetry integration service for TENEX
 *
 * This service provides optional OpenTelemetry integration for monitoring
 * TENEX projects. It's designed to be lightweight and only initialized
 * when telemetry is explicitly enabled.
 */

import type { TelemetryConfig } from "@tenex/types/telemetry";
import { logger } from "../logger.js";

interface OtelApi {
    trace: {
        getTracer(name: string, version: string): TelemetryTracer;
    };
}

export interface TelemetrySpan {
    setAttributes(attributes: Record<string, string | number | boolean>): void;
    setStatus(status: { code: number; message?: string }): void;
    end(): void;
}

export interface TelemetryTracer {
    startSpan(
        name: string,
        options?: { attributes?: Record<string, string | number | boolean> }
    ): TelemetrySpan;
}

/**
 * Optional OpenTelemetry integration service
 * Only loads OpenTelemetry dependencies when telemetry is enabled
 */
export class TelemetryService {
    private tracer: TelemetryTracer | null = null;
    private isInitialized = false;
    private config: TelemetryConfig | null = null;

    /**
     * Initialize telemetry with the provided configuration
     */
    async initialize(config: TelemetryConfig): Promise<void> {
        if (this.isInitialized) {
            logger.warn("Telemetry service already initialized");
            return;
        }

        try {
            // Only proceed if tracing is enabled
            if (!config.tracing?.enabled) {
                logger.info("Telemetry tracing is disabled, skipping initialization");
                return;
            }

            this.config = config;

            // Try to dynamically import OpenTelemetry (optional dependency)
            const otelApi = await this.loadOpenTelemetry();
            if (!otelApi) {
                logger.info("OpenTelemetry not available, telemetry disabled");
                return;
            }

            // Initialize OpenTelemetry with configuration
            await this.initializeOpenTelemetry(otelApi, config);

            this.isInitialized = true;
            logger.info("OpenTelemetry initialized successfully");
        } catch (error) {
            logger.warn(
                `Failed to initialize telemetry: ${error instanceof Error ? error.message : String(error)}`
            );
            // Don't throw - telemetry is optional
        }
    }

    /**
     * Start a new span for tracing
     */
    startSpan(
        name: string,
        attributes?: Record<string, string | number | boolean>
    ): TelemetrySpan | null {
        if (!this.tracer) {
            return this.createNoOpSpan();
        }

        try {
            return this.tracer.startSpan(name, { attributes });
        } catch (error) {
            logger.warn(
                `Failed to start span: ${error instanceof Error ? error.message : String(error)}`
            );
            return this.createNoOpSpan();
        }
    }

    /**
     * Check if telemetry is available and initialized
     */
    isAvailable(): boolean {
        return this.isInitialized && this.tracer !== null;
    }

    /**
     * Get current configuration
     */
    getConfig(): TelemetryConfig | null {
        return this.config;
    }

    /**
     * Shutdown telemetry
     */
    async shutdown(): Promise<void> {
        if (!this.isInitialized) return;

        try {
            // Shutdown is handled by the SDK
            logger.info("OpenTelemetry shut down");
        } catch (_error) {
            // Ignore shutdown errors
        }

        this.tracer = null;
        this.isInitialized = false;
        this.config = null;
    }

    /**
     * Dynamically load OpenTelemetry (optional dependency)
     */
    private async loadOpenTelemetry(): Promise<OtelApi | null> {
        try {
            // Try to import OpenTelemetry packages
            const api = await import("@opentelemetry/api");
            return api as OtelApi;
        } catch (_error) {
            // OpenTelemetry not installed - this is okay
            return null;
        }
    }

    /**
     * Initialize OpenTelemetry with the provided configuration
     */
    private async initializeOpenTelemetry(
        otelApi: OtelApi,
        config: TelemetryConfig
    ): Promise<void> {
        try {
            if (!config.tracing?.endpoint) {
                throw new Error("Tracing endpoint not configured");
            }

            // Get tracer without SDK initialization for now
            this.tracer = otelApi.trace.getTracer("tenex", "1.0.0");
        } catch (error) {
            throw new Error(
                `Failed to initialize OpenTelemetry: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Create a no-op span for when telemetry is not available
     */
    private createNoOpSpan(): TelemetrySpan {
        return {
            setAttributes: () => {},
            setStatus: () => {},
            end: () => {},
        };
    }
}

// Global telemetry service instance
let telemetryService: TelemetryService | null = null;

/**
 * Get the global telemetry service instance
 */
export function getTelemetryService(): TelemetryService {
    if (!telemetryService) {
        telemetryService = new TelemetryService();
    }
    return telemetryService;
}

/**
 * Helper function to trace a function execution
 */
export async function traceFunction<T>(
    name: string,
    fn: (span: TelemetrySpan | null) => Promise<T>,
    attributes?: Record<string, string | number | boolean>
): Promise<T> {
    const telemetry = getTelemetryService();
    const span = telemetry.startSpan(name, attributes);

    try {
        const result = await fn(span);
        span?.setStatus({ code: 1 }); // OK
        return result;
    } catch (error) {
        span?.setStatus({
            code: 2, // ERROR
            message: error instanceof Error ? error.message : String(error),
        });
        throw error;
    } finally {
        span?.end();
    }
}

/**
 * Helper function to trace a synchronous function execution
 */
export function traceFunctionSync<T>(
    name: string,
    fn: (span: TelemetrySpan | null) => T,
    attributes?: Record<string, string | number | boolean>
): T {
    const telemetry = getTelemetryService();
    const span = telemetry.startSpan(name, attributes);

    try {
        const result = fn(span);
        span?.setStatus({ code: 1 }); // OK
        return result;
    } catch (error) {
        span?.setStatus({
            code: 2, // ERROR
            message: error instanceof Error ? error.message : String(error),
        });
        throw error;
    } finally {
        span?.end();
    }
}

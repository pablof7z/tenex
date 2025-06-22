import { logger as baseLogger, type LogModule } from "@/utils/logger";
import type { TracingContext } from "./TracingContext";
import { formatTracingContext } from "./TracingContext";

/**
 * Enhanced logger that automatically includes tracing context in all log entries
 */
export class TracingLogger {
  constructor(
    private context: TracingContext,
    private module?: LogModule
  ) {}

  /**
   * Create a scoped logger for a specific module
   */
  forModule(module: LogModule): TracingLogger {
    return new TracingLogger(this.context, module);
  }

  /**
   * Update the tracing context
   */
  withContext(context: TracingContext): TracingLogger {
    return new TracingLogger(context, this.module);
  }

  /**
   * Format message with tracing context
   */
  private formatMessage(message: string, additionalContext?: Record<string, unknown>): [Record<string, unknown>] {
    const tracingData = formatTracingContext(this.context);
    const contextData = {
      ...tracingData,
      ...additionalContext,
    };

    return [contextData];
  }

  info(message: string, additionalContext?: Record<string, unknown>): void {
    const logger = this.module ? baseLogger.forModule(this.module) : baseLogger;
    logger.info(message, "normal", ...this.formatMessage(message, additionalContext));
  }

  success(message: string, additionalContext?: Record<string, unknown>): void {
    const logger = this.module ? baseLogger.forModule(this.module) : baseLogger;
    logger.success(message, "normal");
    // Log context separately for success messages
    if (additionalContext || this.context) {
      logger.debug("Context", "debug", ...this.formatMessage(message, additionalContext));
    }
  }

  warning(message: string, additionalContext?: Record<string, unknown>): void {
    const logger = this.module ? baseLogger.forModule(this.module) : baseLogger;
    logger.warning(message, "normal", ...this.formatMessage(message, additionalContext));
  }

  error(message: string, error?: unknown, additionalContext?: Record<string, unknown>): void {
    const logger = this.module ? baseLogger.forModule(this.module) : baseLogger;
    const contextData = this.formatMessage(message, additionalContext);

    // Log error with full context
    logger.error(message, { error, ...contextData[0] });
  }

  debug(message: string, additionalContext?: Record<string, unknown>): void {
    const logger = this.module ? baseLogger.forModule(this.module) : baseLogger;
    logger.debug(message, "debug", ...this.formatMessage(message, additionalContext));
  }

  /**
   * Log the start of an operation
   */
  startOperation(operation: string, additionalContext?: Record<string, unknown>): void {
    this.info(`Starting ${operation}`, {
      operation,
      event: "operation_start",
      ...additionalContext,
    });
  }

  /**
   * Log the completion of an operation
   */
  completeOperation(operation: string, additionalContext?: Record<string, unknown>): void {
    const duration = Date.now() - this.context.startTime;
    this.success(`Completed ${operation}`, {
      operation,
      event: "operation_complete",
      duration,
      ...additionalContext,
    });
  }

  /**
   * Log a failed operation
   */
  failOperation(
    operation: string,
    error: unknown,
    additionalContext?: Record<string, unknown>
  ): void {
    const duration = Date.now() - this.context.startTime;
    this.error(`Failed ${operation}`, error, {
      operation,
      event: "operation_failed",
      duration,
      ...additionalContext,
    });
  }

  /**
   * Log a state transition
   */
  logTransition(from: string, to: string, additionalContext?: Record<string, unknown>): void {
    this.info(`Transition: ${from} → ${to}`, {
      event: "state_transition",
      fromState: from,
      toState: to,
      ...additionalContext,
    });
  }

  /**
   * Log an event publication
   */
  logEventPublished(
    eventId: string,
    eventType: string,
    additionalContext?: Record<string, unknown>
  ): void {
    this.info(`Published ${eventType} event`, {
      event: "event_published",
      eventId,
      eventType,
      ...additionalContext,
    });
  }

  /**
   * Log an event receipt
   */
  logEventReceived(
    eventId: string,
    eventType: string,
    additionalContext?: Record<string, unknown>
  ): void {
    this.info(`Received ${eventType} event`, {
      event: "event_received",
      eventId,
      eventType,
      ...additionalContext,
    });
  }

  /**
   * Log LLM interaction
   */
  logLLMRequest(
    model: string,
    promptTokens?: number,
    additionalContext?: Record<string, unknown>
  ): void {
    this.debug(`LLM request to ${model}`, {
      event: "llm_request",
      model,
      promptTokens,
      ...additionalContext,
    });
  }

  /**
   * Log LLM response
   */
  logLLMResponse(
    model: string,
    duration: number,
    promptTokens?: number,
    completionTokens?: number,
    additionalContext?: Record<string, unknown>
  ): void {
    this.info(`LLM response from ${model}`, {
      event: "llm_response",
      model,
      duration,
      promptTokens,
      completionTokens,
      totalTokens: (promptTokens || 0) + (completionTokens || 0),
      ...additionalContext,
    });
  }
}

/**
 * Create a tracing logger instance
 */
export function createTracingLogger(context: TracingContext, module?: LogModule): TracingLogger {
  return new TracingLogger(context, module);
}

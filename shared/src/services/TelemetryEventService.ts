/**
 * Telemetry Event Service for TENEX orchestration events
 *
 * This service provides structured event publishing for team formation
 * and orchestration telemetry with integration to OpenTelemetry.
 */

import type {
    OrchestrationTelemetryEvent,
    TeamFormationAnalysisEvent,
    TeamFormationEvent,
    TelemetryEvent,
    TelemetryEventPublisher,
} from "@tenex/types/telemetry";
import { logger } from "../logger.js";
import { type TelemetrySpan, getTelemetryService } from "./TelemetryService.js";

export class TelemetryEventService implements TelemetryEventPublisher {
    private readonly serviceName = "tenex-orchestration";

    async publishEvent(event: TelemetryEvent): Promise<void> {
        try {
            const telemetry = getTelemetryService();

            // Log structured event
            logger.info(`📊 TELEMETRY EVENT: ${event.type}`);
            logger.info(`   Event ID: ${event.eventId}`);
            logger.info(`   Timestamp: ${event.timestamp}`);
            logger.info(`   Project: ${event.projectId || "unknown"}`);
            logger.info(`   Data: ${JSON.stringify(event.data, null, 2)}`);

            // Create telemetry span for the event
            const span = telemetry.startSpan(`orchestration.telemetry.${event.type}`, {
                "event.type": event.type,
                "event.id": event.eventId,
                "event.project_id": event.projectId || "unknown",
                "event.timestamp": event.timestamp,
                "service.name": this.serviceName,
            });

            if (span) {
                try {
                    // Add event-specific attributes
                    this.addEventAttributes(span, event);

                    // Mark success
                    span.setStatus({ code: 1 }); // OK
                } finally {
                    span.end();
                }
            }
        } catch (error) {
            logger.error(
                `Failed to publish telemetry event: ${error instanceof Error ? error.message : String(error)}`
            );
            // Don't throw - telemetry should be non-blocking
        }
    }

    async publishAnalysisEvent(event: TeamFormationAnalysisEvent): Promise<void> {
        logger.info("🔍 TEAM FORMATION ANALYSIS TELEMETRY:");
        logger.info(`   LLM Provider: ${event.data.llm.provider}`);
        logger.info(`   LLM Model: ${event.data.llm.model}`);
        logger.info(`   Analysis Success: ${event.data.analysis.success}`);
        logger.info(`   Request Type: ${event.data.analysis.requestType}`);
        logger.info(`   Complexity: ${event.data.analysis.complexity}/10`);
        logger.info(`   Strategy: ${event.data.analysis.strategy}`);
        logger.info(`   Tokens Used: ${event.data.llm.totalTokens}`);
        logger.info(`   Latency: ${event.data.llm.latencyMs}ms`);

        if (event.data.llm.cost) {
            logger.info(`   Cost: $${event.data.llm.cost.toFixed(4)}`);
        }

        await this.publishEvent(event);
    }

    async publishFormationEvent(event: TeamFormationEvent): Promise<void> {
        logger.info("👥 TEAM FORMATION TELEMETRY:");
        logger.info(`   LLM Provider: ${event.data.llm.provider}`);
        logger.info(`   LLM Model: ${event.data.llm.model}`);
        logger.info(`   Formation Success: ${event.data.team.success}`);
        logger.info(`   Lead Agent: ${event.data.team.leadAgent}`);
        logger.info(`   Team Size: ${event.data.team.memberCount}`);
        logger.info(`   Strategy: ${event.data.team.strategy}`);
        logger.info(`   Tokens Used: ${event.data.llm.totalTokens}`);
        logger.info(`   Latency: ${event.data.llm.latencyMs}ms`);

        if (!event.data.team.success && event.data.team.failureReason) {
            logger.info(`   Failure Reason: ${event.data.team.failureReason}`);
        }

        if (event.data.llm.cost) {
            logger.info(`   Cost: $${event.data.llm.cost.toFixed(4)}`);
        }

        await this.publishEvent(event);
    }

    async publishOrchestrationEvent(event: OrchestrationTelemetryEvent): Promise<void> {
        logger.info("🎯 ORCHESTRATION COMPLETE TELEMETRY:");
        logger.info(`   Overall Success: ${event.data.success}`);
        logger.info(`   Total Latency: ${event.data.totalLatencyMs}ms`);
        logger.info(`   Analysis Latency: ${event.data.analysisLatencyMs}ms`);
        logger.info(`   Formation Latency: ${event.data.formationLatencyMs}ms`);
        logger.info(`   Total LLM Calls: ${event.data.llmCalls.length}`);
        logger.info(`   Team ID: ${event.data.team.id}`);
        logger.info(`   Team Size: ${event.data.team.size}`);
        logger.info(`   Team Lead: ${event.data.team.lead}`);
        logger.info(`   Strategy: ${event.data.team.strategy}`);

        // Calculate total tokens and cost across all LLM calls
        const totalTokens = event.data.llmCalls.reduce((sum, call) => sum + call.totalTokens, 0);
        const totalCost = event.data.llmCalls.reduce((sum, call) => sum + (call.cost || 0), 0);

        logger.info(`   Total Tokens: ${totalTokens}`);
        if (totalCost > 0) {
            logger.info(`   Total Cost: $${totalCost.toFixed(4)}`);
        }

        if (!event.data.success) {
            logger.info(`   Error Type: ${event.data.errorType || "unknown"}`);
            logger.info(`   Error Message: ${event.data.errorMessage || "unknown"}`);
        }

        await this.publishEvent(event);
    }

    private addEventAttributes(span: TelemetrySpan, event: TelemetryEvent): void {
        switch (event.type) {
            case "team_formation_analysis":
                span.setAttributes({
                    "orchestration.analysis.success": event.data.analysis.success,
                    "orchestration.analysis.request_type": event.data.analysis.requestType,
                    "orchestration.analysis.complexity": event.data.analysis.complexity,
                    "orchestration.analysis.strategy": event.data.analysis.strategy,
                    "orchestration.analysis.capabilities_count":
                        event.data.analysis.capabilitiesCount,
                    "llm.provider": event.data.llm.provider,
                    "llm.model": event.data.llm.model,
                    "llm.total_tokens": event.data.llm.totalTokens,
                    "llm.latency_ms": event.data.llm.latencyMs,
                    "llm.success": event.data.llm.success,
                });
                if (event.data.llm.cost) {
                    span.setAttributes({ "llm.cost": event.data.llm.cost });
                }
                break;

            case "team_formation":
                span.setAttributes({
                    "orchestration.team.success": event.data.team.success,
                    "orchestration.team.lead": event.data.team.leadAgent,
                    "orchestration.team.size": event.data.team.memberCount,
                    "orchestration.team.strategy": event.data.team.strategy,
                    "llm.provider": event.data.llm.provider,
                    "llm.model": event.data.llm.model,
                    "llm.total_tokens": event.data.llm.totalTokens,
                    "llm.latency_ms": event.data.llm.latencyMs,
                    "llm.success": event.data.llm.success,
                });
                if (event.data.team.failureReason) {
                    span.setAttributes({
                        "orchestration.team.failure_reason": event.data.team.failureReason,
                    });
                }
                if (event.data.llm.cost) {
                    span.setAttributes({ "llm.cost": event.data.llm.cost });
                }
                break;

            case "orchestration_complete": {
                span.setAttributes({
                    "orchestration.success": event.data.success,
                    "orchestration.total_latency_ms": event.data.totalLatencyMs,
                    "orchestration.analysis_latency_ms": event.data.analysisLatencyMs,
                    "orchestration.formation_latency_ms": event.data.formationLatencyMs,
                    "orchestration.llm_calls_count": event.data.llmCalls.length,
                    "orchestration.team.id": event.data.team.id,
                    "orchestration.team.size": event.data.team.size,
                    "orchestration.team.lead": event.data.team.lead,
                    "orchestration.team.strategy": event.data.team.strategy,
                });

                if (!event.data.success) {
                    span.setAttributes({
                        "orchestration.error_type": event.data.errorType || "unknown",
                        "orchestration.error_message": event.data.errorMessage || "unknown",
                    });
                }

                // Add aggregated LLM metrics
                const totalTokens = event.data.llmCalls.reduce(
                    (sum, call) => sum + call.totalTokens,
                    0
                );
                const totalCost = event.data.llmCalls.reduce(
                    (sum, call) => sum + (call.cost || 0),
                    0
                );
                span.setAttributes({
                    "llm.total_tokens_all_calls": totalTokens,
                    "llm.total_cost_all_calls": totalCost,
                });
                break;
            }
        }
    }
}

// Global telemetry event service instance
let telemetryEventService: TelemetryEventService | null = null;

/**
 * Get the global telemetry event service instance
 */
export function getTelemetryEventService(): TelemetryEventService {
    if (!telemetryEventService) {
        telemetryEventService = new TelemetryEventService();
    }
    return telemetryEventService;
}

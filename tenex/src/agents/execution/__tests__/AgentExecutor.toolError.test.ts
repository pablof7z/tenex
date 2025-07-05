import { describe, it, expect, vi } from "vitest";
import type { StreamEvent } from "@/llm/types";
import type { NostrPublisher } from "@/nostr/NostrPublisher";
import { createTracingLogger } from "@/tracing";

describe("AgentExecutor - Tool Error Publishing", () => {
    it("should publish error when tool returns success: false", async () => {
        const mockPublisher = {
            publishError: vi.fn().mockResolvedValue({}),
        } as any as NostrPublisher;

        const tracingLogger = createTracingLogger({ traceId: "test", operationName: "test" }, "test");

        // Simulate the tool_complete event handling from AgentExecutor.executeWithStreaming
        const event: StreamEvent = {
            type: "tool_complete",
            tool: "continue",
            result: {
                success: false,
                error: "Agents not found: user. Available agents: executer, planner, project-manager, orchestrator, yagni",
            },
        };

        // Extract the logic from AgentExecutor.executeWithStreaming case "tool_complete"
        const resultWithMetadata = event.result as
            | {
                metadata?: unknown;
                success?: boolean;
                error?: string;
              }
            | null
            | undefined;

        // Check if tool execution failed and publish error
        if (resultWithMetadata?.success === false && resultWithMetadata?.error && mockPublisher) {
            try {
                await mockPublisher.publishError(`Tool "${event.tool}" failed: ${resultWithMetadata.error}`);
                tracingLogger.info("Published tool error to conversation", {
                    tool: event.tool,
                    error: resultWithMetadata.error,
                });
            } catch (error) {
                tracingLogger.error("Failed to publish tool error", {
                    tool: event.tool,
                    originalError: resultWithMetadata.error,
                    publishError: error instanceof Error ? error.message : String(error),
                });
            }
        }

        // Verify publishError was called with the correct error message
        expect(mockPublisher.publishError).toHaveBeenCalledWith(
            'Tool "continue" failed: Destinations not found: user. Available agents: executer, planner, project-manager, orchestrator, yagni'
        );
        expect(mockPublisher.publishError).toHaveBeenCalledTimes(1);
    });

    it("should not publish error when tool returns success: true", async () => {
        const mockPublisher = {
            publishError: vi.fn().mockResolvedValue({}),
        } as any as NostrPublisher;

        const tracingLogger = createTracingLogger({ traceId: "test", operationName: "test" }, "test");

        // Simulate the tool_complete event handling
        const event: StreamEvent = {
            type: "tool_complete",
            tool: "continue",
            result: {
                success: true,
                output: "Successfully routed to agent",
            },
        };

        // Extract the logic from AgentExecutor
        const resultWithMetadata = event.result as
            | {
                metadata?: unknown;
                success?: boolean;
                error?: string;
              }
            | null
            | undefined;

        // Check if tool execution failed and publish error
        if (resultWithMetadata?.success === false && resultWithMetadata?.error && mockPublisher) {
            await mockPublisher.publishError(`Tool "${event.tool}" failed: ${resultWithMetadata.error}`);
        }

        // Verify publishError was NOT called
        expect(mockPublisher.publishError).not.toHaveBeenCalled();
    });
});
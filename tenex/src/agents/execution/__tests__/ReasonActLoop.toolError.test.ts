import { describe, it, expect, vi } from "vitest";
import type { NostrPublisher } from "@/nostr/NostrPublisher";
import { createTracingLogger } from "@/tracing";
import { ReasonActLoop } from "../ReasonActLoop";
import { serializeToolResult } from "@/llm/ToolResult";

describe("ReasonActLoop - Tool Error Publishing", () => {
    it("should publish error when tool returns success: false", async () => {
        const mockPublisher = {
            publishError: vi.fn().mockResolvedValue({}),
            publishTypingIndicator: vi.fn().mockResolvedValue({}),
        } as any as NostrPublisher;

        const tracingLogger = createTracingLogger(
            { traceId: "test", operationName: "test" },
            "test"
        );

        const reasonActLoop = new ReasonActLoop({} as any, {} as any);

        // Use reflection to access private method
        const handleToolCompleteEvent = (reasonActLoop as any).handleToolCompleteEvent.bind(
            reasonActLoop
        );

        // Simulate a tool_complete event with an error
        const event = {
            tool: "continue",
            result: {
                __typedResult: serializeToolResult({
                    success: false,
                    duration: 100,
                    error: {
                        kind: "ValidationError",
                        message:
                            "Agents not found: user. Available agents: executor, planner, project-manager, orchestrator, yagni",
                    },
                }),
            },
        };

        const state = {
            allToolResults: [],
            continueFlow: undefined,
            termination: undefined,
            finalResponse: undefined,
            fullContent: "",
            streamPublisher: undefined,
        };

        const context = {
            agent: { name: "test-agent", isOrchestrator: false },
            phase: "execute",
        };

        await handleToolCompleteEvent(
            event,
            state,
            undefined,
            mockPublisher,
            tracingLogger,
            context
        );

        // Verify publishError was called with the correct error message
        expect(mockPublisher.publishError).toHaveBeenCalledWith(
            'Tool "continue" failed: Agents not found: user. Available agents: executor, planner, project-manager, orchestrator, yagni'
        );
        expect(mockPublisher.publishError).toHaveBeenCalledTimes(1);
    });

    it("should not publish error when tool returns success: true", async () => {
        const mockPublisher = {
            publishError: vi.fn().mockResolvedValue({}),
            publishTypingIndicator: vi.fn().mockResolvedValue({}),
        } as any as NostrPublisher;

        const tracingLogger = createTracingLogger(
            { traceId: "test", operationName: "test" },
            "test"
        );

        const reasonActLoop = new ReasonActLoop({} as any, {} as any);

        // Use reflection to access private method
        const handleToolCompleteEvent = (reasonActLoop as any).handleToolCompleteEvent.bind(
            reasonActLoop
        );

        // Simulate a tool_complete event with success
        const event = {
            tool: "continue",
            result: {
                __typedResult: serializeToolResult({
                    success: true,
                    duration: 100,
                    output: "Successfully routed to agent",
                }),
            },
        };

        const state = {
            allToolResults: [],
            continueFlow: undefined,
            termination: undefined,
            finalResponse: undefined,
            fullContent: "",
            streamPublisher: undefined,
        };

        const context = {
            agent: { name: "test-agent", isOrchestrator: false },
            phase: "execute",
        };

        await handleToolCompleteEvent(
            event,
            state,
            undefined,
            mockPublisher,
            tracingLogger,
            context
        );

        // Verify publishError was NOT called
        expect(mockPublisher.publishError).not.toHaveBeenCalled();
    });
});

import { NDKEvent } from "@nostr-dev-kit/ndk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Conversation } from "../../../../utils/agents/Conversation";
import type { Logger } from "../../../../utils/fs";
import type { LLMProvider } from "../../types";
import { CorrectionDetector } from "../CorrectionDetector";
import type { CorrectionAnalysis, CorrectionPattern } from "../types";

describe("CorrectionDetector", () => {
    let detector: CorrectionDetector;
    let mockLogger: Logger;
    let mockLLMProvider: LLMProvider;

    beforeEach(() => {
        mockLogger = {
            log: vi.fn(),
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        } as Logger;

        mockLLMProvider = {
            processRequest: vi.fn().mockResolvedValue({
                content: JSON.stringify({
                    isCorrection: true,
                    confidence: 0.85,
                    issues: ["Incorrect implementation", "Missing error handling"],
                    affectedAgents: ["agent-1", "agent-2"],
                }),
            }),
        } as unknown as LLMProvider;

        detector = new CorrectionDetector(mockLogger, mockLLMProvider);
    });

    describe("constructor", () => {
        it("should throw error if logger is not provided", () => {
            expect(
                () => new CorrectionDetector(null as unknown as Logger, mockLLMProvider)
            ).toThrow("Logger is required");
        });

        it("should throw error if LLMProvider is not provided", () => {
            expect(
                () => new CorrectionDetector(mockLogger, null as unknown as LLMProvider)
            ).toThrow("LLMProvider is required");
        });
    });

    describe("isCorrection", () => {
        const mockEvent = new NDKEvent();
        mockEvent.content = "Actually, that's not right. Let me fix that implementation.";
        mockEvent.id = "event-1";

        const mockConversation: Conversation = {
            id: "conv-1",
            projectNaddr: "naddr1...",
            taskId: "task-1",
            agentName: "agent-1",
            messages: [
                {
                    role: "user",
                    content: "Implement the feature",
                    timestamp: Date.now() - 10000,
                },
                {
                    role: "assistant",
                    content: "Here's the implementation...",
                    timestamp: Date.now() - 5000,
                    metadata: { agentName: "agent-1" },
                },
            ],
            createdAt: Date.now() - 10000,
            lastUpdated: Date.now() - 5000,
            metadata: {},
        };

        it("should detect a correction", async () => {
            const result = await detector.isCorrection(mockEvent, mockConversation);

            expect(result).toBeDefined();
            expect(result?.isCorrection).toBe(true);
            expect(result?.confidence).toBe(0.85);
            expect(result?.issues).toContain("Incorrect implementation");
            expect(result?.affectedAgents).toContain("agent-1");
        });

        it("should return null when no correction is detected", async () => {
            mockLLMProvider.processRequest = vi.fn().mockResolvedValue({
                content: JSON.stringify({
                    isCorrection: false,
                    confidence: 0.9,
                    issues: [],
                }),
            });

            const result = await detector.isCorrection(mockEvent, mockConversation);

            expect(result).toBeNull();
        });

        it("should handle empty conversation", async () => {
            const emptyConversation: Conversation = {
                ...mockConversation,
                messages: [],
            };

            mockLLMProvider.processRequest = vi.fn().mockResolvedValue({
                content: JSON.stringify({
                    isCorrection: false,
                    confidence: 0.1,
                    issues: [],
                }),
            });

            const result = await detector.isCorrection(mockEvent, emptyConversation);

            expect(result).toBeNull();
        });

        it("should handle LLM errors gracefully", async () => {
            mockLLMProvider.processRequest = vi.fn().mockRejectedValue(new Error("LLM error"));

            const result = await detector.isCorrection(mockEvent, mockConversation);

            expect(result).toBeNull();
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("Failed to detect correction")
            );
        });

        it("should handle malformed LLM response", async () => {
            mockLLMProvider.processRequest = vi.fn().mockResolvedValue({
                content: "Not valid JSON",
            });

            const result = await detector.isCorrection(mockEvent, mockConversation);

            expect(result).toBeNull();
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("Failed to parse correction detection")
            );
        });
    });

    describe("detectPattern", () => {
        it("should detect correction patterns in messages", () => {
            const messages = [
                {
                    role: "user" as const,
                    content: "Create a function to calculate sum",
                    timestamp: Date.now() - 30000,
                },
                {
                    role: "assistant" as const,
                    content: "Here's the sum function: function sum(a, b) { return a - b; }",
                    timestamp: Date.now() - 20000,
                },
                {
                    role: "user" as const,
                    content: "That's wrong, it's subtracting instead of adding",
                    timestamp: Date.now() - 10000,
                },
                {
                    role: "assistant" as const,
                    content: "You're right, let me fix that: function sum(a, b) { return a + b; }",
                    timestamp: Date.now() - 5000,
                },
            ];

            const pattern = detector.detectPattern(messages);

            expect(pattern).toBeDefined();
            expect(pattern?.type).toBe("user_correction");
            expect(pattern?.indicators).toContain("wrong");
            expect(pattern?.confidence).toBeGreaterThan(0.7);
        });

        it("should detect self-correction patterns", () => {
            const messages = [
                {
                    role: "assistant" as const,
                    content: "The result is 42",
                    timestamp: Date.now() - 10000,
                },
                {
                    role: "assistant" as const,
                    content: "Actually, I made an error. The correct result is 43",
                    timestamp: Date.now() - 5000,
                },
            ];

            const pattern = detector.detectPattern(messages);

            expect(pattern).toBeDefined();
            expect(pattern?.type).toBe("self_correction");
            expect(pattern?.indicators).toContain("error");
            expect(pattern?.confidence).toBeGreaterThan(0.8);
        });

        it("should return null when no pattern is detected", () => {
            const messages = [
                {
                    role: "user" as const,
                    content: "What's the weather like?",
                    timestamp: Date.now() - 10000,
                },
                {
                    role: "assistant" as const,
                    content: "The weather is sunny today",
                    timestamp: Date.now() - 5000,
                },
            ];

            const pattern = detector.detectPattern(messages);

            expect(pattern).toBeNull();
        });

        it("should handle empty messages array", () => {
            const pattern = detector.detectPattern([]);

            expect(pattern).toBeNull();
        });

        it("should detect revision request patterns", () => {
            const messages = [
                {
                    role: "assistant" as const,
                    content: "Here's my implementation",
                    timestamp: Date.now() - 10000,
                },
                {
                    role: "user" as const,
                    content: "Could you please enhance this to handle edge cases",
                    timestamp: Date.now() - 5000,
                },
            ];

            const pattern = detector.detectPattern(messages);

            expect(pattern).toBeDefined();
            expect(pattern?.type).toBe("revision_request");
            expect(pattern?.indicators).toContain("enhance");
        });
    });
});

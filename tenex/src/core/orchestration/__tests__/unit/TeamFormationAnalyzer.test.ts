import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PromptBuilder } from "../../PromptBuilder";
import { TeamFormationAnalyzerImpl } from "../../TeamFormationAnalyzerImpl";
import type { LLMProvider, ProjectContext } from "../../types";
import { OrchestrationStrategy } from "../../types";

function createMockLLMProvider(): ReturnType<typeof vi.mocked<LLMProvider>> {
    return {
        complete: vi.fn(),
    };
}

function createMockPromptBuilder(): ReturnType<typeof vi.mocked<PromptBuilder>> {
    return {
        buildAnalysisPrompt: vi.fn(),
    };
}

function createTestEvent(content: string): NDKEvent {
    return {
        content,
        id: "test-event-123",
        kind: 11,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        pubkey: "test-pubkey",
    } as NDKEvent;
}

describe("TeamFormationAnalyzer", () => {
    let analyzer: TeamFormationAnalyzerImpl;
    let mockLLMProvider: ReturnType<typeof createMockLLMProvider>;
    let mockPromptBuilder: ReturnType<typeof createMockPromptBuilder>;

    beforeEach(() => {
        mockLLMProvider = createMockLLMProvider();
        mockPromptBuilder = createMockPromptBuilder();
        analyzer = new TeamFormationAnalyzerImpl(mockLLMProvider, mockPromptBuilder);
    });

    describe("analyzeRequest", () => {
        it("should analyze a simple question request", async () => {
            // Arrange
            const event = createTestEvent("What is the current user count?");
            const context: ProjectContext = { title: "Analytics Dashboard" };

            mockPromptBuilder.buildAnalysisPrompt.mockReturnValue("Analyze this request...");
            mockLLMProvider.complete.mockResolvedValue({
                content: JSON.stringify({
                    requestType: "simple query",
                    requiredCapabilities: ["database access", "analytics"],
                    estimatedComplexity: 2,
                    suggestedStrategy: "single_responder",
                    reasoning: "Simple database query requiring minimal coordination",
                }),
            });

            // Act
            const analysis = await analyzer.analyzeRequest(event, context);

            // Assert
            expect(analysis).toEqual({
                requestType: "simple query",
                requiredCapabilities: ["database access", "analytics"],
                estimatedComplexity: 2,
                suggestedStrategy: OrchestrationStrategy.SINGLE_RESPONDER,
                reasoning: "Simple database query requiring minimal coordination",
            });

            expect(mockPromptBuilder.buildAnalysisPrompt).toHaveBeenCalledWith(event, context);
        });

        it("should analyze a complex feature request", async () => {
            // Arrange
            const event = createTestEvent(
                "Build a real-time dashboard with websocket updates, user authentication, and data export"
            );
            const context: ProjectContext = {
                title: "Enterprise Dashboard",
                repository: "https://github.com/example/dashboard",
            };

            mockPromptBuilder.buildAnalysisPrompt.mockReturnValue(
                "Analyze this complex request..."
            );
            mockLLMProvider.complete.mockResolvedValue({
                content: JSON.stringify({
                    requestType: "feature implementation",
                    requiredCapabilities: [
                        "frontend",
                        "backend",
                        "websockets",
                        "authentication",
                        "data processing",
                    ],
                    estimatedComplexity: 8,
                    suggestedStrategy: "phased_delivery",
                    reasoning:
                        "Complex feature requiring multiple subsystems and careful coordination",
                }),
            });

            // Act
            const analysis = await analyzer.analyzeRequest(event, context);

            // Assert
            expect(analysis.estimatedComplexity).toBe(8);
            expect(analysis.suggestedStrategy).toBe(OrchestrationStrategy.PHASED_DELIVERY);
            expect(analysis.requiredCapabilities).toContain("websockets");
            expect(analysis.requiredCapabilities).toContain("authentication");
        });

        it("should handle bug fix requests", async () => {
            // Arrange
            const event = createTestEvent("Users can't login - getting 500 error");
            const context: ProjectContext = { title: "Web App" };

            mockPromptBuilder.buildAnalysisPrompt.mockReturnValue("Analyze this bug...");
            mockLLMProvider.complete.mockResolvedValue({
                content: JSON.stringify({
                    requestType: "bug fix",
                    requiredCapabilities: ["debugging", "backend", "authentication"],
                    estimatedComplexity: 4,
                    suggestedStrategy: "hierarchical",
                    reasoning: "Urgent bug requiring diagnosis and fix with clear leadership",
                }),
            });

            // Act
            const analysis = await analyzer.analyzeRequest(event, context);

            // Assert
            expect(analysis.requestType).toBe("bug fix");
            expect(analysis.suggestedStrategy).toBe(OrchestrationStrategy.HIERARCHICAL);
            expect(analysis.requiredCapabilities).toContain("debugging");
        });

        it("should handle malformed LLM responses gracefully", async () => {
            // Arrange
            const event = createTestEvent("Do something");
            mockPromptBuilder.buildAnalysisPrompt.mockReturnValue("Analyze...");
            mockLLMProvider.complete.mockResolvedValue({
                content: "This is not valid JSON",
            });

            // Act & Assert
            await expect(analyzer.analyzeRequest(event, {})).rejects.toThrow(
                "Failed to parse analysis response"
            );
        });

        it("should validate required fields in analysis", async () => {
            // Arrange
            const event = createTestEvent("Task");
            mockPromptBuilder.buildAnalysisPrompt.mockReturnValue("Analyze...");
            mockLLMProvider.complete.mockResolvedValue({
                content: JSON.stringify({
                    requestType: "task",
                    // Missing required fields
                }),
            });

            // Act & Assert
            await expect(analyzer.analyzeRequest(event, {})).rejects.toThrow(
                "Invalid analysis response"
            );
        });
    });
});

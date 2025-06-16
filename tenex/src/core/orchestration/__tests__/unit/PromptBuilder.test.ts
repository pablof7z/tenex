import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { describe, expect, it } from "vitest";
import { PromptBuilderImpl } from "../../PromptBuilderImpl";
import type { ProjectContext } from "../../types";

function createTestEvent(content: string, tags: string[][] = []): NDKEvent {
    return {
        content,
        id: "test-event-123",
        kind: 11,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        pubkey: "test-pubkey",
    } as NDKEvent;
}

describe("PromptBuilder", () => {
    const promptBuilder = new PromptBuilderImpl();

    describe("buildAnalysisPrompt", () => {
        it("should build prompt for simple request without context", () => {
            // Arrange
            const event = createTestEvent("How do I add a new feature?");
            const context: ProjectContext = {};

            // Act
            const prompt = promptBuilder.buildAnalysisPrompt(event, context);

            // Assert
            expect(prompt).toContain("How do I add a new feature?");
            expect(prompt).toContain("Analyze this request");
            expect(prompt).toContain("requestType");
            expect(prompt).toContain("requiredCapabilities");
            expect(prompt).toContain("estimatedComplexity");
            expect(prompt).toContain("suggestedStrategy");
            expect(prompt).toContain("reasoning");
        });

        it("should include project context when available", () => {
            // Arrange
            const event = createTestEvent("Fix the authentication bug");
            const context: ProjectContext = {
                title: "E-commerce Platform",
                repository: "https://github.com/example/shop",
            };

            // Act
            const prompt = promptBuilder.buildAnalysisPrompt(event, context);

            // Assert
            expect(prompt).toContain("E-commerce Platform");
            expect(prompt).toContain("https://github.com/example/shop");
            expect(prompt).toContain("Fix the authentication bug");
        });

        it("should include conversation context from event tags", () => {
            // Arrange
            const event = createTestEvent("Also add error handling", [
                ["e", "previous-event-id"],
                ["root", "root-event-id"],
            ]);
            const context: ProjectContext = {};

            // Act
            const prompt = promptBuilder.buildAnalysisPrompt(event, context);

            // Assert
            expect(prompt).toContain("ongoing conversation");
            expect(prompt).toContain("Also add error handling");
        });

        it("should provide clear JSON format instructions", () => {
            // Arrange
            const event = createTestEvent("Build a dashboard");
            const context: ProjectContext = {};

            // Act
            const prompt = promptBuilder.buildAnalysisPrompt(event, context);

            // Assert
            expect(prompt).toContain("Return your analysis as JSON");
            expect(prompt).toContain('"requestType":');
            expect(prompt).toContain('"requiredCapabilities":');
            expect(prompt).toContain('"estimatedComplexity":');
            expect(prompt).toContain('"suggestedStrategy":');
            expect(prompt).toContain('"reasoning":');
        });

        it("should include strategy options", () => {
            // Arrange
            const event = createTestEvent("Refactor the codebase");
            const context: ProjectContext = {};

            // Act
            const prompt = promptBuilder.buildAnalysisPrompt(event, context);

            // Assert
            expect(prompt).toContain("single_responder");
            expect(prompt).toContain("hierarchical");
            expect(prompt).toContain("parallel_execution");
            expect(prompt).toContain("phased_delivery");
            expect(prompt).toContain("exploratory");
        });
    });
});

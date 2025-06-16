import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type { PromptBuilder } from "./PromptBuilder";
import type { TeamFormationAnalyzer } from "./TeamFormationAnalyzer";
import type { LLMProvider, ProjectContext, RequestAnalysis } from "./types";
import { OrchestrationStrategy } from "./types";

interface RawAnalysisResponse {
    requestType: string;
    requiredCapabilities: string[];
    estimatedComplexity: number;
    suggestedStrategy: string;
    reasoning: string;
}

export class TeamFormationAnalyzerImpl implements TeamFormationAnalyzer {
    constructor(
        private readonly llmProvider: LLMProvider,
        private readonly promptBuilder: PromptBuilder
    ) {
        if (!llmProvider) throw new Error("LLMProvider is required");
        if (!promptBuilder) throw new Error("PromptBuilder is required");
    }

    async analyzeRequest(event: NDKEvent, context: ProjectContext): Promise<RequestAnalysis> {
        const prompt = this.promptBuilder.buildAnalysisPrompt(event, context);
        const response = await this.llmProvider.complete(prompt);

        let rawAnalysis: RawAnalysisResponse;
        try {
            rawAnalysis = JSON.parse(response.content) as RawAnalysisResponse;
        } catch (error) {
            throw new Error(
                `Failed to parse analysis response: ${error instanceof Error ? error.message : String(error)}`
            );
        }

        // Validate required fields
        if (!this.isValidAnalysis(rawAnalysis)) {
            throw new Error("Invalid analysis response: missing required fields");
        }

        // Map strategy string to enum
        const strategy = this.mapStrategy(rawAnalysis.suggestedStrategy);

        return {
            requestType: rawAnalysis.requestType,
            requiredCapabilities: rawAnalysis.requiredCapabilities,
            estimatedComplexity: rawAnalysis.estimatedComplexity,
            suggestedStrategy: strategy,
            reasoning: rawAnalysis.reasoning,
        };
    }

    private isValidAnalysis(analysis: unknown): analysis is RawAnalysisResponse {
        if (!analysis || typeof analysis !== "object") return false;

        const obj = analysis as Record<string, unknown>;

        return (
            typeof obj.requestType === "string" &&
            Array.isArray(obj.requiredCapabilities) &&
            typeof obj.estimatedComplexity === "number" &&
            typeof obj.suggestedStrategy === "string" &&
            typeof obj.reasoning === "string"
        );
    }

    private mapStrategy(strategy: string): OrchestrationStrategy {
        // Handle both enum values and snake_case strings from LLM
        const normalizedStrategy = strategy.toLowerCase().replace(/-/g, "_");

        switch (normalizedStrategy) {
            case "single_responder":
                return OrchestrationStrategy.SINGLE_RESPONDER;
            case "hierarchical":
                return OrchestrationStrategy.HIERARCHICAL;
            case "parallel_execution":
                return OrchestrationStrategy.PARALLEL_EXECUTION;
            case "phased_delivery":
                return OrchestrationStrategy.PHASED_DELIVERY;
            case "exploratory":
                return OrchestrationStrategy.EXPLORATORY;
            default:
                // Default to hierarchical for unknown strategies
                return OrchestrationStrategy.HIERARCHICAL;
        }
    }
}

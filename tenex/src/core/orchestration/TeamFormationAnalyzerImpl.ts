import type { TypingIndicatorPublisher } from "@/core/orchestration/OrchestrationFactory";
import type { PromptBuilder } from "@/core/orchestration/PromptBuilder";
import type { TeamFormationAnalyzer } from "@/core/orchestration/TeamFormationAnalyzer";
import type {
    AgentDefinition,
    CombinedAnalysisResponse,
    ProjectContext,
    RequestAnalysis,
} from "@/core/orchestration/types";
import type { ToolEnabledProvider } from "@/utils/agents/llm/ToolEnabledProvider";
import { OrchestrationStrategy } from "@/core/orchestration/types";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";
import { getTelemetryService, traceFunction } from "@tenex/shared/services";

interface RawAnalysisResponse {
    requestType: string;
    requiredCapabilities: string[];
    estimatedComplexity: number;
    suggestedStrategy: string;
    reasoning: string;
}

export class TeamFormationAnalyzerImpl implements TeamFormationAnalyzer {
    constructor(
        private readonly llmProvider: ToolEnabledProvider,
        private readonly promptBuilder: PromptBuilder,
        private readonly maxTeamSize: number = 5,
        private readonly typingIndicatorPublisher?: TypingIndicatorPublisher
    ) {
        if (!llmProvider) throw new Error("LLMProvider is required");
        if (!promptBuilder) throw new Error("PromptBuilder is required");
    }

    async analyzeRequest(event: NDKEvent, context: ProjectContext): Promise<RequestAnalysis> {
        return traceFunction(
            "orchestration.team_formation.analyzeRequest",
            async (span) => {
                try {
                    // Log LLM provider configuration details
                    logger.info("🧠 TEAM FORMATION ANALYZER - Starting request analysis");
                    logger.info(`   LLM Provider: ${this.llmProvider.constructor.name}`);

                    // Get LLM config details if available
                    const providerDetails = this.getLLMProviderDetails();
                    if (providerDetails) {
                        logger.info(
                            `   LLM Provider Type: ${providerDetails.provider || "unknown"}`
                        );
                        logger.info(`   LLM Model: ${providerDetails.model || "default"}`);
                        logger.info(`   LLM Base URL: ${providerDetails.baseURL || "default"}`);
                        logger.info(`   LLM Max Tokens: ${providerDetails.maxTokens || "default"}`);
                        logger.info(
                            `   LLM Temperature: ${providerDetails.temperature || "default"}`
                        );

                        span?.setAttributes({
                            "llm.provider_class": this.llmProvider.constructor.name,
                            "llm.provider_type": providerDetails.provider || "unknown",
                            "llm.model": providerDetails.model || "unknown",
                            "llm.base_url": providerDetails.baseURL || "unknown",
                            "llm.max_tokens": providerDetails.maxTokens || 0,
                            "llm.temperature": providerDetails.temperature || 0,
                        });
                    }

                    logger.info(`   Event ID: ${event.id}`);
                    logger.info(`   Event Content: "${event.content}"`);
                    logger.info(`   Project Context: ${context?.title || "unknown"}`);

                    span?.setAttributes({
                        "orchestration.event_id": event.id || "unknown",
                        "orchestration.event_content_length": event.content?.length || 0,
                        "orchestration.project_title": context?.title || "unknown",
                    });

                    // Build and log the analysis prompt
                    logger.info("📝 Building analysis prompt...");
                    const prompt = this.promptBuilder.buildAnalysisPrompt(event, context);

                    logger.info("🎯 FULL ANALYSIS PROMPT:");
                    logger.info("=".repeat(80));
                    logger.info(prompt);
                    logger.info("=".repeat(80));

                    span?.setAttributes({
                        "orchestration.prompt_length": prompt.length,
                        "orchestration.prompt_hash": this.hashString(prompt),
                    });

                    // Publish typing indicator if available
                    if (this.typingIndicatorPublisher && event) {
                        try {
                            await this.typingIndicatorPublisher.publishTypingIndicator(
                                event,
                                "orchestrator",
                                true,
                                "Analyzing request to determine team formation...",
                                "You are a team formation analyzer. Your role is to analyze incoming requests and determine what type of team structure and agents are needed to handle them.",
                                prompt
                            );
                        } catch (error) {
                            logger.warn(`Failed to publish typing indicator: ${error}`);
                        }
                    }

                    // Call LLM with telemetry
                    logger.info("🚀 Calling LLM for request analysis...");
                    const response = await this.llmProvider.generateResponse(
                        [{ role: "user", content: prompt }],
                        {} // Empty config - will use provider's default
                    );

                    logger.info("📨 LLM ANALYSIS RESPONSE:");
                    logger.info("=".repeat(80));
                    logger.info(response.content);
                    logger.info("=".repeat(80));

                    span?.setAttributes({
                        "orchestration.response_length": response.content.length,
                        "orchestration.response_hash": this.hashString(response.content),
                    });

                    let rawAnalysis: RawAnalysisResponse;
                    try {
                        // Remove common markdown code block formatting that LLMs often add
                        let content = response.content.trim();

                        // Handle markdown code blocks
                        if (content.startsWith("```json")) {
                            content = content.replace(/^```json\s*/, "").replace(/\s*```$/, "");
                        } else if (content.startsWith("```")) {
                            content = content.replace(/^```\s*/, "").replace(/\s*```$/, "");
                        }

                        logger.info("🔧 Parsing cleaned JSON response...");
                        rawAnalysis = JSON.parse(content) as RawAnalysisResponse;

                        logger.info("✅ Successfully parsed analysis response:");
                        logger.info(`   Request Type: ${rawAnalysis.requestType}`);
                        logger.info(
                            `   Required Capabilities: ${rawAnalysis.requiredCapabilities?.join(", ")}`
                        );
                        logger.info(`   Estimated Complexity: ${rawAnalysis.estimatedComplexity}`);
                        logger.info(`   Suggested Strategy: ${rawAnalysis.suggestedStrategy}`);
                        logger.info(`   Reasoning: ${rawAnalysis.reasoning}`);
                    } catch (error) {
                        logger.error("❌ Failed to parse analysis response:");
                        logger.error(
                            `   Parse Error: ${error instanceof Error ? error.message : String(error)}`
                        );
                        logger.error(`   Raw Response: ${response.content}`);

                        span?.setAttributes({
                            "orchestration.parse_error": true,
                            "orchestration.parse_error_message":
                                error instanceof Error ? error.message : String(error),
                        });

                        throw new Error(
                            `Failed to parse analysis response: ${error instanceof Error ? error.message : String(error)}`
                        );
                    }

                    // Validate required fields
                    if (!this.isValidAnalysis(rawAnalysis)) {
                        logger.error("❌ Invalid analysis response: missing required fields");
                        logger.error(`   Raw Analysis: ${JSON.stringify(rawAnalysis, null, 2)}`);

                        span?.setAttributes({
                            "orchestration.validation_error": true,
                            "orchestration.validation_error_message": "missing required fields",
                        });

                        throw new Error("Invalid analysis response: missing required fields");
                    }

                    // Map strategy string to enum
                    const strategy = this.mapStrategy(rawAnalysis.suggestedStrategy);

                    const finalAnalysis: RequestAnalysis = {
                        requestType: rawAnalysis.requestType,
                        requiredCapabilities: rawAnalysis.requiredCapabilities,
                        estimatedComplexity: rawAnalysis.estimatedComplexity,
                        suggestedStrategy: strategy,
                        reasoning: rawAnalysis.reasoning,
                    };

                    span?.setAttributes({
                        "orchestration.analysis.request_type": finalAnalysis.requestType,
                        "orchestration.analysis.complexity": finalAnalysis.estimatedComplexity,
                        "orchestration.analysis.capabilities_count":
                            finalAnalysis.requiredCapabilities.length,
                        "orchestration.analysis.strategy": finalAnalysis.suggestedStrategy,
                        "orchestration.analysis_success": true,
                    });

                    logger.info("🎉 ANALYSIS COMPLETE - Final result:");
                    logger.info(`   Request Type: ${finalAnalysis.requestType}`);
                    logger.info(`   Complexity: ${finalAnalysis.estimatedComplexity}/10`);
                    logger.info(`   Strategy: ${finalAnalysis.suggestedStrategy}`);
                    logger.info(
                        `   Capabilities: ${finalAnalysis.requiredCapabilities.join(", ")}`
                    );

                    // Stop typing indicator
                    if (this.typingIndicatorPublisher && event) {
                        try {
                            await this.typingIndicatorPublisher.publishTypingIndicator(
                                event,
                                "orchestrator",
                                false
                            );
                        } catch (error) {
                            logger.warn(`Failed to stop typing indicator: ${error}`);
                        }
                    }

                    return finalAnalysis;
                } catch (error) {
                    span?.setAttributes({
                        "orchestration.analysis_success": false,
                        "orchestration.error_type":
                            error instanceof Error ? error.constructor.name : typeof error,
                        "orchestration.error_message":
                            error instanceof Error ? error.message : String(error),
                    });

                    logger.error("💥 TEAM FORMATION ANALYSIS FAILED:");
                    logger.error(
                        `   Error: ${error instanceof Error ? error.message : String(error)}`
                    );
                    if (error instanceof Error && error.stack) {
                        logger.error(`   Stack: ${error.stack}`);
                    }

                    throw error;
                }
            },
            {
                "operation.type": "team_formation_analysis",
                "service.name": "tenex-orchestration",
            }
        );
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

    private getLLMProviderDetails(): {
        model?: string;
        baseURL?: string;
        maxTokens?: number;
        temperature?: number;
        provider?: string;
    } | null {
        try {
            // Check if this is an LLMProviderAdapter with getConfig method
            if (
                "getConfig" in this.llmProvider &&
                typeof this.llmProvider.getConfig === "function"
            ) {
                const config = this.llmProvider.config;
                if (config) {
                    return {
                        model: config.model,
                        baseURL: config.baseURL,
                        maxTokens: config.maxTokens,
                        temperature: config.temperature,
                        provider: config.provider,
                    };
                }
            }

            // Try to access provider configuration if available (legacy support)
            if ("config" in this.llmProvider && this.llmProvider.config) {
                const config = this.llmProvider.config as {
                    model?: string;
                    baseURL?: string;
                    maxTokens?: number;
                    temperature?: number;
                    provider?: string;
                };
                return {
                    model: config.model,
                    baseURL: config.baseURL,
                    maxTokens: config.maxTokens,
                    temperature: config.temperature,
                    provider: config.provider,
                };
            }

            // Try alternative property names (legacy support)
            if ("_config" in this.llmProvider && this.llmProvider._config) {
                const config = this.llmProvider._config as {
                    model?: string;
                    baseURL?: string;
                    maxTokens?: number;
                    temperature?: number;
                    provider?: string;
                };
                return {
                    model: config.model,
                    baseURL: config.baseURL,
                    maxTokens: config.maxTokens,
                    temperature: config.temperature,
                    provider: config.provider,
                };
            }

            return null;
        } catch (error) {
            logger.debug(
                `Could not extract LLM provider details: ${error instanceof Error ? error.message : String(error)}`
            );
            return null;
        }
    }

    private hashString(str: string): string {
        let hash = 0;
        if (str.length === 0) return hash.toString();
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString();
    }

    async analyzeAndFormTeam(
        event: NDKEvent,
        context: ProjectContext,
        availableAgents: Map<string, AgentDefinition>
    ): Promise<CombinedAnalysisResponse> {
        return traceFunction(
            "orchestration.team_formation.analyzeAndFormTeam",
            async (span) => {
                try {
                    // Log LLM provider configuration details
                    logger.info(
                        "🧠 TEAM FORMATION ANALYZER - Starting combined analysis and team formation"
                    );
                    logger.info(`   LLM Provider: ${this.llmProvider.constructor.name}`);
                    logger.info(
                        `   Available agents: ${Array.from(availableAgents.keys()).join(", ")}`
                    );

                    // Get LLM config details if available
                    const providerDetails = this.getLLMProviderDetails();
                    if (providerDetails) {
                        logger.info(
                            `   LLM Provider Type: ${providerDetails.provider || "unknown"}`
                        );
                        logger.info(`   LLM Model: ${providerDetails.model || "default"}`);
                        logger.info(`   LLM Base URL: ${providerDetails.baseURL || "default"}`);
                        logger.info(`   LLM Max Tokens: ${providerDetails.maxTokens || "default"}`);
                        logger.info(
                            `   LLM Temperature: ${providerDetails.temperature || "default"}`
                        );

                        span?.setAttributes({
                            "llm.provider_class": this.llmProvider.constructor.name,
                            "llm.provider_type": providerDetails.provider || "unknown",
                            "llm.model": providerDetails.model || "unknown",
                            "llm.base_url": providerDetails.baseURL || "unknown",
                            "llm.max_tokens": providerDetails.maxTokens || 0,
                            "llm.temperature": providerDetails.temperature || 0,
                        });
                    }

                    logger.info(`   Event ID: ${event.id}`);
                    logger.info(`   Event Content: "${event.content}"`);
                    logger.info(`   Project Context: ${context?.title || "unknown"}`);
                    logger.info(`   Max Team Size: ${this.maxTeamSize}`);

                    span?.setAttributes({
                        "orchestration.event_id": event.id || "unknown",
                        "orchestration.event_content_length": event.content?.length || 0,
                        "orchestration.project_title": context?.title || "unknown",
                        "orchestration.available_agents_count": availableAgents.size,
                        "orchestration.max_team_size": this.maxTeamSize,
                    });

                    // Build and log the combined prompt
                    logger.info("📝 Building combined analysis and team formation prompt...");
                    const prompt = this.promptBuilder.buildCombinedAnalysisPrompt(
                        event,
                        context,
                        availableAgents,
                        this.maxTeamSize
                    );

                    logger.info("🎯 FULL COMBINED PROMPT:");
                    logger.info("=".repeat(80));
                    logger.info(prompt);
                    logger.info("=".repeat(80));

                    span?.setAttributes({
                        "orchestration.prompt_length": prompt.length,
                        "orchestration.prompt_hash": this.hashString(prompt),
                    });

                    // Publish typing indicator if available
                    if (this.typingIndicatorPublisher && event) {
                        try {
                            await this.typingIndicatorPublisher.publishTypingIndicator(
                                event,
                                "orchestrator",
                                true,
                                "Analyzing request and forming team...",
                                "You are an AI orchestration system that analyzes requests and forms teams of AI agents to handle them.",
                                prompt
                            );
                        } catch (error) {
                            logger.warn(`Failed to publish typing indicator: ${error}`);
                        }
                    }

                    // Call LLM with telemetry
                    logger.info("🚀 Calling LLM for combined analysis and team formation...");
                    const response = await this.llmProvider.generateResponse(
                        [{ role: "user", content: prompt }],
                        {} // Empty config - will use provider's default
                    );

                    logger.info("📨 LLM COMBINED RESPONSE:");
                    logger.info("=".repeat(80));
                    logger.info(response.content);
                    logger.info("=".repeat(80));

                    span?.setAttributes({
                        "orchestration.response_length": response.content.length,
                        "orchestration.response_hash": this.hashString(response.content),
                    });

                    let rawResponse: CombinedAnalysisResponse;
                    try {
                        // Remove common markdown code block formatting that LLMs often add
                        let content = response.content.trim();

                        // Handle markdown code blocks
                        if (content.startsWith("```json")) {
                            content = content.replace(/^```json\s*/, "").replace(/\s*```$/, "");
                        } else if (content.startsWith("```")) {
                            content = content.replace(/^```\s*/, "").replace(/\s*```$/, "");
                        }

                        logger.info("🔧 Parsing cleaned JSON response...");
                        rawResponse = JSON.parse(content) as CombinedAnalysisResponse;

                        logger.info("✅ Successfully parsed combined response:");
                        logger.info(`   Request Type: ${rawResponse.analysis?.requestType}`);
                        logger.info(
                            `   Required Capabilities: ${rawResponse.analysis?.requiredCapabilities?.join(", ")}`
                        );
                        logger.info(
                            `   Estimated Complexity: ${rawResponse.analysis?.estimatedComplexity}`
                        );
                        logger.info(
                            `   Suggested Strategy: ${rawResponse.analysis?.suggestedStrategy}`
                        );
                        logger.info(`   Team Lead: ${rawResponse.team?.lead}`);
                        logger.info(`   Team Members: ${rawResponse.team?.members?.join(", ")}`);
                    } catch (error) {
                        logger.error("❌ Failed to parse combined response:");
                        logger.error(
                            `   Parse Error: ${error instanceof Error ? error.message : String(error)}`
                        );
                        logger.error(`   Raw Response: ${response.content}`);

                        span?.setAttributes({
                            "orchestration.parse_error": true,
                            "orchestration.parse_error_message":
                                error instanceof Error ? error.message : String(error),
                        });

                        throw new Error(
                            `Failed to parse combined response: ${error instanceof Error ? error.message : String(error)}`
                        );
                    }

                    // Validate required fields
                    if (!this.isValidCombinedResponse(rawResponse)) {
                        logger.error("❌ Invalid combined response: missing required fields");
                        logger.error(`   Raw Response: ${JSON.stringify(rawResponse, null, 2)}`);

                        span?.setAttributes({
                            "orchestration.validation_error": true,
                            "orchestration.validation_error_message": "missing required fields",
                        });

                        throw new Error("Invalid combined response: missing required fields");
                    }

                    // Map strategy string to enum
                    rawResponse.analysis.suggestedStrategy = this.mapStrategy(
                        rawResponse.analysis.suggestedStrategy as string
                    );

                    // Ensure lead is included in members array
                    if (
                        rawResponse.team.lead &&
                        !rawResponse.team.members.includes(rawResponse.team.lead)
                    ) {
                        logger.warn(
                            "⚠️  Lead agent not included in members array - adding automatically"
                        );
                        rawResponse.team.members.unshift(rawResponse.team.lead);
                    }

                    span?.setAttributes({
                        "orchestration.analysis.request_type": rawResponse.analysis.requestType,
                        "orchestration.analysis.complexity":
                            rawResponse.analysis.estimatedComplexity,
                        "orchestration.analysis.capabilities_count":
                            rawResponse.analysis.requiredCapabilities.length,
                        "orchestration.analysis.strategy": rawResponse.analysis.suggestedStrategy,
                        "orchestration.team.lead": rawResponse.team.lead,
                        "orchestration.team.members_count": rawResponse.team.members.length,
                        "orchestration.analysis_success": true,
                    });

                    logger.info("🎉 COMBINED ANALYSIS AND TEAM FORMATION COMPLETE");
                    logger.info(`   Strategy: ${rawResponse.analysis.suggestedStrategy}`);
                    logger.info(`   Team size: ${rawResponse.team.members.length}`);

                    // Stop typing indicator
                    if (this.typingIndicatorPublisher && event) {
                        try {
                            await this.typingIndicatorPublisher.publishTypingIndicator(
                                event,
                                "orchestrator",
                                false
                            );
                        } catch (error) {
                            logger.warn(`Failed to stop typing indicator: ${error}`);
                        }
                    }

                    return rawResponse;
                } catch (error) {
                    span?.setAttributes({
                        "orchestration.analysis_success": false,
                        "orchestration.error_type":
                            error instanceof Error ? error.constructor.name : typeof error,
                        "orchestration.error_message":
                            error instanceof Error ? error.message : String(error),
                    });

                    logger.error("💥 COMBINED ANALYSIS AND TEAM FORMATION FAILED:");
                    logger.error(
                        `   Error: ${error instanceof Error ? error.message : String(error)}`
                    );
                    if (error instanceof Error && error.stack) {
                        logger.error(`   Stack: ${error.stack}`);
                    }

                    throw error;
                }
            },
            {
                "operation.type": "combined_team_formation_analysis",
                "service.name": "tenex-orchestration",
            }
        );
    }

    private isValidCombinedResponse(response: unknown): response is CombinedAnalysisResponse {
        if (!response || typeof response !== "object") return false;

        const obj = response as Record<string, unknown>;

        // Validate analysis section
        if (!obj.analysis || typeof obj.analysis !== "object") return false;
        const analysis = obj.analysis as Record<string, unknown>;
        if (
            typeof analysis.requestType !== "string" ||
            !Array.isArray(analysis.requiredCapabilities) ||
            typeof analysis.estimatedComplexity !== "number" ||
            typeof analysis.suggestedStrategy !== "string" ||
            typeof analysis.reasoning !== "string"
        ) {
            return false;
        }

        // Validate team section
        if (!obj.team || typeof obj.team !== "object") return false;
        const team = obj.team as Record<string, unknown>;
        if (
            typeof team.lead !== "string" ||
            !Array.isArray(team.members) ||
            typeof team.reasoning !== "string"
        ) {
            return false;
        }

        return true;
    }
}

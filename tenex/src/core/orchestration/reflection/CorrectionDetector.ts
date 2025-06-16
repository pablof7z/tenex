import type { CorrectionAnalysis, CorrectionPattern } from "@/core/orchestration/reflection/types";
import type { LLMProvider } from "@/core/orchestration/types";
import type { Conversation } from "@/utils/agents/Conversation";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type { AgentLogger } from "@tenex/shared/logger";

export interface ICorrectionDetector {
    isCorrection(event: NDKEvent, conversation: Conversation): Promise<CorrectionAnalysis | null>;
    detectPattern(
        messages: Array<{ role: string; content: string; timestamp: number }>
    ): CorrectionPattern | null;
}

export class CorrectionDetector implements ICorrectionDetector {
    private static readonly CORRECTION_KEYWORDS = [
        "wrong",
        "incorrect",
        "mistake",
        "error",
        "fix",
        "actually",
        "correction",
        "revise",
        "update",
        "should be",
        "meant to say",
        "let me correct",
        "that's not right",
        "my bad",
    ];

    private static readonly REVISION_KEYWORDS = [
        "revise",
        "update",
        "change",
        "modify",
        "improve",
        "enhance",
        "refactor",
        "redo",
        "rework",
        "adjust",
    ];

    constructor(
        private readonly logger: Logger,
        private readonly llmProvider: LLMProvider
    ) {
        if (!logger) throw new Error("Logger is required");
        if (!llmProvider) throw new Error("LLMProvider is required");
    }

    async isCorrection(
        event: NDKEvent,
        conversation: Conversation
    ): Promise<CorrectionAnalysis | null> {
        this.logger.debug(`Analyzing event ${event.id} for corrections`);

        if (conversation.messages.length === 0) {
            return null;
        }

        const prompt = this.buildCorrectionDetectionPrompt(event, conversation);

        try {
            const response = await this.llmProvider.processRequest({
                model: "default",
                messages: [
                    {
                        role: "system",
                        content: `You are analyzing a conversation to detect if a correction is being made.
                        Respond with a JSON object containing:
                        - isCorrection: boolean
                        - confidence: number (0-1)
                        - issues: array of strings describing what was wrong
                        - affectedAgents: array of agent names affected by the correction`,
                    },
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
            });

            const analysis = this.parseCorrectionAnalysis(response.content);

            if (!analysis.isCorrection) {
                return null;
            }

            this.logger.info(
                `Detected correction with confidence ${analysis.confidence}: ${analysis.issues.join(", ")}`
            );

            return analysis;
        } catch (error) {
            this.logger.error(`Failed to detect correction: ${error}`);
            return null;
        }
    }

    detectPattern(
        messages: Array<{ role: string; content: string; timestamp: number }>
    ): CorrectionPattern | null {
        if (messages.length < 2) {
            return null;
        }

        // Check for user correction pattern
        const userCorrectionPattern = this.detectUserCorrectionPattern(messages);
        if (userCorrectionPattern) {
            return userCorrectionPattern;
        }

        // Check for self-correction pattern
        const selfCorrectionPattern = this.detectSelfCorrectionPattern(messages);
        if (selfCorrectionPattern) {
            return selfCorrectionPattern;
        }

        // Check for revision request pattern
        const revisionPattern = this.detectRevisionRequestPattern(messages);
        if (revisionPattern) {
            return revisionPattern;
        }

        return null;
    }

    private buildCorrectionDetectionPrompt(event: NDKEvent, conversation: Conversation): string {
        const recentMessages = conversation.messages.slice(-5);
        const messageHistory = recentMessages.map((m) => `${m.role}: ${m.content}`).join("\n\n");

        return `Analyze if the following message is correcting a previous error or mistake:

New Message: "${event.content}"

Recent Conversation History:
${messageHistory}

Consider:
1. Is this message pointing out an error or mistake?
2. Is it providing a correction or fix?
3. What specific issues are being addressed?
4. Which agents (if any) made the original error?`;
    }

    private parseCorrectionAnalysis(content: string): CorrectionAnalysis {
        try {
            const parsed = JSON.parse(content);
            return {
                isCorrection: parsed.isCorrection || false,
                confidence: parsed.confidence || 0,
                issues: parsed.issues || [],
                affectedAgents: parsed.affectedAgents,
            };
        } catch (error) {
            this.logger.error(`Failed to parse correction detection response: ${error}`);
            throw error;
        }
    }

    private detectUserCorrectionPattern(
        messages: Array<{ role: string; content: string }>
    ): CorrectionPattern | null {
        for (let i = messages.length - 1; i > 0; i--) {
            const currentMsg = messages[i];
            const previousMsg = messages[i - 1];

            if (currentMsg.role === "user" && previousMsg.role === "assistant") {
                const indicators = this.findKeywords(
                    currentMsg.content,
                    CorrectionDetector.CORRECTION_KEYWORDS
                );
                if (indicators.length > 0) {
                    return {
                        type: "user_correction",
                        indicators,
                        confidence: Math.min(0.7 + indicators.length * 0.1, 1.0),
                        messageIndices: [i - 1, i],
                    };
                }
            }
        }
        return null;
    }

    private detectSelfCorrectionPattern(
        messages: Array<{ role: string; content: string }>
    ): CorrectionPattern | null {
        for (let i = messages.length - 1; i > 0; i--) {
            const currentMsg = messages[i];
            const previousMsg = messages[i - 1];

            if (currentMsg.role === "assistant" && previousMsg.role === "assistant") {
                const indicators = this.findKeywords(
                    currentMsg.content,
                    CorrectionDetector.CORRECTION_KEYWORDS
                );
                if (indicators.length > 0) {
                    return {
                        type: "self_correction",
                        indicators,
                        confidence: Math.min(0.8 + indicators.length * 0.05, 1.0),
                        messageIndices: [i - 1, i],
                    };
                }
            }
        }
        return null;
    }

    private detectRevisionRequestPattern(
        messages: Array<{ role: string; content: string }>
    ): CorrectionPattern | null {
        const lastMessage = messages[messages.length - 1];

        if (lastMessage.role === "user") {
            const indicators = this.findKeywords(
                lastMessage.content,
                CorrectionDetector.REVISION_KEYWORDS
            );
            if (indicators.length > 0) {
                return {
                    type: "revision_request",
                    indicators,
                    confidence: Math.min(0.6 + indicators.length * 0.15, 1.0),
                    messageIndices: [messages.length - 1],
                };
            }
        }
        return null;
    }

    private findKeywords(text: string, keywords: string[]): string[] {
        const lowerText = text.toLowerCase();
        return keywords.filter((keyword) => lowerText.includes(keyword));
    }
}

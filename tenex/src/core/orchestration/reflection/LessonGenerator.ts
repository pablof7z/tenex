import type {
    AgentLesson,
    LessonContext,
    ReflectionTrigger,
} from "@/core/orchestration/reflection/types";
import type { LLMProvider } from "@/core/orchestration/types";
import type { Agent } from "@/utils/agents/Agent";
import type { Conversation } from "@/utils/agents/Conversation";
import type { ConversationMessage } from "@/utils/agents/types";
import type { AgentLogger } from "@tenex/shared/logger";

export interface LessonGenerator {
    generateLessons(trigger: ReflectionTrigger, agents: Agent[]): Promise<AgentLesson[]>;

    deduplicateLessons(lessons: AgentLesson[]): Promise<AgentLesson[]>;
}

export class LessonGeneratorImpl implements LessonGenerator {
    constructor(
        private readonly llmProvider: LLMProvider,
        private readonly logger: AgentLogger
    ) {
        if (!llmProvider) throw new Error("LLMProvider is required");
        if (!logger) throw new Error("Logger is required");
    }

    async generateLessons(trigger: ReflectionTrigger, agents: Agent[]): Promise<AgentLesson[]> {
        const lessons: AgentLesson[] = [];

        // Generate lessons for each agent in parallel
        const lessonPromises = agents.map(async (agent) => {
            try {
                const lesson = await this.generateAgentLesson(trigger, agent);
                if (lesson) {
                    return lesson;
                }
            } catch (error) {
                this.logger.error(`Failed to generate lesson for agent ${agent.name}: ${error}`);
            }
            return null;
        });

        const results = await Promise.all(lessonPromises);

        // Filter out null results
        for (const lesson of results) {
            if (lesson) {
                lessons.push(lesson);
            }
        }

        return lessons;
    }

    async deduplicateLessons(lessons: AgentLesson[]): Promise<AgentLesson[]> {
        if (lessons.length <= 1) return lessons;

        // Build prompt for deduplication
        const prompt = this.buildDeduplicationPrompt(lessons);
        const response = await this.llmProvider.complete(prompt);

        try {
            const deduplicatedIndices = JSON.parse(response.content) as number[];
            return lessons.filter((_, index) => deduplicatedIndices.includes(index));
        } catch (error) {
            this.logger.error(`Failed to parse deduplication response: ${error}`);
            // Return all lessons if deduplication fails
            return lessons;
        }
    }

    private async generateAgentLesson(
        trigger: ReflectionTrigger,
        agent: Agent
    ): Promise<AgentLesson | null> {
        const prompt = this.buildLessonPrompt(trigger, agent);
        const response = await this.llmProvider.complete(prompt);

        try {
            const lessonData = JSON.parse(response.content) as {
                lesson: string;
                confidence: number;
                applicable: boolean;
                context: {
                    errorType?: string;
                    preventionStrategy?: string;
                    relatedCapabilities?: string[];
                };
            };

            if (!lessonData.applicable) {
                return null;
            }

            const context: LessonContext = {
                triggerEventId: (trigger.metadata?.eventId as string) || "",
                conversationId: trigger.conversationId,
                teamId: trigger.metadata?.teamId as string,
                errorType: lessonData.context.errorType,
                preventionStrategy: lessonData.context.preventionStrategy,
                relatedCapabilities: lessonData.context.relatedCapabilities || [],
                timestamp: Date.now(),
            };

            // Get agent's NDK event ID (assuming it's stored in agent metadata)
            const ndkAgentEventId = await this.getAgentNDKEventId(agent);

            return {
                id: `lesson_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                agentId: ndkAgentEventId,
                agentName: agent.name,
                taskId: trigger.taskId,
                type: "mistake" as const,
                title: lessonData.lesson,
                content: lessonData.lesson,
                context: JSON.stringify(context),
                impact:
                    lessonData.confidence >= 0.8
                        ? "high"
                        : lessonData.confidence >= 0.5
                          ? "medium"
                          : "low",
                tags: lessonData.context.relatedCapabilities || [],
                timestamp: Date.now(),
            };
        } catch (error) {
            this.logger.error(`Failed to parse lesson response for agent ${agent.name}: ${error}`);
            return null;
        }
    }

    private buildLessonPrompt(trigger: ReflectionTrigger, agent: Agent): string {
        const triggerAny = trigger as any;
        const agentAny = agent as any;
        return `You are helping agent "${agent.name}" learn from a correction or mistake.

Context:
- Trigger Event: ${triggerAny.triggerEvent?.content || trigger.reason}
- Detected Issues: ${JSON.stringify(triggerAny.detectedIssues || [])}
- Conversation History: ${triggerAny.conversation ? this.summarizeConversation(triggerAny.conversation) : "Not available"}

Agent Role: ${agentAny.getRole ? agentAny.getRole() : "Not specified"}
Agent Capabilities: ${agentAny.getCapabilities ? agentAny.getCapabilities() : "Not specified"}

Analyze whether this correction is relevant to this specific agent and what lesson they should learn.

Respond with a JSON object:
{
    "applicable": boolean, // false if this correction doesn't apply to this agent
    "lesson": "string", // concise, actionable lesson (one sentence)
    "confidence": number, // 0-1, how confident you are this lesson is valuable
    "context": {
        "errorType": "string", // type of error (e.g., "logic_error", "misunderstanding", "incomplete_implementation")
        "preventionStrategy": "string", // how to prevent this in the future
        "relatedCapabilities": ["string"] // which agent capabilities this relates to
    }
}`;
    }

    private buildDeduplicationPrompt(lessons: AgentLesson[]): string {
        const lessonDescriptions = lessons
            .map((lesson, index) => `${index}: [${lesson.agentName}] ${lesson.content}`)
            .join("\n");

        return `Review these lessons learned from a correction and identify which ones are unique and valuable.
Remove duplicates and overly similar lessons, keeping only the most specific and actionable ones.

Lessons:
${lessonDescriptions}

Return a JSON array of indices for the lessons to keep. For example: [0, 2, 3]`;
    }

    private summarizeConversation(conversation: Conversation): string {
        // Simple conversation summary - in real implementation would be more sophisticated
        const messages = conversation.getFormattedMessages();
        const recentMessages = messages.slice(-5);
        return recentMessages.map((m) => `${m.role}: ${m.content.substring(0, 100)}...`).join("\n");
    }

    private async getAgentNDKEventId(agent: Agent): Promise<string> {
        // This would need to be implemented based on how agent metadata is stored
        // For now, returning a placeholder
        return `placeholder-ndk-event-${agent.name}`;
    }
}

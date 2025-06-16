import { logger } from "@tenex/shared/logger";
import type { ConversationMessage } from "@tenex/types";
import type { LLMProvider } from "../../../utils/agents/llm/types";
import type { Team } from "../types";

export interface ReflectionSession {
    id: string;
    taskId: string;
    taskDescription: string;
    team: Team;
    startTime: number;
    endTime?: number;
    outcome: "success" | "failure" | "partial" | "ongoing";
    lessons: Lesson[];
    insights: Insight[];
    improvements: Improvement[];
}

export interface Lesson {
    id: string;
    type: "mistake" | "success" | "discovery" | "optimization";
    description: string;
    context: string;
    impact: "high" | "medium" | "low";
    tags: string[];
}

export interface Insight {
    id: string;
    observation: string;
    evidence: string[];
    confidence: number; // 0-1
    applicability: string[]; // Which types of tasks this applies to
}

export interface Improvement {
    id: string;
    current: string;
    proposed: string;
    rationale: string;
    priority: "high" | "medium" | "low";
    effort: "trivial" | "small" | "medium" | "large";
}

export interface ReflectionConfig {
    enabled: boolean;
    autoReflect?: boolean; // Automatically reflect after task completion
    minConfidence?: number; // Minimum confidence for insights (0-1)
    maxLessonsPerSession?: number;
}

export interface ReflectionContext {
    taskId: string;
    taskDescription: string;
    team: Team;
    messages: ConversationMessage[];
    outcome: ReflectionSession["outcome"];
    metadata?: Record<string, unknown>;
}

export class ReflectionSystem {
    private sessions: Map<string, ReflectionSession> = new Map();
    private config: ReflectionConfig;
    private llmProvider: LLMProvider;
    private lessonHistory: Lesson[] = [];

    constructor(config: ReflectionConfig, llmProvider: LLMProvider) {
        this.config = config;
        this.llmProvider = llmProvider;
    }

    /**
     * Start a reflection session for a completed task
     */
    async startReflection(context: ReflectionContext): Promise<ReflectionSession> {
        if (!this.config.enabled) {
            return this.createEmptySession(context);
        }

        const sessionId = `reflection-${context.taskId}-${Date.now()}`;
        const session: ReflectionSession = {
            id: sessionId,
            taskId: context.taskId,
            taskDescription: context.taskDescription,
            team: context.team,
            startTime: Date.now(),
            outcome: context.outcome,
            lessons: [],
            insights: [],
            improvements: [],
        };

        this.sessions.set(sessionId, session);
        logger.info(`Started reflection session ${sessionId} for task ${context.taskId}`);

        // Analyze the task execution
        try {
            const analysis = await this.analyzeTaskExecution(context);
            session.lessons = analysis.lessons;
            session.insights = analysis.insights;
            session.improvements = analysis.improvements;

            // Add lessons to history
            this.lessonHistory.push(...analysis.lessons);

            // Prune history if needed
            if (
                this.config.maxLessonsPerSession &&
                this.lessonHistory.length > this.config.maxLessonsPerSession * 10
            ) {
                this.lessonHistory = this.lessonHistory.slice(
                    -this.config.maxLessonsPerSession * 10
                );
            }
        } catch (error) {
            logger.error("Failed to analyze task execution", { error });
        }

        session.endTime = Date.now();
        logger.info(`Completed reflection session ${sessionId}`);

        return session;
    }

    /**
     * Get lessons learned from a specific session
     */
    getLessons(sessionId: string): Lesson[] {
        const session = this.sessions.get(sessionId);
        return session?.lessons || [];
    }

    /**
     * Get all lessons matching certain criteria
     */
    searchLessons(criteria: {
        type?: Lesson["type"];
        impact?: Lesson["impact"];
        tags?: string[];
        limit?: number;
    }): Lesson[] {
        let lessons = [...this.lessonHistory];

        if (criteria.type) {
            lessons = lessons.filter((l) => l.type === criteria.type);
        }

        if (criteria.impact) {
            lessons = lessons.filter((l) => l.impact === criteria.impact);
        }

        if (criteria.tags && criteria.tags.length > 0) {
            lessons = lessons.filter((l) => criteria.tags!.some((tag) => l.tags.includes(tag)));
        }

        if (criteria.limit) {
            lessons = lessons.slice(-criteria.limit);
        }

        return lessons;
    }

    /**
     * Get insights from recent reflections
     */
    getRecentInsights(limit = 10): Insight[] {
        const recentSessions = Array.from(this.sessions.values())
            .sort((a, b) => (b.startTime || 0) - (a.startTime || 0))
            .slice(0, 5);

        const insights: Insight[] = [];
        for (const session of recentSessions) {
            insights.push(...session.insights);
        }

        return insights
            .filter((i) => !this.config.minConfidence || i.confidence >= this.config.minConfidence)
            .slice(0, limit);
    }

    /**
     * Get improvement suggestions
     */
    getImprovements(priority?: Improvement["priority"]): Improvement[] {
        const improvements: Improvement[] = [];

        for (const session of this.sessions.values()) {
            improvements.push(...session.improvements);
        }

        if (priority) {
            return improvements.filter((i) => i.priority === priority);
        }

        return improvements;
    }

    /**
     * Analyze task execution using LLM
     */
    private async analyzeTaskExecution(context: ReflectionContext): Promise<{
        lessons: Lesson[];
        insights: Insight[];
        improvements: Improvement[];
    }> {
        const prompt = this.buildAnalysisPrompt(context);

        const response = await this.llmProvider.generateResponse([
            {
                role: "system",
                content: `You are a reflection system analyzing task execution to extract lessons, insights, and improvements. 
Focus on concrete, actionable learnings. Be specific and avoid generic observations.
Output valid JSON matching the required schema.`,
            },
            { role: "user", content: prompt },
        ]);

        try {
            const analysis = JSON.parse(response.content);
            return {
                lessons: this.validateLessons(analysis.lessons || []),
                insights: this.validateInsights(analysis.insights || []),
                improvements: this.validateImprovements(analysis.improvements || []),
            };
        } catch (error) {
            logger.error("Failed to parse reflection analysis", { error });
            return { lessons: [], insights: [], improvements: [] };
        }
    }

    /**
     * Build analysis prompt from context
     */
    private buildAnalysisPrompt(context: ReflectionContext): string {
        const messageHistory = context.messages
            .slice(-20) // Last 20 messages
            .map((m) => `${m.role}: ${m.content.substring(0, 200)}...`)
            .join("\n");

        return `Analyze this task execution:

Task: ${context.taskDescription}
Team: ${context.team.members.join(", ")}
Outcome: ${context.outcome}

Recent message history:
${messageHistory}

Extract:
1. Lessons learned (mistakes, successes, discoveries, optimizations)
2. Insights (patterns, observations with evidence)
3. Improvements (specific suggestions for better execution)

Return as JSON:
{
  "lessons": [
    {
      "type": "mistake|success|discovery|optimization",
      "description": "Brief description",
      "context": "When/where this occurred",
      "impact": "high|medium|low",
      "tags": ["relevant", "tags"]
    }
  ],
  "insights": [
    {
      "observation": "What was observed",
      "evidence": ["specific examples"],
      "confidence": 0.0-1.0,
      "applicability": ["task types this applies to"]
    }
  ],
  "improvements": [
    {
      "current": "What currently happens",
      "proposed": "What should happen instead",
      "rationale": "Why this is better",
      "priority": "high|medium|low",
      "effort": "trivial|small|medium|large"
    }
  ]
}`;
    }

    /**
     * Validate and clean lessons
     */
    private validateLessons(lessons: any[]): Lesson[] {
        const validated: Lesson[] = [];

        for (const lesson of lessons) {
            if (lesson.description && lesson.type) {
                validated.push({
                    id: `lesson-${Date.now()}-${validated.length}`,
                    type: lesson.type as Lesson["type"],
                    description: String(lesson.description),
                    context: String(lesson.context || ""),
                    impact: (lesson.impact as Lesson["impact"]) || "medium",
                    tags: Array.isArray(lesson.tags) ? lesson.tags : [],
                });
            }
        }

        return validated;
    }

    /**
     * Validate and clean insights
     */
    private validateInsights(insights: any[]): Insight[] {
        const validated: Insight[] = [];

        for (const insight of insights) {
            if (insight.observation) {
                validated.push({
                    id: `insight-${Date.now()}-${validated.length}`,
                    observation: String(insight.observation),
                    evidence: Array.isArray(insight.evidence) ? insight.evidence.map(String) : [],
                    confidence: Number(insight.confidence) || 0.5,
                    applicability: Array.isArray(insight.applicability)
                        ? insight.applicability.map(String)
                        : [],
                });
            }
        }

        return validated;
    }

    /**
     * Validate and clean improvements
     */
    private validateImprovements(improvements: any[]): Improvement[] {
        const validated: Improvement[] = [];

        for (const improvement of improvements) {
            if (improvement.current && improvement.proposed) {
                validated.push({
                    id: `improvement-${Date.now()}-${validated.length}`,
                    current: String(improvement.current),
                    proposed: String(improvement.proposed),
                    rationale: String(improvement.rationale || ""),
                    priority: (improvement.priority as Improvement["priority"]) || "medium",
                    effort: (improvement.effort as Improvement["effort"]) || "medium",
                });
            }
        }

        return validated;
    }

    /**
     * Create empty session when reflection is disabled
     */
    private createEmptySession(context: ReflectionContext): ReflectionSession {
        return {
            id: `empty-${context.taskId}`,
            taskId: context.taskId,
            taskDescription: context.taskDescription,
            team: context.team,
            startTime: Date.now(),
            endTime: Date.now(),
            outcome: context.outcome,
            lessons: [],
            insights: [],
            improvements: [],
        };
    }

    /**
     * Clear old sessions to prevent memory growth
     */
    clearOldSessions(maxAge = 24 * 60 * 60 * 1000): void {
        const cutoff = Date.now() - maxAge;
        const toDelete: string[] = [];

        for (const [id, session] of this.sessions) {
            if (session.startTime < cutoff) {
                toDelete.push(id);
            }
        }

        for (const id of toDelete) {
            this.sessions.delete(id);
        }

        logger.info(`Cleared ${toDelete.length} old reflection sessions`);
    }
}

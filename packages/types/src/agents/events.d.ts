/**
 * Agent-specific event types
 *
 * Note: For actual NDK event classes like NDKAgent (kind 4199),
 * use the NDK library directly. These interfaces are for content
 * structures and metadata only.
 */
/**
 * Agent lesson content structure
 */
export interface AgentLessonContent {
    mistake: string;
    lesson: string;
    context?: string;
    timestamp: number;
}
//# sourceMappingURL=events.d.ts.map
import type { NDKKind } from "@nostr-dev-kit/ndk";
import { useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { Brain, MessageSquare, Send } from "lucide-react";
import { useState } from "react";
import type { NDKAgentLesson } from "../../../../tenex/src/events/NDKAgentLesson.ts";
import { useTimeFormat } from "../../hooks/useTimeFormat";
import { EVENT_KINDS } from "../../lib/constants";
import { ndk } from "../../lib/ndk-setup";
import type { NDKAgent } from "../../lib/ndk-setup";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { ProfileDisplay } from "../ProfileDisplay";

interface AgentLessonsTabProps {
    agent: NDKAgent;
    lessons: NDKAgentLesson[];
}

interface LessonRepliesProps {
    lesson: NDKAgentLesson;
}

function LessonReplies({ lesson }: LessonRepliesProps) {
    const [replyText, setReplyText] = useState("");
    const [isReplying, setIsReplying] = useState(false);
    const [showReplyForm, setShowReplyForm] = useState(false);
    const { formatRelativeTime } = useTimeFormat();

    // Fetch replies to this lesson
    const { events: replies } = useSubscribe(
        [{ kinds: [EVENT_KINDS.NOTE as NDKKind], "#e": [lesson.id] }],
        {},
        [lesson.id]
    );

    const handleReply = async () => {
        if (!replyText.trim() || isReplying) return;

        try {
            setIsReplying(true);
            
            // Create reply using lesson.reply()
            const replyEvent = lesson.reply();
            replyEvent.content = replyText.trim();
            
            await replyEvent.sign();
            await replyEvent.publish();
            
            setReplyText("");
            setShowReplyForm(false);
        } catch (error) {
            console.error("Failed to post reply:", error);
        } finally {
            setIsReplying(false);
        }
    };

    return (
        <div className="mt-3 space-y-3">
            {/* Existing replies */}
            {replies && replies.length > 0 && (
                <div className="space-y-2">
                    {replies.map((reply) => {
                        const timestamp = reply.created_at ? new Date(reply.created_at * 1000) : null;
                        return (
                            <div key={reply.id} className="bg-muted/20 p-3 rounded-lg border-l-2 border-blue-500/30">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <ProfileDisplay pubkey={reply.pubkey} size="sm" className="text-sm" />
                                    {timestamp && (
                                        <time className="text-xs text-muted-foreground" title={timestamp.toISOString()}>
                                            {formatRelativeTime(timestamp.getTime() / 1000)}
                                        </time>
                                    )}
                                </div>
                                <p className="text-sm text-foreground leading-relaxed">{reply.content}</p>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Reply form */}
            {showReplyForm ? (
                <div className="bg-muted/20 p-3 rounded-lg border border-border">
                    <Textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write your reply..."
                        className="mb-3 resize-none"
                        rows={3}
                    />
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={handleReply}
                            disabled={!replyText.trim() || isReplying}
                            size="sm"
                            className="flex items-center gap-2"
                        >
                            <Send className="w-3 h-3" />
                            {isReplying ? "Posting..." : "Reply"}
                        </Button>
                        <Button
                            onClick={() => {
                                setShowReplyForm(false);
                                setReplyText("");
                            }}
                            variant="outline"
                            size="sm"
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            ) : (
                <Button
                    onClick={() => setShowReplyForm(true)}
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground flex items-center gap-2"
                >
                    <MessageSquare className="w-3 h-3" />
                    Reply
                </Button>
            )}
        </div>
    );
}

export function AgentLessonsTab({ agent, lessons }: AgentLessonsTabProps) {
    const { formatDateOnly } = useTimeFormat();

    if (!lessons || lessons.length === 0) {
        return (
            <div className="bg-card rounded-xl shadow-sm border border-border p-8">
                <div className="text-center py-12">
                    <Brain className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No Lessons Yet</h3>
                    <p className="text-muted-foreground">
                        This agent hasn't learned any lessons yet. Lessons will appear here as the agent gains experience.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-card rounded-xl shadow-sm border border-border p-8">
            <div className="space-y-6">
                {/* Header */}
                <div className="border-b border-border pb-6">
                    <div className="flex items-center gap-2">
                        <Brain className="w-5 h-5 text-pink-600" />
                        <h3 className="text-lg font-semibold text-foreground">Lessons Learned</h3>
                        <Badge variant="secondary" className="ml-auto">
                            {lessons.length} lesson{lessons.length !== 1 ? "s" : ""}
                        </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm mt-2">
                        Knowledge gained by this agent through experience and feedback.
                    </p>
                </div>

                {/* Lessons list */}
                <div className="space-y-4">
                    {lessons.map((lesson) => {
                        const title = lesson.title;
                        const timestamp = lesson.created_at ? new Date(lesson.created_at * 1000) : null;

                        return (
                            <div
                                key={lesson.id}
                                className="bg-muted/30 p-6 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <h4 className="font-semibold text-foreground">
                                        {title || "Untitled Lesson"}
                                    </h4>
                                    {timestamp && (
                                        <time
                                            className="text-xs text-muted-foreground whitespace-nowrap"
                                            dateTime={timestamp.toISOString()}
                                            title={timestamp.toISOString()}
                                        >
                                            {formatDateOnly(timestamp.getTime() / 1000)}
                                        </time>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {lesson.lesson}
                                    </p>
                                    
                                    {/* Show creator info */}
                                    <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                                        <span className="text-xs text-muted-foreground">Learned by:</span>
                                        <ProfileDisplay
                                            pubkey={lesson.pubkey}
                                            size="xs"
                                            className="text-xs"
                                        />
                                    </div>

                                    {/* Replies section */}
                                    <LessonReplies lesson={lesson} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
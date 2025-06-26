import type { NDKEvent } from "@nostr-dev-kit/ndk-hooks";
import { useProfileValue } from "@nostr-dev-kit/ndk-hooks";
import { Clock, MessageCircle } from "lucide-react";
import { useMemo } from "react";
import { useTimeFormat } from "../../hooks/useTimeFormat";

interface ThreadOverviewProps {
    thread: NDKEvent;
    replies: NDKEvent[];
    onClick?: () => void;
}

export function ThreadCard({ thread, replies, onClick }: ThreadOverviewProps) {
    const { formatRelativeTime } = useTimeFormat({ relativeFormat: "short" });

    // Get thread title
    const getThreadTitle = () => {
        const titleTag = thread.tags?.find((tag) => tag[0] === "title")?.[1];
        if (titleTag) return titleTag;

        const firstLine = thread.content?.split("\n")[0] || "Untitled Thread";
        return firstLine.length > 60 ? `${firstLine.slice(0, 60)}...` : firstLine;
    };

    // Get thread replies for this thread
    const threadReplies = useMemo(() => {
        return replies
            .filter((reply) => {
                const rootTag = reply.tags?.find((tag) => tag[0] === "e" && tag[3] === "root")?.[1];
                const replyTag = reply.tags?.find(
                    (tag) => tag[0] === "e" && tag[3] === "reply"
                )?.[1];
                return rootTag === thread.id || replyTag === thread.id;
            })
            .sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    }, [replies, thread.id]);


    // Get latest reply
    const latestReply = threadReplies[0];
    const latestActivity = latestReply || thread;

    // Get author info
    const AuthorInfo = ({ pubkey }: { pubkey: string }) => {
        const profile = useProfileValue(pubkey);

        const getAuthorName = () => {
            if (profile?.name) return profile.name;
            if (profile?.displayName) return profile.displayName;
            return `User ${pubkey.slice(0, 8)}`;
        };

        return <span className="text-xs font-medium text-foreground">{getAuthorName()}</span>;
    };

    // Determine thread activity level
    const getActivityLevel = () => {
        const replyCount = threadReplies.length;
        if (replyCount === 0) return "quiet";
        if (replyCount < 5) return "moderate";
        return "active";
    };

    const activityLevel = getActivityLevel();

    const getActivityColor = () => {
        switch (activityLevel) {
            case "active":
                return "border-blue-500/20 bg-blue-500/5";
            case "moderate":
                return "border-amber-500/20 bg-amber-500/5";
            default:
                return "border-gray-300/20 bg-gray-100/5";
        }
    };

    return (
        <div
            className={`bg-card p-3 border-b cursor-pointer transition-all hover:shadow-sm ${getActivityColor()}`}
            onClick={onClick}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onClick?.();
                }
            }}
        >
            <div className="flex items-start gap-3">
                <div className="mt-0.5">
                    <MessageCircle className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-foreground mb-1">{getThreadTitle()}</h4>

                    <div className="space-y-2">
                        {/* Latest activity preview */}
                        {latestReply && (
                            <div className="text-xs text-muted-foreground">
                                <div>
                                    <AuthorInfo pubkey={latestActivity.pubkey} />
                                    <span className="mx-1">replied:</span>
                                    <span className="line-clamp-1">
                                        {latestActivity.content.length > 80
                                            ? `${latestActivity.content.slice(0, 80)}...`
                                            : latestActivity.content}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Thread stats */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>{formatRelativeTime(latestActivity.created_at!)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

import type { NDKEvent } from "@nostr-dev-kit/ndk-hooks";
import { useProfileValue } from "@nostr-dev-kit/ndk-hooks";
import { MessageCircle } from "lucide-react";

interface ThreadItemProps {
    thread: NDKEvent;
    unreadCount: number;
    recentMessage?: { content: string; timestamp: number };
    onThreadClick: () => void;
    getThreadTitle: (thread: NDKEvent) => string;
    formatTime: (timestamp: number) => string;
}

export function ThreadItem({
    thread,
    unreadCount,
    recentMessage,
    onThreadClick,
    getThreadTitle,
    formatTime,
}: ThreadItemProps) {
    const profile = useProfileValue(thread.pubkey);

    const getAuthorName = () => {
        if (profile?.name) return profile.name;
        if (profile?.displayName) return profile.displayName;
        return `User ${thread.pubkey.slice(0, 8)}`;
    };

    return (
        <div
            className="bg-card p-3 border-b cursor-pointer transition-all hover:shadow-sm hover:bg-muted/50"
            onClick={onThreadClick}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onThreadClick();
                }
            }}
        >
            <div className="flex items-start gap-3">
                <div className="mt-0.5">
                    <MessageCircle className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-medium text-foreground truncate">
                            {getThreadTitle(thread)}
                        </h4>
                        {unreadCount > 0 && (
                            <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full ml-2 flex-shrink-0">
                                {unreadCount}
                            </span>
                        )}
                    </div>

                    <div className="space-y-1">
                        {recentMessage && (
                            <div className="text-xs text-muted-foreground">
                                <span className="line-clamp-1">
                                    {recentMessage.content.length > 80
                                        ? `${recentMessage.content.slice(0, 80)}...`
                                        : recentMessage.content}
                                </span>
                            </div>
                        )}

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{getAuthorName()}</span>
                            <span>•</span>
                            <span>{formatTime(recentMessage?.timestamp || thread.created_at!)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
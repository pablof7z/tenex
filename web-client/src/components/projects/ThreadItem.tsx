import type { NDKEvent } from "@nostr-dev-kit/ndk-hooks";
import { Badge } from "../ui/badge";

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
    return (
        <div className="overflow-hidden rounded-lg sm:rounded-xl mx-0.5 sm:mx-1 bg-card border border-border">
            <div
                className="group flex items-center p-2.5 sm:p-3 cursor-pointer transition-all duration-200 ease-out border border-transparent bg-card hover:bg-accent hover:shadow-sm active:scale-[0.98]"
                onClick={onThreadClick}
            >
                {/* Thread Icon */}
                <div className="mr-3 sm:mr-4 flex-shrink-0">
                    <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-0.5 sm:mb-1">
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground truncate text-sm sm:text-[15px] leading-tight">
                                {getThreadTitle(thread)}
                            </h3>
                            <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1">
                                <span className="text-xs text-muted-foreground hidden sm:inline">
                                    {formatTime(thread.created_at!)}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            {unreadCount > 0 && (
                                <Badge
                                    variant="destructive"
                                    className="h-5 px-1.5 text-xs font-medium"
                                >
                                    {unreadCount}
                                </Badge>
                            )}
                        </div>
                    </div>
                    {recentMessage && (
                        <p className="text-xs sm:text-sm text-muted-foreground truncate leading-relaxed">
                            {recentMessage.content.length > 80
                                ? `${recentMessage.content.slice(0, 80)}...`
                                : recentMessage.content}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

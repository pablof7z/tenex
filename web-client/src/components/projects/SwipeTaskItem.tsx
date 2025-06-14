import { memo, useRef } from "react";
import type { NDKTask } from "@nostr-dev-kit/ndk-hooks";
import { Archive, MoreVertical, Trash2 } from "lucide-react";
import { useSwipeGesture } from "../../hooks/useSwipeGesture";
import { Badge } from "../ui/badge";

interface SwipeTaskItemProps {
    task: NDKTask;
    unreadCount: number;
    onTaskClick: () => void;
    onDelete: () => void;
    getTaskTitle: (task: NDKTask) => string;
    getTaskDescription: (task: NDKTask) => string;
}

export const SwipeTaskItem = memo(function SwipeTaskItem({
    task,
    unreadCount,
    onTaskClick,
    onDelete,
    getTaskTitle,
    getTaskDescription,
}: SwipeTaskItemProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    const { swipeOffset, isActionTriggered, handlers } = useSwipeGesture({
        thresholds: { delete: 60, archive: 100, more: 140 },
        maxSwipeDistance: 180,
        onDelete,
        onArchive: () => alert(`Archive task: ${getTaskTitle(task)}`),
        onMore: () => alert(`More options for: ${getTaskTitle(task)}`),
    });

    // Get action states based on offset
    const deleteActive = swipeOffset >= 60;
    const archiveActive = swipeOffset >= 100;
    const moreActive = swipeOffset >= 140;

    return (
        <div className="relative overflow-hidden rounded-lg sm:rounded-xl mx-0.5 sm:mx-1 bg-card border border-border">
            {/* Action Background - Multiple Actions */}
            <div
                className="absolute inset-y-0 left-0 flex"
                style={{
                    width: `${swipeOffset}px`,
                    transition: isActionTriggered ? "none" : "width 0.2s ease-out",
                }}
            >
                {/* Delete Action (60px+) */}
                <div
                    className={`flex items-center justify-center transition-all duration-200 ${
                        deleteActive ? "w-16 bg-red-500" : "w-0"
                    }`}
                >
                    <Trash2 className="w-4 h-4 text-white flex-shrink-0" />
                </div>

                {/* Archive Action (100px+) */}
                <div
                    className={`flex items-center justify-center transition-all duration-200 ${
                        archiveActive ? "w-16 bg-yellow-500" : "w-0"
                    }`}
                >
                    <Archive className="w-4 h-4 text-white flex-shrink-0" />
                </div>

                {/* More Action (140px+) */}
                <div
                    className={`flex items-center justify-center transition-all duration-200 ${
                        moreActive ? "w-16 bg-blue-500" : "w-0"
                    }`}
                >
                    <MoreVertical className="w-4 h-4 text-white flex-shrink-0" />
                </div>
            </div>

            {/* Task Content */}
            <div
                ref={containerRef}
                className="relative bg-card"
                style={{
                    transform: `translateX(${swipeOffset}px)`,
                    transition: isActionTriggered ? "none" : "transform 0.2s ease-out",
                }}
                {...handlers}
            >
                <div
                    className="group flex items-center p-2.5 sm:p-3 cursor-pointer transition-all duration-200 ease-out border border-transparent bg-card hover:bg-accent hover:shadow-sm active:scale-[0.98]"
                    onClick={onTaskClick}
                >
                    {/* Task Status Indicator */}
                    <div className="mr-3 sm:mr-4 flex-shrink-0">
                        <div className="w-5 h-5 bg-muted border-2 border-muted-foreground/30 rounded-full" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-0.5 sm:mb-1">
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-foreground truncate text-sm sm:text-[15px] leading-tight">
                                    {getTaskTitle(task)}
                                </h3>
                                <p className="text-xs sm:text-sm text-muted-foreground truncate mt-0.5 leading-relaxed">
                                    {getTaskDescription(task)}
                                </p>
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
                    </div>
                </div>
            </div>
        </div>
    );
});

import { type NDKProject, type NDKTask, useEvent, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { ArrowLeft, MessageSquare, X } from "lucide-react";
import { useMemo } from "react";
import { useTimeFormat } from "../../hooks/useTimeFormat";
import { ChatInterface } from "../ChatInterface";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

interface TaskUpdatesProps {
    project: NDKProject;
    taskId: string;
    onBack: () => void;
    embedded?: boolean; // For use in split-screen layout
}

export function TaskUpdates({ project, taskId, onBack, embedded = false }: TaskUpdatesProps) {
    // Get the task details
    const task = useEvent<NDKTask>(taskId || false) as NDKTask | null;

    // Get status updates for this task (NIP-22 replies - kind 1111 events with 'e' tag referencing the task)
    const { events: statusUpdates } = useSubscribe(
        task
            ? [
                  {
                      kinds: [1111],
                      "#e": [task.id],
                  },
              ]
            : false,
        {},
        [task?.id]
    );

    const { formatAbsoluteTime } = useTimeFormat();

    // Sort status updates chronologically (oldest first for chat-like experience)
    const sortedUpdates = useMemo(() => {
        if (!statusUpdates) return [];
        return [...statusUpdates].sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0));
    }, [statusUpdates]);

    const getTaskTitle = (task: NDKTask) => {
        const titleTag = task.tags?.find((tag) => tag[0] === "title")?.[1];
        if (titleTag) return titleTag;

        const firstLine = task.content?.split("\n")[0] || "Untitled Task";
        return firstLine.length > 50 ? `${firstLine.slice(0, 50)}...` : firstLine;
    };

    if (!task) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-lg font-semibold text-foreground mb-2">Task not found</h2>
                    <p className="text-muted-foreground mb-4">
                        This task may have been deleted or moved.
                    </p>
                    <Button onClick={onBack} variant="outline">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Go Back
                    </Button>
                </div>
            </div>
        );
    }

    const header = embedded ? (
        // Simplified header for embedded mode
        <div className="bg-card border-b border-border px-4 py-3">
            <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold text-foreground truncate mb-1">
                        {getTaskTitle(task)}
                    </h2>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                            {formatAbsoluteTime(task.created_at!)}
                        </span>
                        <Badge variant="outline" className="text-xs">
                            {sortedUpdates.length} updates
                        </Badge>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onBack} className="w-8 h-8">
                    <X className="w-4 h-4" />
                </Button>
            </div>
        </div>
    ) : (
        // Full header for standalone mode
        <div className="bg-card/95 border-b border-border backdrop-blur-xl sticky top-0 z-50">
            <div className="flex items-center justify-between px-3 sm:px-4 py-3 sm:py-4">
                <div className="flex items-center gap-2 sm:gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onBack}
                        className="w-8 h-8 sm:w-9 sm:h-9"
                    >
                        <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                    </Button>
                    <div className="min-w-0 flex-1">
                        <h1 className="text-lg sm:text-xl font-semibold text-foreground truncate">
                            {getTaskTitle(task)}
                        </h1>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">
                                {formatAbsoluteTime(task.created_at!)}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                        {sortedUpdates.length} updates
                    </Badge>
                </div>
            </div>
        </div>
    );

    return (
        <div
            className={
                embedded
                    ? "h-full bg-card flex flex-col"
                    : "h-screen bg-background flex flex-col relative"
            }
        >
            {/* Header */}
            {header}

            {/* Task Description as First Message */}
            <div className="bg-blue-50/50 border-b border-blue-100 p-4 max-h-screen overflow-y-auto">
                <div className="flex gap-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm text-blue-900">
                                Task Created
                            </span>
                            <span className="text-xs text-blue-600">
                                {formatAbsoluteTime(task.created_at!)}
                            </span>
                        </div>
                        <div className="text-sm text-blue-800 whitespace-pre-wrap leading-relaxed">
                            {task.content || "No description provided"}
                        </div>
                    </div>
                </div>
            </div>

            {/* Chat Interface */}
            <div className="flex-1 overflow-hidden">
                <ChatInterface
                    statusUpdates={sortedUpdates}
                    taskId={taskId}
                    project={project}
                    inputPlaceholder="Add a comment..."
                    allowInput={true}
                    className={embedded ? "h-full" : "h-full min-h-screen"}
                />
            </div>
        </div>
    );
}

import type { NDKEvent, NDKTask } from "@nostr-dev-kit/ndk-hooks";
import { useProfileValue } from "@nostr-dev-kit/ndk-hooks";
import { ProfileUtils, StatusUtils, TaskUtils } from "../../lib/utils/business";
import { AlertCircle, CheckCircle2, Circle, Clock } from "lucide-react";
import { useMemo } from "react";
import { useTimeFormat } from "../../hooks/useTimeFormat";

interface TaskOverviewProps {
    task: NDKTask;
    statusUpdates: NDKEvent[];
    onClick?: () => void;
}

export function TaskOverview({ task, statusUpdates, onClick }: TaskOverviewProps) {
    // Get task title
    const getTaskTitle = () => {
        return TaskUtils.getTaskTitle(task);
    };

    // Get latest status update for this task
    const latestUpdate = useMemo(() => {
        return statusUpdates
            .filter((update) => {
                const taskId = update.tags?.find((tag) => tag[0] === "e" && tag[3] === "task")?.[1];
                return taskId === task.id;
            })
            .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))[0];
    }, [statusUpdates, task.id]);

    // Get agent profile for latest update
    const profile = useProfileValue(latestUpdate?.pubkey || "");

    // Get agent info for latest update
    const AgentInfo = () => {
        if (!latestUpdate) return null;
        const agentTag = latestUpdate.tagValue("agent");

        const getAgentName = () => {
            return ProfileUtils.getDisplayName(
                profile || null,
                latestUpdate.pubkey,
                agentTag || undefined
            );
        };

        return <span className="text-xs text-muted-foreground">{getAgentName()}</span>;
    };

    // Determine task status based on latest update
    const getTaskStatus = () => {
        if (!latestUpdate) return "pending";

        const content = latestUpdate.content.toLowerCase();
        if (
            content.includes("completed") ||
            content.includes("done") ||
            content.includes("finished")
        ) {
            return "completed";
        }
        if (content.includes("error") || content.includes("failed") || content.includes("issue")) {
            return "error";
        }
        if (
            content.includes("working") ||
            content.includes("progress") ||
            content.includes("started")
        ) {
            return "in_progress";
        }
        return "pending";
    };

    const status = getTaskStatus();

    // Get status icon and color
    const getStatusIcon = () => {
        const iconMap: Record<string, React.ReactElement> = {
            completed: <CheckCircle2 className="w-4 h-4 text-green-500" />,
            error: <AlertCircle className="w-4 h-4 text-red-500" />,
            in_progress: <Clock className="w-4 h-4 text-blue-500" />,
        };
        return iconMap[status] || <Circle className="w-4 h-4 text-gray-400" />;
    };

    const getStatusColor = () => {
        return StatusUtils.getStatusColor(status);
    };

    const { formatRelativeTime } = useTimeFormat();

    return (
        <div
            className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${getStatusColor()}`}
            onClick={onClick}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onClick?.();
                }
            }}
        >
            <div className="flex items-start gap-3">
                <div className="mt-0.5">{getStatusIcon()}</div>
                <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-foreground mb-1">{getTaskTitle()}</h4>
                    {latestUpdate && (
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground line-clamp-2">
                                {latestUpdate.content}
                            </p>
                            <div className="flex items-center gap-2 text-xs">
                                <AgentInfo />
                                <span className="text-muted-foreground">•</span>
                                <span className="text-muted-foreground">
                                    {formatRelativeTime(latestUpdate.created_at!)}
                                </span>
                            </div>
                        </div>
                    )}
                    {!latestUpdate && (
                        <p className="text-xs text-muted-foreground">No updates yet</p>
                    )}
                </div>
            </div>
        </div>
    );
}

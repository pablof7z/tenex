import type { NDKTask } from "@nostr-dev-kit/ndk";
import { StringUtils, TaskUtils } from "@tenex/shared";
import { Circle } from "lucide-react";
import { memo } from "react";
import { useTimeFormat } from "../../hooks/useTimeFormat";
import { Card } from "../ui/card";

interface TaskCardProps {
    task: NDKTask;
    onClick?: () => void;
    className?: string;
}

export const TaskCard = memo(
    function TaskCard({ task, onClick, className }: TaskCardProps) {
        const { formatDateOnly } = useTimeFormat();

        // Get task title
        const getTaskTitle = () => {
            return TaskUtils.getTaskTitle(task);
        };

        // Get task complexity
        const getTaskComplexity = () => {
            return TaskUtils.getComplexity(task);
        };

        // Get task content preview
        const getTaskPreview = () => {
            const lines = task.content?.split("\n") || [];
            const preview = lines.slice(0, 2).join(" ");
            return StringUtils.truncate(preview, 100);
        };

        const complexity = getTaskComplexity();

        return (
            <Card
                className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${className || ""}`}
                onClick={onClick}
            >
                <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                        <Circle className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-foreground mb-1">
                            {getTaskTitle()}
                        </h4>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {getTaskPreview()}
                        </p>
                        <div className="flex items-center gap-2 text-xs">
                            {complexity && (
                                <span className="px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                                    Complexity: {complexity}/10
                                </span>
                            )}
                            <span className="text-muted-foreground">
                                Created {formatDateOnly(task.created_at || 0)}
                            </span>
                        </div>
                    </div>
                </div>
            </Card>
        );
    },
    (prevProps, nextProps) => {
        // Custom comparison - only re-render if task ID or created_at changes
        return (
            prevProps.task.id === nextProps.task.id &&
            prevProps.task.created_at === nextProps.task.created_at &&
            prevProps.onClick === nextProps.onClick &&
            prevProps.className === nextProps.className
        );
    }
);

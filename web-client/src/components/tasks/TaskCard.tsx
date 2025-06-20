import type { NDKTask } from "@nostr-dev-kit/ndk";
import { StringUtils, TaskUtils } from "@tenex/shared";
import { Circle, Code2 } from "lucide-react";
import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { NDKKind, useSubscribe } from "@nostr-dev-kit/ndk-hooks";

interface TaskCardProps {
    task: NDKTask;
    onClick?: () => void;
    className?: string;
}

export const TaskCard = memo(
    function TaskCard({ task, onClick, className }: TaskCardProps) {
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

        // Check if this is a claude_code task
        const isClaudeCodeTask = () => {
            return task.tags?.some((tag) => tag[0] === "tool" && tag[1] === "claude_code");
        };

        // Get agent name
        const getAgentName = () => {
            return task.tags?.find((tag) => tag[0] === "agent")?.[1];
        };

        const complexity = getTaskComplexity();
        const isCodeTask = isClaudeCodeTask();
        const agentName = getAgentName();

        const { events: updates } = useSubscribe([
            { kinds: [NDKKind.GenericReply], ...task.filter(), limit: 1 },
        ]);
        const latestUpdate = updates.sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))[0];

        return (
            <Card
                className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${className || ""}`}
                onClick={onClick}
            >
                <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                        {isCodeTask ? (
                            <Code2 className="w-4 h-4 text-blue-500" />
                        ) : (
                            <Circle className="w-4 h-4 text-gray-400" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 mb-1">
                            <h4 className="text-sm font-medium text-foreground flex-1">
                                {getTaskTitle()}
                            </h4>
                            {agentName && (
                                <span className="text-sm px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                                    {agentName}
                                </span>
                            )}
                            {isCodeTask && (
                                <Badge
                                    variant="secondary"
                                    className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                                >
                                    Claude Code
                                </Badge>
                            )}
                        </div>
                        {latestUpdate ? (
                            <div className="mb-2 p-2 border-l-4 border-zinc-400 rounded-r">
                                <div className="text-xs line-clamp-2 prose prose-sm prose-p:my-0">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {latestUpdate.content}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                {getTaskPreview()}
                            </p>
                        )}
                        <div className="flex items-center gap-2 text-xs">
                            {complexity && (
                                <span className="px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                                    Complexity: {complexity}/10
                                </span>
                            )}
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

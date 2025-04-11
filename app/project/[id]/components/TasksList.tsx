import { MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Task } from "./types";

interface TasksListProps {
    tasks?: Task[];
    onTaskSelect: (task: Task) => void;
    onAddTask?: () => void;
    onDeleteTask?: (taskId: string) => void;
}

export function TasksList({ tasks = [], onTaskSelect, onAddTask, onDeleteTask }: TasksListProps) {
    return (
        <Card className="rounded-md border-border">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-xl">Tasks</CardTitle>
                        <CardDescription>Manage project tasks and track progress</CardDescription>
                    </div>
                    <Button size="sm" className="rounded-md" onClick={onAddTask}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Task
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {tasks.length > 0 ? (
                        tasks.map((task) => (
                            <div
                                key={task.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-4 last:border-0 gap-3"
                            >
                                <div className="flex items-start gap-3">
                                    <div>
                                        <p className="font-medium text-lg">{task.title}</p>
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                                            <span className="flex items-center">
                                                <span className="font-medium">@{task.creatorName}</span>
                                            </span>
                                            <span>•</span>
                                            <span>{task.createdAt}</span>
                                            {task.references > 0 && (
                                                <>
                                                    <span>•</span>
                                                    <span className="flex items-center">
                                                        <MessageSquare className="h-3 w-3 mr-1" />
                                                        {task.references} references
                                                    </span>
                                                </>
                                            )}
                                            {task.comments.length > 0 && (
                                                <>
                                                    <span>•</span>
                                                    <span className="flex items-center">
                                                        <MessageSquare className="h-3 w-3 mr-1" />
                                                        {task.comments.length} comments
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 ml-7 sm:ml-0">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onTaskSelect(task)}
                                        className="rounded-md"
                                    >
                                        View
                                    </Button>
                                    {onDeleteTask && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive rounded-md"
                                            onClick={() => onDeleteTask(task.id)}
                                        >
                                            Delete
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-6 text-muted-foreground">
                            No tasks yet. Create your first task!
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

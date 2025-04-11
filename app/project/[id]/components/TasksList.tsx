import { Plus } from "lucide-react"; // Removed MessageSquare as it's now in TaskCard
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskCard } from "@/components/events/task/card"; // Import TaskCard
import { useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { NDKTask } from "@/lib/nostr/events/task";
import { NDKProject } from "@/lib/nostr/events/project";

interface TasksListProps {
    project: NDKProject;
    onTaskSelect: (task: NDKTask) => void; // Expect NDKTask
    onAddTaskClick?: () => void; // Renamed prop
    onDeleteTask?: (taskId: string) => void;
}

export function TasksList({ project, onTaskSelect, onAddTaskClick, onDeleteTask }: TasksListProps) {
    const { events } = useSubscribe([{ kinds: [NDKTask.kind], ...project.filter() }]);

    return (
        <Card className="rounded-md border-border">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-xl">Tasks</CardTitle>
                        <CardDescription>Manage project tasks and track progress</CardDescription>
                    </div>
                    <Button size="sm" className="rounded-md" onClick={onAddTaskClick}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Task
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {events.length > 0 ? (
                        events.map((event) => {
                            const task = NDKTask.from(event); // Convert NDKEvent to NDKTask
                            return (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    onTaskSelect={onTaskSelect}
                                    onDeleteTask={onDeleteTask}
                                />
                            );
                        })
                    ) : (
                        <div className="text-center py-6 text-muted-foreground">
                            No tasks found for this project. Create the first one!
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

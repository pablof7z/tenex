import { TaskCard } from "@/components/events/task/card"; // Import TaskCard
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LoadedProject } from "@/hooks/useProjects";
import { NDKTask } from "@/lib/nostr/events/task";
import { useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { Plus } from "lucide-react"; // Removed MessageSquare as it's now in TaskCard
import { useState } from "react";

interface TasksListProps {
    project: LoadedProject;
}

export function TasksList({ project }: TasksListProps) {
    console.log("TasksList for project", project.slug, project.projectNaddr);
    const filter = project.filter
        ? [
              {
                  kinds: [NDKTask.kind],
                  ...project.filter,
              },
          ]
        : false;
    console.log("TasksList filter", filter);
    // Use useSubscribe to fetch tasks based on the filter
    const { events } = useSubscribe(filter);
    const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);

    return (
        <Card className="rounded-md border-border">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-xl">Tasks</CardTitle>
                        <CardDescription>Manage project tasks and track progress</CardDescription>
                    </div>
                    <Button size="sm" className="rounded-md" onClick={() => setIsCreateTaskOpen(true)}>
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
                            return <TaskCard key={task.id} task={task} project={project} />;
                        })
                    ) : (
                        <div className="text-center py-6 text-muted-foreground">
                            No tasks found for this project. Create the first one!
                        </div>
                    )}
                </div>
            </CardContent>

            <CreateTaskDialog project={project} open={isCreateTaskOpen} onOpenChange={setIsCreateTaskOpen} />
        </Card>
    );
}

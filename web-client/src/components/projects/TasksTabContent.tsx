import type { NDKProject, NDKTask } from "@nostr-dev-kit/ndk-hooks";
import { Plus } from "lucide-react";
import { TaskCard } from "../tasks/TaskCard";
import { Button } from "../ui/button";

interface TasksTabContentProps {
    tasks: NDKTask[];
    taskUnreadMap: Map<string, number>;
    project: NDKProject;
    onTaskSelect: (project: NDKProject, taskId: string) => void;
    onCreateTask: () => void;
    markTaskStatusUpdatesSeen: (taskId: string) => void;
}

export function TasksTabContent({
    tasks,
    taskUnreadMap,
    project,
    onTaskSelect,
    onCreateTask,
    markTaskStatusUpdatesSeen,
}: TasksTabContentProps) {
    if (tasks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 sm:py-32 px-4 sm:px-6 text-center">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-muted/50 to-muted rounded-full flex items-center justify-center mb-4 sm:mb-6 shadow-sm">
                    <Plus className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2 sm:mb-3">
                    No tasks yet
                </h3>
                <p className="text-muted-foreground mb-6 sm:mb-8 max-w-sm leading-relaxed text-sm sm:text-base">
                    Create your first task to start organizing your project work.
                </p>
                <Button
                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm px-5 sm:px-6 py-2 rounded-full text-sm sm:text-base"
                    onClick={onCreateTask}
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Task
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-0.5 sm:space-y-1 px-1 sm:px-2 pt-1 sm:pt-2">
            {tasks.map((task) => {
                const handleTaskClick = () => {
                    markTaskStatusUpdatesSeen(task.id);
                    onTaskSelect(project, task.encode());
                };

                const unreadCount = taskUnreadMap.get(task.id) || 0;

                return (
                    <div key={task.id} className="relative">
                        <TaskCard
                            task={task}
                            onClick={handleTaskClick}
                            className={unreadCount > 0 ? "border-blue-500" : ""}
                        />
                        {unreadCount > 0 && (
                            <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                {unreadCount}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

import type { NDKProject, NDKTask } from "@nostr-dev-kit/ndk-hooks";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import { SwipeTaskItem } from "./SwipeTaskItem";

interface TasksTabContentProps {
    tasks: NDKTask[];
    taskUnreadMap: Map<string, number>;
    project: NDKProject;
    onTaskSelect: (project: NDKProject, taskId: string) => void;
    onCreateTask: () => void;
    markTaskStatusUpdatesSeen: (taskId: string) => void;
    getTaskTitle: (task: NDKTask) => string;
    getTaskDescription: (task: NDKTask) => string;
}

export function TasksTabContent({
    tasks,
    taskUnreadMap,
    project,
    onTaskSelect,
    onCreateTask,
    markTaskStatusUpdatesSeen,
    getTaskTitle,
    getTaskDescription,
}: TasksTabContentProps) {
    const [deletedTaskIds, setDeletedTaskIds] = useState<Set<string>>(new Set());

    // Filter out deleted tasks
    const visibleTasks = tasks.filter((task) => !deletedTaskIds.has(task.id));

    const handleTaskDelete = (task: NDKTask) => {
        task.delete();
        setDeletedTaskIds((prev) => new Set([...prev, task.id]));
    };

    if (visibleTasks.length === 0) {
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
            {visibleTasks.map((task) => {
                const handleTaskClick = () => {
                    markTaskStatusUpdatesSeen(task.id);
                    onTaskSelect(project, task.encode());
                };

                return (
                    <SwipeTaskItem
                        key={task.id}
                        task={task}
                        unreadCount={taskUnreadMap.get(task.id) || 0}
                        onTaskClick={handleTaskClick}
                        onDelete={() => handleTaskDelete(task)}
                        getTaskTitle={getTaskTitle}
                        getTaskDescription={getTaskDescription}
                    />
                );
            })}
        </div>
    );
}

"use client";

import React, { useState } from "react";
import { TasksList } from "./TasksList";
// import { Task } from "./types"; // Removed local Task type
import { CreateTaskDialog } from "./CreateTaskDialog"; // Import the dialog
import { NDKProject } from "@/lib/nostr/events/project";
import { NDKTask } from "@/lib/nostr/events/task"; // Import NDKTask

interface ProjectTasksTabProps {
    project: NDKProject;
    // tasks: Task[]; // Removed tasks prop
    onTaskSelect: (task: NDKTask) => void; // Expect NDKTask
    // onAddTask prop is removed, handled internally now
    onDeleteTask: (taskId: string) => void;
    onTasksUpdate?: () => void; // Optional callback to refresh tasks list
}

export function ProjectTasksTab({
    project,
    // tasks, // Removed tasks prop
    onTaskSelect,
    onDeleteTask,
    onTasksUpdate,
}: ProjectTasksTabProps) {
    const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
    return (
        <>
            <TasksList
                project={project}
                onTaskSelect={onTaskSelect} // Now expects NDKTask
                onDeleteTask={onDeleteTask}
                onAddTaskClick={() => setIsCreateTaskOpen(true)}
            />
            <CreateTaskDialog
                project={project}
                open={isCreateTaskOpen}
                onOpenChange={setIsCreateTaskOpen}
                onTaskCreated={onTasksUpdate} // Call update callback after creation
            />
        </>
    );
}

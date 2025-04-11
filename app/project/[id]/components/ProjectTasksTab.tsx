"use client";

import React from 'react';
import { TasksList } from './TasksList';
import { Task } from './types'; // Assuming Task type is defined here

interface ProjectTasksTabProps {
  // Define necessary props, e.g., tasks data, handlers
  tasks: Task[]; // Example: Pass tasks data
  onTaskSelect: (task: Task | null) => void;
  onAddTask: () => void;
  onDeleteTask: (taskId: string) => void;
}

export function ProjectTasksTab({
  tasks,
  onTaskSelect,
  onAddTask,
  onDeleteTask,
}: ProjectTasksTabProps) {
  return (
    <TasksList
      tasks={tasks}
      onTaskSelect={onTaskSelect}
      onAddTask={onAddTask}
      onDeleteTask={onDeleteTask}
    />
  );
}
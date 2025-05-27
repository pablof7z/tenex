"use client";

import React, { useMemo, useState } from 'react'; // Added useState
import Link from 'next/link';
import { NDKEvent, NDKFilter, NDKKind } from '@nostr-dev-kit/ndk';
import { useSubscribe } from '@nostr-dev-kit/ndk-hooks';
import { NDKTask } from '../../lib/nostr/events/task'; // Adjusted import path
import { LoadedProject } from '../../hooks/useProjects'; // Adjusted import path
import { TaskReactButton } from '../events/task/TaskReactButton';
import { Button } from "@/components/ui/button";
import { PlayIcon } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast"; // Added useToast

interface RecentTasksListProps {
  project: LoadedProject;
}

export function RecentTasksList({ project }: RecentTasksListProps) {
  const { toast } = useToast(); // Initialize toast
  const [startingTaskIds, setStartingTaskIds] = useState<Set<string>>(new Set()); // To track loading state for each task

  const filter: NDKFilter[] | false = useMemo(() => { // Corrected type here
    if (!project.event) return false;
    const baseFilter: NDKFilter = { kinds: [NDKTask.kind], ...project.event.filter() }
    return [baseFilter]; // Wrap the filter in an array
  }, [project.slug]); // Removed project.pubkey from deps unless used in filter

  const { events: rawTasks, eose } = useSubscribe(filter);

  const tasks = useMemo(() => {
    return (rawTasks || []).map(event => NDKTask.from(event as NDKEvent))
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0)) // Sort by created_at descending
      .slice(0, 3) // Limit to the latest 3 tasks
  }, [rawTasks]);

  const handleStartTask = async (task: NDKTask) => {
    if (!project.slug || !task.id) {
      toast({
        title: "Error",
        description: "Project or Task ID is missing.",
        variant: "destructive",
      });
      return;
    }

    setStartingTaskIds(prev => new Set(prev).add(task.id));

    const taskTitle = task.tags.find(t => t[0] === 'title')?.[1] || task.content.substring(0, 70) + (task.content.length > 70 ? '...' : '') || 'Untitled Task';
    const taskDescription = task.content;

    try {
      const apiUrl = `/api/projects/${project.slug}/tasks/${task.id}/work`;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: taskTitle,
          description: taskDescription,
        }),
      });

      const result = await response.json();

      if (response.ok && response.status === 202) {
        toast({
          title: "Success",
          description: `Agent work initiated for task ${task.id}. ${result.message || ""}`,
        });
      } else {
        throw new Error(result.error || `Failed to start agent work (status ${response.status})`);
      }
    } catch (error: unknown) {
      console.error("Failed to start agent work:", error);
      let errorMessage = "An unexpected error occurred.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast({
        title: "Error Starting Work",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setStartingTaskIds(prev => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  };


  if (!eose && tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">Loading recent tasks...</p>;
  }

  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">No recent tasks found for this project.</p>;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-md font-semibold">Recent Tasks</h3>
      <ul className="divide-y divide-muted">
        {tasks.map(task => {
          const title = task.tags.find(t => t[0] === 'title')?.[1] || task.content.substring(0, 70) + (task.content.length > 70 ? '...' : '') || 'Untitled Task';
          const taskUrlId = task.id;
          const isStarting = startingTaskIds.has(task.id);

          return (
            <li key={task.id} className="p-2 hover:bg-accent hover:text-accent-foreground transition-colors">
              <div className="flex justify-between items-center">
                <Link href={`/project/${project.slug}/${taskUrlId}`} passHref legacyBehavior>
                  <a className="text-xs text-muted-foreground font-medium hover:underline flex-grow mr-2 truncate" title={title}>
                    {title}
                  </a>
                </Link>
                <div className="flex items-center space-x-1 flex-shrink-0">
                  <TaskReactButton taskEvent={task} />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={async (e: React.MouseEvent) => {
                      e.stopPropagation();
                      e.preventDefault(); // Prevent navigation if Link is somehow triggered
                      await handleStartTask(task);
                    }}
                    disabled={isStarting}
                    title={isStarting ? "Starting Task..." : "Start Task"}
                  >
                    <PlayIcon className="h-3 w-3" />
                    <span className="sr-only">{isStarting ? "Starting Task..." : "Start Task"}</span>
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
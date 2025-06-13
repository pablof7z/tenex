import {
  type NDKArticle,
  type NDKEvent,
  type NDKProject,
  NDKTask,
} from "@nostr-dev-kit/ndk-hooks";
import { Plus } from "lucide-react";
import { useState } from "react";
import { type ProjectAgent } from "../../hooks/useProjectAgents";
import { useProjectData } from "../../hooks/useProjectData";
import { CreateTaskDialog } from "../dialogs/CreateTaskDialog";
import { TaskCreationOptionsDialog } from "../dialogs/TaskCreationOptionsDialog";
import { ThreadDialog } from "../dialogs/ThreadDialog";
import { VoiceTaskDialog } from "../dialogs/VoiceTaskDialog";
import { Button } from "../ui/button";
import { DocsTabContent } from "./DocsTabContent";
import { ProjectTabs } from "./ProjectTabs";
import { TasksTabContent } from "./TasksTabContent";
import { ThreadsTabContent } from "./ThreadsTabContent";

interface ProjectDetailProps {
  project: NDKProject;
  onBack: () => void;
  onTaskSelect: (project: NDKProject, taskId: string) => void;
  onEditProject: (project: NDKProject) => void;
  onThreadStart: (
    project: NDKProject,
    threadTitle: string,
    selectedAgents: ProjectAgent[],
  ) => void;
  onThreadSelect?: (
    project: NDKProject,
    threadId: string,
    threadTitle: string,
  ) => void;
  onArticleSelect?: (project: NDKProject, article: NDKArticle) => void;
}

export function ProjectDetail({
  project,
  onBack,
  onTaskSelect,
  onEditProject,
  onThreadStart,
  onThreadSelect,
  onArticleSelect,
}: ProjectDetailProps) {
  const [showOptionsDialog, setShowOptionsDialog] = useState(false);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [showVoiceTaskDialog, setShowVoiceTaskDialog] = useState(false);
  const [showThreadDialog, setShowThreadDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<"tasks" | "threads" | "docs">("tasks");

  // Use the custom hook for all data subscriptions
  const {
    tasks,
    threads,
    articles,
    statusUpdates,
    taskUnreadMap,
    threadUnreadMap,
    threadRecentMessages,
  } = useProjectData(project);

  // Utility functions
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffHours = Math.abs(now.getTime() - date.getTime()) / 36e5;

    if (diffHours < 24) {
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    }
    if (diffHours < 24 * 7) {
      return date.toLocaleDateString("en-US", { weekday: "short" });
    }
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getTaskTitle = (task: NDKTask) => {
    // Try to get title from tags first, fallback to content
    const titleTag = task.tags?.find((tag) => tag[0] === "title")?.[1];
    if (titleTag) return titleTag;

    // Fallback to first line of content
    const firstLine = task.content?.split("\n")[0] || "Untitled Task";
    return firstLine.length > 50 ? `${firstLine.slice(0, 50)}...` : firstLine;
  };

  const getTaskDescription = (task: NDKTask) => {
    // Get description from content, skipping the first line if it's the title
    const lines = task.content?.split("\n") || [];
    const titleTag = task.tags?.find((tag) => tag[0] === "title")?.[1];

    if (titleTag && lines.length > 1) {
      return `${lines.slice(1).join(" ").slice(0, 80)}...`;
    }
    if (lines.length > 1) {
      return `${lines.slice(1).join(" ").slice(0, 80)}...`;
    }

    return "No description";
  };

  const getThreadTitle = (thread: NDKEvent) => {
    const titleTag = thread.tags?.find(
      (tag: string[]) => tag[0] === "title",
    )?.[1];
    if (titleTag) return titleTag;

    const firstLine = thread.content?.split("\n")[0] || "Untitled Thread";
    return firstLine.length > 50 ? `${firstLine.slice(0, 50)}...` : firstLine;
  };

  const markTaskStatusUpdatesSeen = (taskId: string) => {
    const seenUpdates = JSON.parse(
      localStorage.getItem("seenStatusUpdates") || "{}",
    );
    const taskStatusUpdates = statusUpdates.filter((update) => {
      const updateTaskId = update.tags?.find(
        (tag) => tag[0] === "e" && tag[3] === "task",
      )?.[1];
      return updateTaskId === taskId;
    });

    taskStatusUpdates.forEach((update) => {
      seenUpdates[update.id] = true;
    });

    localStorage.setItem("seenStatusUpdates", JSON.stringify(seenUpdates));
  };

  const markThreadRepliesSeen = (_threadId: string) => {
    const seenThreadReplies = JSON.parse(
      localStorage.getItem("seenThreadReplies") || "{}",
    );
    // In a real implementation, we'd need threadReplies data
    // For now, just update local storage
    localStorage.setItem(
      "seenThreadReplies",
      JSON.stringify(seenThreadReplies),
    );
  };

  const handleOptionSelect = (option: "task" | "voice" | "thread") => {
    switch (option) {
      case "task":
        setShowCreateTaskDialog(true);
        break;
      case "voice": {
        const openaiApiKey = localStorage.getItem("openaiApiKey");
        if (!openaiApiKey) {
          alert(
            "Please set your OpenAI API key in settings first before using voice recording.",
          );
          return;
        }
        setShowVoiceTaskDialog(true);
        break;
      }
      case "thread":
        setShowThreadDialog(true);
        break;
    }
  };

  return (
    <div className="bg-background min-h-screen">
      <ProjectTabs
        project={project}
        activeTab={activeTab}
        taskCount={tasks.length}
        threadCount={threads.length}
        docCount={articles.length}
        onTabChange={setActiveTab}
        onBack={onBack}
        onEditProject={() => onEditProject(project)}
      />

      {/* Content */}
      <div className="pb-20">
        {activeTab === "tasks" ? (
          <TasksTabContent
            tasks={tasks}
            taskUnreadMap={taskUnreadMap}
            project={project}
            onTaskSelect={onTaskSelect}
            onCreateTask={() => setShowOptionsDialog(true)}
            markTaskStatusUpdatesSeen={markTaskStatusUpdatesSeen}
            getTaskTitle={getTaskTitle}
            getTaskDescription={getTaskDescription}
          />
        ) : activeTab === "threads" ? (
          <ThreadsTabContent
            threads={threads}
            threadUnreadMap={threadUnreadMap}
            threadRecentMessages={threadRecentMessages}
            project={project}
            onThreadSelect={onThreadSelect!}
            onCreateThread={() => setShowThreadDialog(true)}
            markThreadRepliesSeen={markThreadRepliesSeen}
            getThreadTitle={getThreadTitle}
            formatTime={formatTime}
          />
        ) : (
          <DocsTabContent
            articles={articles}
            project={project}
            onArticleSelect={onArticleSelect!}
            formatTime={formatTime}
          />
        )}
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40">
        <Button
          variant="primary"
          size="icon-lg"
          rounded="full"
          className="shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95"
          onClick={() => setShowOptionsDialog(true)}
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>

      {/* Dialogs */}
      <TaskCreationOptionsDialog
        open={showOptionsDialog}
        onOpenChange={setShowOptionsDialog}
        onOptionSelect={handleOptionSelect}
      />

      <CreateTaskDialog
        open={showCreateTaskDialog}
        onOpenChange={setShowCreateTaskDialog}
        project={project}
        onTaskCreated={() => {
          // Tasks will automatically refresh via useSubscribe
        }}
      />

      <VoiceTaskDialog
        open={showVoiceTaskDialog}
        onOpenChange={setShowVoiceTaskDialog}
        project={project}
        onTaskCreated={() => {
          // Tasks will automatically refresh via useSubscribe
        }}
      />

      <ThreadDialog
        open={showThreadDialog}
        onOpenChange={setShowThreadDialog}
        project={project}
        onThreadStart={(threadTitle, selectedAgents) => {
          onThreadStart(project, threadTitle, selectedAgents);
        }}
      />
    </div>
  );
}
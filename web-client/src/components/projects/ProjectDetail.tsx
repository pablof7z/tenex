import type { NDKArticle, NDKEvent, NDKProject } from "@nostr-dev-kit/ndk-hooks";
import { NDKTask, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { Plus } from "lucide-react";
import { useState, useMemo } from "react";
import type { ProjectAgent } from "../../hooks/useProjectAgents";
import { useTimeFormat } from "../../hooks/useTimeFormat";
import { EVENT_KINDS } from "@tenex/types/events";
import { TaskCreationOptionsDialog } from "../dialogs/TaskCreationOptionsDialog";
import { ThreadDialog } from "../dialogs/ThreadDialog";
import { VoiceMessageDialog } from "../dialogs/VoiceMessageDialog";
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
        selectedAgents: ProjectAgent[]
    ) => void;
    onThreadSelect?: (project: NDKProject, threadId: string, threadTitle: string) => void;
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
    const [showVoiceDialog, setShowVoiceDialog] = useState(false);
    const [showThreadDialog, setShowThreadDialog] = useState(false);
    const [activeTab, setActiveTab] = useState<"tasks" | "threads" | "docs">("tasks");

    // Subscribe to tasks for this project
    const { events: tasks } = useSubscribe<NDKTask>(
        project
            ? [
                  {
                      kinds: [NDKTask.kind],
                      ...project.filter(),
                      limit: 100,
                  },
              ]
            : false,
        { wrap: true, subId: "project-data-task" },
        [project?.tagId()]
    );

    // Subscribe to threads (kind 11) for this project
    const { events: threads } = useSubscribe(
        project
            ? [
                  {
                      kinds: [EVENT_KINDS.CHAT],
                      ...project.filter(),
                      limit: 50,
                  },
              ]
            : false,
        {},
        [project?.tagId()]
    );

    // Subscribe to documentation articles (kind 30023) for this project
    const { events: articles } = useSubscribe<NDKArticle>(
        project
            ? [
                  {
                      kinds: [EVENT_KINDS.ARTICLE],
                      ...project.filter(),
                      limit: 50,
                  },
              ]
            : false,
        { wrap: true },
        [project?.tagId()]
    );

    // Subscribe to thread replies (kind 1111) for all threads
    const { events: threadReplies } = useSubscribe(
        threads.length > 0
            ? [
                  {
                      kinds: [EVENT_KINDS.GENERIC_REPLY],
                      "#e": threads.map((t) => t.id),
                  },
              ]
            : false,
        {},
        [threads.length]
    );

    // Get status updates for all tasks (NIP-22 replies - kind 1111 events with 'e' tag referencing any task)
    const { events: statusUpdates } = useSubscribe(
        tasks.length > 0
            ? [
                  {
                      kinds: [EVENT_KINDS.GENERIC_REPLY],
                      "#E": tasks.map((t) => t.id),
                  },
              ]
            : false,
        {},
        [tasks.length]
    );

    // Track unread status updates per task
    const taskUnreadMap = useMemo(() => {
        const unreadMap = new Map<string, number>();
        const seenUpdates = JSON.parse(localStorage.getItem("seenStatusUpdates") || "{}");

        for (const update of statusUpdates) {
            const taskId = update.tags?.find((tag: string[]) => tag[0] === "e" && tag[3] === "task")?.[1];
            if (taskId && !seenUpdates[update.id]) {
                const currentUnread = unreadMap.get(taskId) || 0;
                unreadMap.set(taskId, currentUnread + 1);
            }
        }

        return unreadMap;
    }, [statusUpdates]);

    // Track unread thread replies per thread
    const threadUnreadMap = useMemo(() => {
        const unreadMap = new Map<string, number>();
        const seenThreadReplies = JSON.parse(localStorage.getItem("seenThreadReplies") || "{}");

        for (const reply of threadReplies) {
            const threadId = reply.tags?.find((tag: string[]) => tag[0] === "e")?.[1];
            if (threadId && !seenThreadReplies[reply.id]) {
                const currentUnread = unreadMap.get(threadId) || 0;
                unreadMap.set(threadId, currentUnread + 1);
            }
        }

        return unreadMap;
    }, [threadReplies]);

    // Get recent message for each thread
    const threadRecentMessages = useMemo(() => {
        const recentMap = new Map<string, { content: string; timestamp: number }>();

        for (const reply of threadReplies) {
            const threadId = reply.tags?.find((tag: string[]) => tag[0] === "e")?.[1];
            if (threadId && reply.created_at) {
                const existing = recentMap.get(threadId);
                if (!existing || reply.created_at > existing.timestamp) {
                    recentMap.set(threadId, {
                        content: reply.content || "",
                        timestamp: reply.created_at,
                    });
                }
            }
        }

        return recentMap;
    }, [threadReplies]);

    const { formatAutoTime } = useTimeFormat({
        includeTime: true,
        use24Hour: true,
    });

    // Utility functions
    const formatTime = (timestamp: number) => {
        return formatAutoTime(timestamp);
    };

    const getThreadTitle = (thread: NDKEvent) => {
        const titleTag = thread.tags?.find((tag: string[]) => tag[0] === "title")?.[1];
        if (titleTag) return titleTag;

        const firstLine = thread.content?.split("\n")[0] || "Untitled Thread";
        return firstLine.length > 50 ? `${firstLine.slice(0, 50)}...` : firstLine;
    };

    const markTaskStatusUpdatesSeen = (taskId: string) => {
        const seenUpdates = JSON.parse(localStorage.getItem("seenStatusUpdates") || "{}");
        const taskStatusUpdates = statusUpdates.filter((update: NDKEvent) => {
            const updateTaskId = update.tags?.find(
                (tag: string[]) => tag[0] === "e" && tag[3] === "task"
            )?.[1];
            return updateTaskId === taskId;
        });

        for (const update of taskStatusUpdates) {
            seenUpdates[update.id] = true;
        }

        localStorage.setItem("seenStatusUpdates", JSON.stringify(seenUpdates));
    };

    const markThreadRepliesSeen = (_threadId: string) => {
        const seenThreadReplies = JSON.parse(localStorage.getItem("seenThreadReplies") || "{}");
        // In a real implementation, we'd need threadReplies data
        // For now, just update local storage
        localStorage.setItem("seenThreadReplies", JSON.stringify(seenThreadReplies));
    };

    const handleOptionSelect = (option: "voice" | "thread") => {
        setShowOptionsDialog(false);
        switch (option) {
            case "voice":
                setShowVoiceDialog(true);
                break;
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
                        markTaskStatusUpdatesSeen={markTaskStatusUpdatesSeen}
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
                    title="Create new content"
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

            <VoiceMessageDialog
                open={showVoiceDialog}
                onOpenChange={setShowVoiceDialog}
                project={project}
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

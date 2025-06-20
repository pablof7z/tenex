import type { NDKArticle, NDKEvent, NDKProject } from "@nostr-dev-kit/ndk-hooks";
import { Plus } from "lucide-react";
import { useState } from "react";
import type { ProjectAgent } from "../../hooks/useProjectAgents";
import { useProjectData } from "../../hooks/useProjectData";
import { useTimeFormat } from "../../hooks/useTimeFormat";
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
        const taskStatusUpdates = statusUpdates.filter((update) => {
            const updateTaskId = update.tags?.find(
                (tag) => tag[0] === "e" && tag[3] === "task"
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

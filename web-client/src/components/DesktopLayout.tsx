import {
    type NDKArticle,
    type NDKEvent,
    NDKProject,
    NDKTask,
    useNDKCurrentUser,
    useSubscribe,
} from "@nostr-dev-kit/ndk-hooks";
import { useAtom, useAtomValue } from "jotai";
import { useMemo, useState } from "react";
import type { ProjectAgent } from "../hooks/useProjectAgents";
import { useNavigation } from "../contexts/NavigationContext";
import {
    onlineProjectsAtom,
    selectedProjectAtom,
    selectedTaskAtom,
    selectedThreadAtom,
    themeAtom,
} from "../lib/store";
import { LayoutDialogs } from "./layout/LayoutDialogs";
import { LayoutDrawers } from "./layout/LayoutDrawers";
import { ProjectDashboard } from "./layout/ProjectDashboard";
import { ProjectSidebar } from "./layout/ProjectSidebar";

export function DesktopLayout() {
    const { goToProjectSettings } = useNavigation();
    const currentUser = useNDKCurrentUser();
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showSearchDialog, setShowSearchDialog] = useState(false);
    const [showTaskOptionsDialog, setShowTaskOptionsDialog] = useState(false);
    const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
    const [showVoiceTaskDialog, setShowVoiceTaskDialog] = useState(false);
    const [showThreadDialog, setShowThreadDialog] = useState(false);
    const [selectedProjectForTask, setSelectedProjectForTask] = useState<NDKProject | null>(null);
    const [manuallyToggled, setManuallyToggled] = useState<Map<string, boolean>>(new Map());
    const [selectedTask, setSelectedTask] = useAtom(selectedTaskAtom);
    const [selectedThread, setSelectedThread] = useAtom(selectedThreadAtom);
    const [selectedProject, setSelectedProject] = useAtom(selectedProjectAtom);
    const [selectedArticle, setSelectedArticle] = useState<NDKArticle | null>(null);
    const onlineProjects = useAtomValue(onlineProjectsAtom);
    const [theme, setTheme] = useAtom(themeAtom);

    const { events: projects } = useSubscribe<NDKProject>(
        currentUser
            ? [
                  {
                      kinds: [NDKProject.kind],
                      authors: [currentUser.pubkey],
                      limit: 50,
                  },
              ]
            : false,
        { wrap: true },
        [currentUser?.pubkey]
    );

    const { events: tasks } = useSubscribe<NDKTask>(
        projects.length > 0
            ? [
                  {
                      kinds: [NDKTask.kind],
                      "#a": projects.map(
                          (p) => `${NDKProject.kind}:${p.pubkey}:${p.tagValue("d")}`
                      ),
                  },
              ]
            : false,
        { wrap: true },
        [projects.length]
    );

    const { events: statusUpdates } = useSubscribe(
        tasks.length > 0
            ? [
                  {
                      kinds: [1111],
                      "#e": tasks.map((t) => t.id),
                  },
              ]
            : false,
        {},
        [tasks.length]
    );

    const { events: threads } = useSubscribe(
        projects.length > 0
            ? [
                  {
                      kinds: [11], // Kind 11 for threads
                      "#a": projects.map(
                          (p) => `${NDKProject.kind}:${p.pubkey}:${p.tagValue("d")}`
                      ),
                  },
              ]
            : false,
        {},
        [projects.length]
    );

    // Filter projects with activity in last 72 hours OR created in last 24 hours OR manually activated
    const filteredProjects = useMemo(() => {
        const now = Date.now() / 1000;
        const seventyTwoHoursAgo = now - 72 * 60 * 60;
        const twentyFourHoursAgo = now - 24 * 60 * 60;

        return projects.filter((project) => {
            const projectId = project.tagId();

            // Check if manually toggled
            if (manuallyToggled.has(projectId)) {
                // User has explicitly set visibility
                return manuallyToggled.get(projectId);
            }

            // Default behavior: show if created in last 24 hours
            const projectCreatedAt = project.created_at || 0;
            if (projectCreatedAt > twentyFourHoursAgo) {
                return true;
            }

            // Default behavior: show if has activity in last 72 hours
            const projectTasks = tasks.filter((task) => {
                const projectReference = task.tags?.find((tag) => tag[0] === "a")?.[1];
                if (projectReference) {
                    const parts = projectReference.split(":");
                    if (parts.length >= 3) {
                        const projectTagId = parts[2];
                        return project.tagValue("d") === projectTagId;
                    }
                }
                return false;
            });

            // Check for recent status updates
            const hasRecentActivity = statusUpdates.some((update) => {
                const taskId = update.tags?.find((tag) => tag[0] === "e" && tag[3] === "task")?.[1];
                const isRecentUpdate = (update.created_at || 0) > seventyTwoHoursAgo;
                return isRecentUpdate && projectTasks.some((task) => task.id === taskId);
            });

            return hasRecentActivity;
        });
    }, [projects, tasks, statusUpdates, manuallyToggled]);

    const toggleProjectActivation = (projectId: string) => {
        setManuallyToggled((prev) => {
            const newMap = new Map(prev);
            const isCurrentlyShown = filteredProjects.some((p) => p.tagId() === projectId);

            // Toggle the visibility
            newMap.set(projectId, !isCurrentlyShown);

            return newMap;
        });
    };

    const handleTaskCreate = (project: NDKProject) => {
        setSelectedProjectForTask(project);
        setShowTaskOptionsDialog(true);
    };

    const handleThreadClick = (thread: NDKEvent) => {
        // Set the selected thread to open in drawer
        setSelectedThread(thread);
    };

    const handleTaskOptionSelect = (option: "task" | "voice" | "thread") => {
        setShowTaskOptionsDialog(false);

        switch (option) {
            case "task":
                setShowCreateTaskDialog(true);
                break;
            case "voice":
                setShowVoiceTaskDialog(true);
                break;
            case "thread":
                setShowThreadDialog(true);
                break;
        }
    };

    if (!currentUser) {
        return (
            <div className="h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <p className="text-muted-foreground">No user logged in</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen bg-background flex">
            {/* Left Sidebar */}
            <ProjectSidebar
                projects={projects}
                filteredProjects={filteredProjects}
                onlineProjects={onlineProjects}
                theme={theme}
                onThemeChange={(newTheme) => setTheme(newTheme as "light" | "dark")}
                onProjectToggle={toggleProjectActivation}
                onCreateProject={() => setShowCreateDialog(true)}
                onSearch={() => setShowSearchDialog(true)}
            />

            {/* Main Content Area */}
            <ProjectDashboard
                projects={projects}
                filteredProjects={filteredProjects}
                tasks={tasks}
                statusUpdates={statusUpdates}
                threads={threads}
                onProjectClick={setSelectedProject}
                onTaskCreate={handleTaskCreate}
                onThreadClick={handleThreadClick}
                onCreateProject={() => setShowCreateDialog(true)}
            />

            {/* Dialogs */}
            <LayoutDialogs
                showCreateDialog={showCreateDialog}
                showSearchDialog={showSearchDialog}
                showTaskOptionsDialog={showTaskOptionsDialog}
                showCreateTaskDialog={showCreateTaskDialog}
                showVoiceTaskDialog={showVoiceTaskDialog}
                showThreadDialog={showThreadDialog}
                selectedProjectForTask={selectedProjectForTask}
                onCreateDialogChange={setShowCreateDialog}
                onSearchDialogChange={setShowSearchDialog}
                onTaskOptionsDialogChange={setShowTaskOptionsDialog}
                onCreateTaskDialogChange={setShowCreateTaskDialog}
                onVoiceTaskDialogChange={setShowVoiceTaskDialog}
                onThreadDialogChange={setShowThreadDialog}
                onTaskOptionSelect={handleTaskOptionSelect}
                onTaskCreated={() => {
                    setShowCreateTaskDialog(false);
                    setShowVoiceTaskDialog(false);
                    setSelectedProjectForTask(null);
                }}
                onThreadStart={(title, selectedAgents) => {
                    setShowThreadDialog(false);

                    // Create a temporary thread object to open the chat interface
                    // No event is published yet - that happens when the first message is sent
                    const tempThread = {
                        id: "new",
                        content: "",
                        tags: [
                            ["title", title],
                            ["a", selectedProjectForTask?.tagId() || ""],
                        ],
                        selectedAgents, // Store agents temporarily on the object
                    } as NDKEvent & { selectedAgents?: ProjectAgent[] };

                    // Set the thread as selected to open in drawer
                    setSelectedThread(tempThread);
                    setSelectedProjectForTask(null);
                }}
            />

            {/* Drawers */}
            <LayoutDrawers
                selectedTask={selectedTask}
                selectedThread={selectedThread}
                selectedProject={selectedProject}
                selectedArticle={selectedArticle}
                projects={projects}
                onTaskClose={() => setSelectedTask(null)}
                onThreadClose={() => setSelectedThread(null)}
                onProjectClose={() => setSelectedProject(null)}
                onArticleClose={() => setSelectedArticle(null)}
                onTaskSelect={(_, taskId) => {
                    // Find the task by its ID
                    const task = tasks.find((t) => t.encode() === taskId);
                    if (task) {
                        setSelectedTask(task);
                    }
                }}
                onEditProject={goToProjectSettings}
                onThreadStart={(project, threadTitle, selectedAgents) => {
                    // Create a temporary thread object to open the chat interface
                    // No event is published yet - that happens when the first message is sent
                    const tempThread = {
                        id: "new",
                        content: "",
                        tags: [
                            ["title", threadTitle],
                            ["a", project.tagId()],
                        ],
                        selectedAgents, // Store agents temporarily on the object
                    } as NDKEvent & { selectedAgents?: ProjectAgent[] };

                    // Set the thread as selected to open in drawer
                    setSelectedThread(tempThread);
                }}
                onThreadSelect={(_, threadId) => {
                    // Find the thread by its ID
                    const thread = threads.find((t) => t.encode() === threadId);
                    if (thread) {
                        setSelectedThread(thread);
                    }
                }}
                onArticleSelect={(_, article) => {
                    setSelectedArticle(article);
                }}
            />
        </div>
    );
}

import {
    type NDKArticle,
    type NDKEvent,
    NDKProject,
    useNDKCurrentUser,
} from "@nostr-dev-kit/ndk-hooks";
import { useAtom, useAtomValue } from "jotai";
import { useMemo, useState } from "react";
import { useNavigation } from "../contexts/NavigationContext";
import type { ProjectAgent } from "../hooks/useProjectAgents";
import { useUserProjects } from "../hooks/useUserProjects";
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

    // Only fetch projects at this level
    const projects = useUserProjects();

    // Filter projects based on creation time and manual toggles
    // Activity-based filtering will happen at the component level
    const filteredProjects = useMemo(() => {
        const now = Date.now() / 1000;
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
            return projectCreatedAt > twentyFourHoursAgo;
        });
    }, [projects, manuallyToggled]);

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
                onTaskClose={() => setSelectedTask(null)}
                onThreadClose={() => setSelectedThread(null)}
                onProjectClose={() => setSelectedProject(null)}
                onArticleClose={() => setSelectedArticle(null)}
                onTaskSelect={(_, taskId) => {
                    // Task will be fetched by the drawer component itself
                    setSelectedTask({ id: taskId } as any);
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
                    // Thread will be fetched by the drawer component itself
                    setSelectedThread({ id: threadId } as any);
                }}
                onArticleSelect={(_, article) => {
                    setSelectedArticle(article);
                }}
            />
        </div>
    );
}

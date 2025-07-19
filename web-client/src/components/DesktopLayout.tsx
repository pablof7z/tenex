import {
    type NDKArticle,
    type NDKEvent,
    type NDKTask,
    type NDKProject,
    useNDKCurrentUser,
} from "@nostr-dev-kit/ndk-hooks";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useMemo, useState } from "react";
import { useNavigation } from "../contexts/NavigationContext";
import type { ProjectAgent } from "../stores/project/hooks";
import { useUserProjects } from "../hooks/useUserProjects";
import { useOnlineProjects } from "../stores/project/hooks";
import {
    selectedTaskAtom,
    selectedThreadAtom,
    themeAtom,
    toggleThemeAtom,
} from "../lib/store";
import { LayoutDialogs } from "./layout/LayoutDialogs";
import { LayoutDrawers } from "./layout/LayoutDrawers";
import { ProjectDashboard } from "./layout/ProjectDashboard";
import { ProjectSidebar } from "./layout/ProjectSidebar";
import { VoiceRecorderDialog } from "./dialogs/VoiceRecorderDialog";

export function DesktopLayout() {
    const currentUser = useNDKCurrentUser();
    const { goToProjectProfile } = useNavigation();
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showSearchDialog, setShowSearchDialog] = useState(false);
    const [showVoiceRecorderDialog, setShowVoiceRecorderDialog] = useState(false);
    const [voiceRecorderProject, setVoiceRecorderProject] = useState<NDKProject | null>(null);
    const [manuallyToggled, setManuallyToggled] = useState<Map<string, boolean>>(new Map());
    const [selectedTask, setSelectedTask] = useAtom(selectedTaskAtom);
    const [selectedThread, setSelectedThread] = useAtom(selectedThreadAtom);
    const [selectedArticle, setSelectedArticle] = useState<NDKArticle | null>(null);
    const onlineProjects = useOnlineProjects();
    const theme = useAtomValue(themeAtom);
    const toggleTheme = useSetAtom(toggleThemeAtom);

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

    const handleThreadClick = (thread: NDKEvent) => {
        // Set the selected thread to open in drawer
        setSelectedThread(thread);
    };

    const handleCreateAction = (project: NDKProject) => {
        // Directly create a new thread without title/agents - will be auto-generated
        const tempThread = {
            id: "new",
            content: "",
            tags: [
                ["title", ""], // Empty title - will be generated when user types
                ["a", project.tagId()],
            ],
            selectedAgents: [], // No pre-selected agents
        } as unknown as NDKEvent & { selectedAgents?: ProjectAgent[] };

        // Set the thread as selected to open in drawer
        setSelectedThread(tempThread);
    };

    const handleVoiceRecording = (project: NDKProject) => {
        setVoiceRecorderProject(project);
        setShowVoiceRecorderDialog(true);
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
                onThemeChange={() => toggleTheme()}
                onProjectToggle={toggleProjectActivation}
                onCreateProject={() => setShowCreateDialog(true)}
                onSearch={() => setShowSearchDialog(true)}
            />

            {/* Main Content Area */}
            <ProjectDashboard
                projects={projects}
                filteredProjects={filteredProjects}
                onProjectClick={goToProjectProfile}
                onTaskCreate={handleCreateAction}
                onVoiceRecord={handleVoiceRecording}
                onThreadClick={handleThreadClick}
                onCreateProject={() => setShowCreateDialog(true)}
            />

            {/* Dialogs */}
            <LayoutDialogs
                showCreateDialog={showCreateDialog}
                showSearchDialog={showSearchDialog}
                onCreateDialogChange={setShowCreateDialog}
                onSearchDialogChange={setShowSearchDialog}
            />

            {/* Voice Recorder Dialog */}
            {showVoiceRecorderDialog && voiceRecorderProject && (
                <VoiceRecorderDialog
                    open={showVoiceRecorderDialog}
                    onOpenChange={setShowVoiceRecorderDialog}
                    project={voiceRecorderProject}
                />
            )}

            {/* Drawers */}
            <LayoutDrawers
                selectedTask={selectedTask}
                selectedThread={selectedThread}
                selectedArticle={selectedArticle}
                onTaskClose={() => setSelectedTask(null)}
                onThreadClose={() => setSelectedThread(null)}
                onArticleClose={() => setSelectedArticle(null)}
            />
        </div>
    );
}

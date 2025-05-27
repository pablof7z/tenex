"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/app-layout";
import { toast } from "@/components/ui/use-toast";
import { useConfig } from "@/hooks/useConfig";
import { useProjects } from "@/hooks/useProjects"; // Import the SWR hook
// QuoteData import removed as quoting is handled in NoteCard
import { Toolbar } from "@/components/ui/Toolbar";

// Import common components
import { ProjectHeader } from "./components/ProjectHeader";
import { ProjectStatCards } from "./components/ProjectStatCards";
// QuotePostDialog import removed

// Import the new Tab components
import { ProjectOverviewTab } from "./components/ProjectOverviewTab";
// Removed incorrect import for ProjectTasksTab
import { ProjectSettingsTab } from "./components/ProjectSettingsTab";
import { ProjectSpecsTab } from "./components/ProjectSpecsTab";
import { TasksList } from "./components/TasksList";

// Define static tab labels outside the component
const TAB_LABELS = ["Overview", "Tasks", "Specs", "Settings"];

export default function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
    const unwrappedParams = React.use(params);
    const projectSlug = unwrappedParams.slug;
    // Use the config hook primarily for API URL construction now
    const { getApiUrl, isLoading: isConfigLoading, isReady: isConfigReady, error: configError } = useConfig();

    // Use the SWR hook to ensure projects are loaded/cached
    const { projects: allProjects, isLoading: isLoadingProjectsSWR, isError: projectsErrorSWR } = useProjects();

    // Find the specific project from the SWR data
    const project = useMemo(() => {
        if (!allProjects) return undefined;
        // Assuming project.slug matches the route slug (dTag)
        return allProjects.find(p => p.slug === projectSlug);
    }, [allProjects, projectSlug]);

    // Keep store access for potential updates if needed later, but remove direct loading/error checks from it
    // const findProjectById = useProjectStore((state) => state.findProjectById); // No longer needed for lookup here
    // const isLoadingStoreProjects = useProjectStore((state) => state.isLoading); // Use SWR loading state
    // const storeError = useProjectStore((state) => state.error); // Use SWR error state

    // State management for UI interactions
    const [activeTab, setActiveTab] = useState("overview");

    // Memoize toolbarTabs creation based on static labels and setActiveTab
    const toolbarTabs = useMemo<[string, () => void][]>(() => [
        [TAB_LABELS[0], () => setActiveTab(TAB_LABELS[0].toLowerCase())],
        [TAB_LABELS[1], () => setActiveTab(TAB_LABELS[1].toLowerCase())],
        [TAB_LABELS[2], () => setActiveTab(TAB_LABELS[2].toLowerCase())],
        [TAB_LABELS[3], () => setActiveTab(TAB_LABELS[3].toLowerCase())],
    ], []); // No dependencies needed as setActiveTab is stable

    // Calculate initialActiveIndex for Toolbar based on current activeTab (Moved to top level)
    const initialActiveIndex = useMemo(() => {
        const index = toolbarTabs.findIndex(([label]) => label.toLowerCase() === activeTab);
        return index >= 0 ? index : 0; // Default to 0 if not found
    }, [activeTab, toolbarTabs]);

    // --- Event Handlers ---
    const handleSettingsClick = () => setActiveTab("settings");
    const handleEditorLaunch = async () => {
        // Config readiness check remains important for API calls
        if (!isConfigReady) {
            toast({
                title: "Configuration Error",
                description: configError || "Configuration not ready.",
                variant: "destructive",
            });
            return;
        }
        if (!projectSlug) {
            toast({ title: "Error", description: "Project ID is missing.", variant: "destructive" });
            return;
        }
        console.log("Requesting to launch editor for project:", projectSlug);
        try {
            const apiUrl = getApiUrl(`/projects/${projectSlug}/open-editor`);
            const response = await fetch(apiUrl, { method: "POST" });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }
            toast({
                title: "Editor Launch Requested",
                description: "Attempting to open the project in your editor...",
            });
            console.log("Editor launch request successful:", data.message);
        } catch (error: unknown) {
            console.error("Failed to request editor launch:", error);
            const message = error instanceof Error ? error.message : "Could not request editor launch.";
            toast({ title: "Editor Launch Failed", description: message, variant: "destructive" });
        }
    };

    // Combined loading state check
    if (isConfigLoading || isLoadingProjectsSWR) {
        return (
            <AppLayout>
                <div className="p-4">Loading...</div>
            </AppLayout>
        );
    }

    // Error state checks
    // Combined error state check (Config error is handled separately below)
    if (projectsErrorSWR) {
        return (
            <AppLayout>
                {/* Display config error first if it exists */}
                {configError && (
                    <div className="mb-4 p-4 bg-destructive/10 border border-destructive text-destructive rounded-md">
                        <h3 className="font-semibold">Configuration Error</h3>
                        <p>{configError} <Link href="/settings" className="underline ml-1">Check Settings</Link></p>
                    </div>
                )}
                <div className="p-4 text-red-600">Error loading projects: {projectsErrorSWR.message || 'Unknown error'}</div>
            </AppLayout>
        );
    }

    // If project not found in store after loading
    // Check if project exists after loading and without errors
    if (!project) {
        return (
            <AppLayout>
                 {/* Display config error first if it exists */}
                 {configError && (
                    <div className="mb-4 p-4 bg-destructive/10 border border-destructive text-destructive rounded-md">
                        <h3 className="font-semibold">Configuration Error</h3>
                        <p>{configError} <Link href="/settings" className="underline ml-1">Check Settings</Link></p>
                    </div>
                )}
                <div className="p-4 text-red-600">
                    Error: Project with slug '{projectSlug}' not found.
                </div>
            </AppLayout>
        );
    }

    // Determine if main content actions should be disabled (only config error now)
    const actionsDisabled = !isConfigReady;

    // toolbarTabs and initialActiveIndex calculation moved above the conditional returns

    return (
        <AppLayout>
            {configError && (
                <div className="mb-4 p-4 bg-destructive/10 border border-destructive text-destructive rounded-md">
                    <h3 className="font-semibold">Configuration Error</h3>
                    <p>
                        {configError}{" "}
                        <Link href="/settings" className="underline ml-1">
                            Check Settings
                        </Link>
                    </p>
                </div>
            )}

            <ProjectHeader
                project={project}
                onSettingsClick={handleSettingsClick}
                onEditorLaunch={handleEditorLaunch}
                // Provide dummy props for removed functionality to satisfy types
                onProjectCreate={() => { /* No-op: Creation handled elsewhere */ }}
                projectExists={true} // Assume exists if on this page
                isCreatingProject={false} // Creation state removed
                isConfigReady={isConfigReady}
            />

            <ProjectStatCards project={project} />

            <div className="w-full mt-6 flex justify-center"> {/* Center the toolbar */}
                <Toolbar tabs={toolbarTabs} initialActiveIndex={initialActiveIndex} />
            </div>

            {/* Tab Content Area */}
            <div className="mt-6">
                {activeTab === 'overview' && (
                    <ProjectOverviewTab
                        project={project}
                        // onReply, onRepost, onQuote, onZap removed
                    />
                )}

                {activeTab === 'tasks' && (
                    <TasksList // Use TasksList directly
                        project={project}
                        projectSlug={projectSlug}
                    />
                )}

                {activeTab === 'specs' && (
                    <ProjectSpecsTab project={project} projectSlug={projectSlug} />
                )}

                {activeTab === 'settings' && (
                    <ProjectSettingsTab project={project} projectSlug={projectSlug} />
                )}
            </div>
        </AppLayout>
    );
}

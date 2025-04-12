"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { NDKPrivateKeySigner, useNDKCurrentUser } from "@nostr-dev-kit/ndk-hooks"; // Removed useSubscribe
import { useRouter } from "next/navigation";
import Link from "next/link"; // Added Link import
import { AppLayout } from "@/components/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NDKProject } from "@/lib/nostr/events/project";
import { NDKTask } from "@/lib/nostr/events/task";
import { toast } from "@/components/ui/use-toast";
import { useConfig } from "@/hooks/useConfig";
import { useProjectStore } from "@/lib/store/projects"; // Import the project store
import { QuoteData } from "@/components/events/note/card";
// Removed Alert components as status checks are removed
// import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// import { AlertTriangle } from "lucide-react";

// Import common components
import { ProjectHeader } from "./components/ProjectHeader";
import { ProjectStatCards } from "./components/ProjectStatCards";
import { QuotePostDialog } from "./components/QuotePostDialog";

// Import the new Tab components
import { ProjectOverviewTab } from "./components/ProjectOverviewTab";
import { ProjectTasksTab } from "./components/ProjectTasksTab";
import { ProjectSettingsTab } from "./components/ProjectSettingsTab";
import { ProjectSpecsTab } from "./components/ProjectSpecsTab";

export default function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
    const unwrappedParams = React.use(params);
    const projectSlug = unwrappedParams.slug;
    const router = useRouter();
    // Use the config hook primarily for API URL construction now
    const { getApiUrl, isLoading: isConfigLoading, isReady: isConfigReady, error: configError } = useConfig();

    // Get project from the Zustand store
    const findProjectById = useProjectStore((state) => state.findProjectById);
    const project = useMemo(() => findProjectById(projectSlug), [findProjectById, projectSlug]);
    const isLoadingStoreProjects = useProjectStore((state) => state.isLoading); // Check if store is loading
    const storeError = useProjectStore((state) => state.error); // Check for store errors

    // Remove useSubscribe hook
    // const { events: projects } = useSubscribe(...);
    // const projectEvent = useMemo(() => projects[0], [projects]);
    // const project = useMemo(() => (projectEvent ? NDKProject.from(projectEvent) : null), [projectEvent]);

    console.log("project loaded", project?.inspect);

    // State management for UI interactions
    const [activeTab, setActiveTab] = useState("overview");
    const [isQuoting, setIsQuoting] = useState<QuoteData | null>(null);
    const [projectSigner, setProjectSigner] = useState<NDKPrivateKeySigner | null>(null);

    // Removed local useEffect for isConfigReady/configError - Handled by useConfig hook directly
    // --- Event Handlers ---
    const handleSettingsClick = () => setActiveTab("settings");
    const handleEditorLaunch = async () => {
        // setFetchStatusError(null); // Clear previous errors - State removed
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
    const handleReply = (itemId: string, content: string) =>
        console.log("Replying to:", itemId, "with content:", content);
    const handleRepost = (itemId: string) => console.log("Reposting:", itemId);
    const handleQuote = (quoteData: QuoteData) => setIsQuoting(quoteData);
    const handleQuoteSubmit = (quoteData: QuoteData, comment: string) => {
        console.log("Quoting:", quoteData, "with comment:", comment);
        setIsQuoting(null);
    };
    const handleZap = (itemId: string) => console.log("Zapping:", itemId);
    const handleDeleteTask = (taskId: string) => console.log("Deleting task:", taskId);
    const handleNavigateToTask = (task: NDKTask) => {
        if (task && projectSlug) {
            router.push(`/project/${projectSlug}/${task.id}`);
        }
    };
    // --- End Event Handlers ---

    // Get project signer
    useEffect(() => {
        if (!projectSigner && project) {
            project
                .getSigner()
                .then(setProjectSigner)
                .catch((error) => {
                    console.error("Error getting project signer:", error);
                });
        }
    }, [project, projectSigner]);

    // --- Render Logic ---

    if (isConfigLoading) {
        return (
            <AppLayout>
                <div className="p-4">Loading configuration...</div>
            </AppLayout>
        );
    }
    if (isLoadingStoreProjects) {
        return (
            <AppLayout>
                <div className="p-4">Loading projects from store...</div>
            </AppLayout>
        );
    }

    // Error state checks
    if (storeError) {
        return (
            <AppLayout>
                <div className="p-4 text-red-600">Error loading projects from store: {storeError}</div>
            </AppLayout>
        );
    }

    // If project not found in store after loading
    if (!project) {
        return (
            <AppLayout>
                <div className="p-4 text-red-600">
                    Error: Project with ID '{projectSlug}' not found in the store. Did you visit the dashboard first?
                </div>
            </AppLayout>
        );
    }

    // Determine if main content actions should be disabled (only config error now)
    const actionsDisabled = !isConfigReady;

    return (
        <AppLayout>
            {/* Display Configuration or Status Fetch Error Alert if present */}
            {/* Display Configuration Error Alert if present */}
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
                onProjectCreate={() => {
                    console.warn("Project creation called from header, but functionality removed.");
                }}
                projectExists={true} // Assume exists if on this page
                isCreatingProject={false} // Creation state removed
                isConfigReady={isConfigReady}
            />

            <ProjectStatCards project={project} />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-6">
                <TabsList className="grid w-full grid-cols-3 md:w-auto md:grid-cols-4 rounded-md p-1 bg-muted">
                    {/* Disable tabs if actions are disabled */}
                    <TabsTrigger
                        value="overview"
                        className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-950"
                        disabled={actionsDisabled}
                    >
                        Overview
                    </TabsTrigger>
                    <TabsTrigger
                        value="tasks"
                        className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-950"
                        disabled={actionsDisabled}
                    >
                        Tasks
                    </TabsTrigger>
                    <TabsTrigger
                        value="specs"
                        className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-950"
                        disabled={actionsDisabled}
                    >
                        Specs
                    </TabsTrigger>
                    <TabsTrigger
                        value="settings"
                        className="hidden md:block rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-950"
                        disabled={actionsDisabled}
                    >
                        Settings
                    </TabsTrigger>
                </TabsList>

                {/* Conditionally render tab content based on readiness */}
                <TabsContent value="overview" className="mt-6">
                    {/* Render tab content directly, disabling handled by TabsTrigger */}
                    {/* Removed duplicate TabsContent tag */}
                    <ProjectOverviewTab
                        project={project}
                        projectSigner={projectSigner}
                        onReply={handleReply}
                        onRepost={handleRepost}
                        onQuote={handleQuote}
                        onZap={handleZap}
                    />
                </TabsContent>

                <TabsContent value="tasks" className="mt-6">
                    <ProjectTasksTab
                        project={project}
                        onTaskSelect={handleNavigateToTask}
                        onDeleteTask={handleDeleteTask}
                        onTasksUpdate={() => console.log("Tasks updated, refetch needed")}
                    />
                </TabsContent>

                <TabsContent value="specs" className="mt-6">
                    <ProjectSpecsTab project={project} projectSlug={projectSlug} />
                </TabsContent>

                <TabsContent value="settings" className="mt-6">
                    <ProjectSettingsTab project={project} projectSlug={projectSlug} />
                </TabsContent>
            </Tabs>

            {/* Dialogs */}
            <QuotePostDialog quoting={isQuoting} onClose={() => setIsQuoting(null)} onQuote={handleQuoteSubmit} />
        </AppLayout>
    );
}

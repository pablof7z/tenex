"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { NDKPrivateKeySigner, useNDKCurrentUser, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { useRouter } from "next/navigation";
import Link from "next/link"; // Added Link import
import { AppLayout } from "@/components/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NDKProject } from "@/lib/nostr/events/project";
import { NDKTask } from "@/lib/nostr/events/task";
import { toast } from "@/components/ui/use-toast";
import { useConfig } from "@/hooks/useConfig"; // Import useConfig
import { QuoteData } from "@/components/events/note/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Added Alert components
import { AlertTriangle } from "lucide-react"; // Added AlertTriangle

// Import common components
import { ProjectHeader } from "./components/ProjectHeader";
import { ProjectStatCards } from "./components/ProjectStatCards";
import { QuotePostDialog } from "./components/QuotePostDialog";

// Import the new Tab components
import { ProjectOverviewTab } from "./components/ProjectOverviewTab";
import { ProjectTasksTab } from "./components/ProjectTasksTab";
import { ProjectSettingsTab } from "./components/ProjectSettingsTab";
import { ProjectSpecsTab } from "./components/ProjectSpecsTab";

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
    const unwrappedParams = React.use(params);
    const projectId = unwrappedParams.id;
    const router = useRouter();
    const currentUser = useNDKCurrentUser();
    // Use the hook, getting isReady and error state
    const { getApiUrl, isLoading: isConfigLoading, isReady: isConfigReady, error: configError } = useConfig();

    // Fetch project using useSubscribe with correct filtering
    const { events: projects } = useSubscribe(
        currentUser && projectId
            ? [{ kinds: [NDKProject.kind], authors: [currentUser?.pubkey], "#d": [projectId] }]
            : false,
    );

    // Get the project from the events
    const projectEvent = useMemo(() => projects[0], [projects]);
    const project = useMemo(() => (projectEvent ? NDKProject.from(projectEvent) : null), [projectEvent]);

    console.log("project loaded", project?.inspect);

    // State management for UI interactions
    const [activeTab, setActiveTab] = useState("overview");
    const [projectExistsLocally, setProjectExistsLocally] = useState<boolean | null>(null);
    const [projectConfigured, setProjectConfigured] = useState<boolean | null>(null);
    const [isConfiguringMcp, setIsConfiguringMcp] = useState(false);
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [isQuoting, setIsQuoting] = useState<QuoteData | null>(null);
    const [projectSigner, setProjectSigner] = useState<NDKPrivateKeySigner | null>(null);
    const [fetchStatusError, setFetchStatusError] = useState<string | null>(null); // Specific error for status fetch

    // Removed local useEffect for isConfigReady/configError

    // --- Event Handlers ---
    const handleSettingsClick = () => setActiveTab("settings");
    const handleEditorLaunch = async () => {
        setFetchStatusError(null); // Clear previous errors
        if (!isConfigReady) {
            toast({ title: "Configuration Error", description: configError || "Configuration not ready.", variant: "destructive" });
            return;
        }
        if (!projectId) {
            toast({ title: "Error", description: "Project ID is missing.", variant: "destructive" });
            return;
        }
        console.log("Requesting to launch editor for project:", projectId);
        try {
            const apiUrl = getApiUrl(`/projects/${projectId}/open-editor`);
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
    const handleAddTask = () => console.log("Adding task");
    const handleDeleteTask = (taskId: string) => console.log("Deleting task:", taskId);
    const handleAddComment = (taskId: string, comment: string) =>
        console.log("Adding comment to task:", taskId, "comment:", comment);
    const handleLaunchEditor = (taskId: string) => console.log("Launching editor for task:", taskId);
    const handleNavigateToTask = (task: NDKTask) => {
        if (task && projectId) {
            router.push(`/project/${projectId}/${task.id}`);
        }
    };
    // --- End Event Handlers ---

    // Fetch project existence and configuration status
    useEffect(() => {
        // Only run if config is ready and projectId exists
        if (!isConfigReady || !projectId) {
            if (!isConfigReady && !isConfigLoading) { // Only reset if config loading finished but wasn't ready
                setProjectExistsLocally(null);
                setProjectConfigured(null);
            }
            return;
        }

        setProjectExistsLocally(null);
        setProjectConfigured(null);
        setFetchStatusError(null); // Clear previous status fetch errors

        const apiUrl = getApiUrl(`/projects/${projectId}`);

        fetch(apiUrl)
            .then(async (res) => {
                if (res.ok) {
                    const data = await res.json();
                    setProjectExistsLocally(data.exists);
                    setProjectConfigured(data.configured);
                } else if (res.status === 404) {
                    setProjectExistsLocally(false);
                    setProjectConfigured(false);
                } else {
                    const errorText = await res.text().catch(() => `Status ${res.status}`);
                    console.error("Failed to check project status:", res.status, errorText);
                    setFetchStatusError(`Failed to check project status: ${res.status}. Check backend logs.`);
                    setProjectExistsLocally(false);
                    setProjectConfigured(false);
                }
            })
            .catch((error) => {
                console.error("Error fetching project status:", error);
                setFetchStatusError(`Network error fetching project status: ${error.message}`);
                setProjectExistsLocally(false);
                setProjectConfigured(false);
            });
    }, [projectId, isConfigReady, getApiUrl, isConfigLoading]); // Added isConfigLoading

    // Helper function to call the configure API, wrapped in useCallback
    const callConfigureApi = useCallback(
        async (nsecValue: string): Promise<boolean> => { // Return boolean success
            setFetchStatusError(null); // Clear previous errors
            if (!isConfigReady) {
                toast({ title: "Configuration Error", description: configError || "Configuration not ready.", variant: "destructive" });
                return false;
            }
            if (!projectId || isConfiguringMcp) return false;

            const apiUrl = getApiUrl(`/projects/${projectId}/configure`);

            setIsConfiguringMcp(true);
            console.log("Attempting to auto-configure MCP via API...");
            try {
                const response = await fetch(apiUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ nsec: nsecValue }),
                });
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
                    throw new Error(errorData.error);
                }
                console.log("MCP auto-configuration successful.");
                setProjectConfigured(true); // Update state
                toast({ title: "Project Configured", description: "Backend MCP settings updated automatically." });
                return true; // Indicate success
            } catch (error: unknown) {
                console.error("Failed to auto-configure MCP via API:", error);
                const message = error instanceof Error ? error.message : "Could not update backend MCP settings.";
                toast({ title: "MCP Auto-Configuration Failed", description: message, variant: "destructive" });
                setFetchStatusError(`MCP Auto-Configuration Failed: ${message}`); // Show error persistently
                return false; // Indicate failure
            } finally {
                setIsConfiguringMcp(false);
            }
        },
        [projectId, isConfiguringMcp, isConfigReady, getApiUrl, configError], // Added configError
    );

    // Effect to trigger auto-configuration if needed
    useEffect(() => {
        // Run only if config is ready, project exists locally, is not configured, project data loaded, and not already configuring
        if (isConfigReady && projectExistsLocally === true && projectConfigured === false && project && !isConfiguringMcp) {
            const attemptAutoConfigure = async () => {
                console.log("Project exists but not configured, attempting to get NSEC...");
                try {
                    const nsec = await project.getNsec();
                    if (nsec) {
                        console.log("NSEC retrieved, calling configure API...");
                        await callConfigureApi(nsec);
                    } else {
                        console.warn("Could not retrieve NSEC automatically. Manual configuration might be needed in settings.");
                        // Don't set fetchStatusError here, let user configure manually
                    }
                } catch (error) {
                    console.error("Error trying to get NSEC for auto-configuration:", error);
                    toast({
                        title: "Nsec Retrieval Failed",
                        description: "Could not get NSEC for auto-configuration. Please check settings.",
                        variant: "destructive",
                    });
                    setFetchStatusError("Could not retrieve NSEC for auto-configuration.");
                }
            };
            attemptAutoConfigure();
        }
    }, [projectExistsLocally, projectConfigured, project, isConfiguringMcp, callConfigureApi, isConfigReady]); // Dependencies updated

    // Handle project creation (local directory/setup)
    const handleCreateProject = async () => {
        setFetchStatusError(null); // Clear previous errors
        if (!isConfigReady) {
             toast({ title: "Configuration Error", description: configError || "Configuration not ready.", variant: "destructive" });
            return;
        }
        if (!projectId || isCreatingProject || !project) return;

        const apiUrl = getApiUrl(`/projects/${projectId}`);

        setIsCreatingProject(true);
        console.log("Attempting to create/verify project directory for:", projectId);
        const repoUrl = project?.repo;
        try {
            const response = await fetch(apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ repoUrl }),
            });
            if (response.ok) {
                console.log("Project directory created or verified.");
                setProjectExistsLocally(true);
                setProjectConfigured(false); // Assume not configured initially, let auto-configure handle it
            } else {
                const errorData = await response.json().catch(() => ({ error: `Failed with status: ${response.status}` }));
                const errorMsg = errorData.error;
                console.error("Failed to create/verify project directory:", response.status, errorMsg);
                toast({
                    title: "Project Setup Failed",
                    description: errorMsg,
                    variant: "destructive",
                });
                setFetchStatusError(`Project Setup Failed: ${errorMsg}`);
            }
        } catch (error: unknown) {
            console.error("Error calling create project API:", error);
            const message = error instanceof Error ? error.message : "Unknown project creation error.";
            toast({ title: "Project Setup Error", description: message, variant: "destructive" });
            setFetchStatusError(`Project Setup Error: ${message}`);
        } finally {
            setIsCreatingProject(false);
        }
    };

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

    // Loading state for configuration
    if (isConfigLoading) {
        return <AppLayout><div className="p-4">Loading configuration...</div></AppLayout>;
    }

    // If config is ready but project hasn't loaded yet from Nostr
    if (isConfigReady && !project) {
        return <AppLayout><div className="p-4">Loading project details from Nostr...</div></AppLayout>;
    }

    // If project failed to load from Nostr (shouldn't happen if ID is valid, but good practice)
    if (!project) {
         return <AppLayout><div className="p-4 text-red-600">Error: Project not found or could not be loaded.</div></AppLayout>;
    }

    // Determine if main content actions should be disabled (config error or status fetch error)
    const actionsDisabled = !isConfigReady || !!fetchStatusError;
    const overallError = configError || fetchStatusError;

    return (
        <AppLayout>
            {/* Display Configuration or Status Fetch Error Alert if present */}
            {overallError && (
                 <Alert variant="destructive" className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                        {overallError} {configError && <Link href="/settings" className="underline ml-1">Check Settings</Link>}
                    </AlertDescription>
                </Alert>
            )}

            <ProjectHeader
                project={project}
                onSettingsClick={handleSettingsClick}
                onEditorLaunch={handleEditorLaunch}
                onProjectCreate={handleCreateProject}
                projectExists={projectExistsLocally}
                isCreatingProject={isCreatingProject}
                isConfigReady={isConfigReady} // Pass config readiness from hook
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
                    {isConfigReady ? (
                        <ProjectOverviewTab
                            project={project}
                            projectSigner={projectSigner}
                            onReply={handleReply}
                            onRepost={handleRepost}
                            onQuote={handleQuote}
                            onZap={handleZap}
                        />
                    ) : <p className="text-muted-foreground">Overview unavailable due to configuration issues.</p>}
                </TabsContent>

                <TabsContent value="tasks" className="mt-6">
                     {isConfigReady ? (
                        <ProjectTasksTab
                            project={project}
                            onTaskSelect={handleNavigateToTask}
                            onDeleteTask={handleDeleteTask}
                            onTasksUpdate={() => console.log("Tasks updated, refetch needed")}
                        />
                     ) : <p className="text-muted-foreground">Tasks unavailable due to configuration issues.</p>}
                </TabsContent>

                <TabsContent value="specs" className="mt-6">
                     {isConfigReady ? (
                        <ProjectSpecsTab project={project} projectId={projectId} />
                     ) : <p className="text-muted-foreground">Specs unavailable due to configuration issues.</p>}
                </TabsContent>

                <TabsContent value="settings" className="mt-6">
                     {isConfigReady ? (
                        <ProjectSettingsTab project={project} />
                     ) : <p className="text-muted-foreground">Settings unavailable due to configuration issues.</p>}
                </TabsContent>
            </Tabs>

            {/* Dialogs */}
            <QuotePostDialog quoting={isQuoting} onClose={() => setIsQuoting(null)} onQuote={handleQuoteSubmit} />
        </AppLayout>
    );
}

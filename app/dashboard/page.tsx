"use client";

import { useState, useEffect, useCallback } from "react"; // Removed useMemo as activeProjects comes from store now
import { Plus, AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link"; // Added Link import
import { useNDK, useNDKCurrentUser, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk-hooks"; // Removed useSubscribe, NDKSubscriptionCacheUsage
import { NDKProject } from "@/lib/nostr/events/project";
// We might need a different card or adapt the existing one if it relies heavily on NDKEvent properties
import { ProjectCard } from "@/components/events/project/card";
import { useToast } from "@/hooks/use-toast";
import { useConfig } from "@/hooks/useConfig"; // Import useConfig
import { useProjectStore } from "@/lib/store/projects"; // Import the Zustand store

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AppLayout } from "@/components/app-layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Added Alert components
import type { NDKTag } from "@nostr-dev-kit/ndk"; // Import NDKTag type
// Define the expected shape of the project data from the API
interface ApiProject {
    projectName: string;
    title?: string; // Assuming title might be in .tenex.json
    description?: string; // Assuming description might be in .tenex.json
    hashtags?: string[]; // Assuming hashtags might be in .tenex.json
    repo?: string; // Assuming repo might be in .tenex.json
    // Add other relevant fields from .tenex.json
    nsec: string;
    pubkey: string;
    eventId?: string; // If the event ID is stored
    deleted?: boolean; // Added based on filter logic
}

export default function DashboardPage() {
    const { ndk } = useNDK(); // Still needed for creating projects
    const currentUser = useNDKCurrentUser(); // Still needed for creating projects and context

    // State for projects fetched from API
    const {
        projects,
        isLoading: isLoadingProjects,
        error: projectsError,
        setProjects,
        setLoading: setIsLoadingProjects,
        setError: setProjectsError,
        loadProjectDetails,
    } = useProjectStore();
    const { toast } = useToast();
    // Use the hook, getting isReady and error state
    const { getApiUrl, isLoading: isConfigLoading, isReady: isConfigReady, error: configError } = useConfig();
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [isCreating, setIsCreating] = useState(false); // For the create dialog
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        hashtags: "",
        gitRepo: "",
    });
    const [formError, setFormError] = useState<string | null>(null); // Error state for the create form

    // Function to fetch projects from the API
    // Function to fetch projects from the API and populate the store
    const fetchProjects = useCallback(async () => {
        if (!ndk) {
            console.warn("NDK not available yet, skipping fetchProjects.");
            return;
        }
        setIsLoadingProjects(true);
        setProjectsError(null);
        try {
            const apiUrl = getApiUrl("/projects");
            const response = await fetch(apiUrl);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: "Failed to fetch projects" }));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            const data: ApiProject[] = await response.json();

            // Load signer and pubkey details into the store from the API data
            data.forEach((apiProject) => {
                if (apiProject.projectName && apiProject.nsec && apiProject.pubkey) {
                    loadProjectDetails(apiProject.projectName, apiProject.nsec, apiProject.pubkey);
                } else {
                    console.warn("Missing data for loading project details:", apiProject);
                }
            });

            // Fetch NDK events based on event IDs from API data (if available)
            const slugs = data.map((p) => p.projectName).filter(Boolean) as string[]; // Use projectName as slug

            // Fetch based on slugs (#d tag) as primary identifier if eventId is missing
            const ndkProjects = await ndk.fetchEvents([{ kinds: [NDKProject.kind], "#d": slugs }]);

            setProjects(Array.from(ndkProjects).map(NDKProject.from));
            console.log("Fetched NDK events and set projects in store:", ndkProjects);
        } catch (error) {
            console.error("Failed to fetch projects:", error);
            const message = error instanceof Error ? error.message : "An unknown error occurred";
            setProjectsError(message);
            setProjects([]); // Clear projects in store on error
        } finally {
            setIsLoadingProjects(false);
        }
    }, [ndk, setIsLoadingProjects, setProjectsError, setProjects, loadProjectDetails, getApiUrl]); // Add loadProjectDetails and getApiUrl

    // Fetch projects on component mount
    // Fetch projects when NDK is ready
    useEffect(() => {
        if (ndk) {
            fetchProjects();
        }
    }, [ndk, fetchProjects]); // Depend on ndk instance availability

    // No need to memoize activeProjects separately, use directly from store
    // const activeProjects = useMemo(() => projects, [projects]);

    const handleCreateProject = async () => {
        setFormError(null); // Clear previous form errors
        if (!formData.name || !formData.description) {
            setFormError("Project name and description are required.");
            return;
        }

        if (!ndk || !currentUser) {
            setFormError("You must be logged in to create a project.");
            return;
        }
        // Check if config is ready and has no errors
        if (!isConfigReady) {
            // Error is already displayed via configError state, just prevent action
            toast({
                title: "Configuration Error",
                description: configError || "Configuration is not ready.",
                variant: "destructive",
            });
            return;
        }

        try {
            setIsCreating(true);

            // Create a new NDK Project with the NDK instance
            const project = new NDKProject(ndk);
            project.ndk = ndk;
            project.content = formData.description;

            // Set project properties
            project.title = formData.name;

            // Process hashtags
            if (formData.hashtags) {
                const hashtagArray = formData.hashtags
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter((tag) => tag.length > 0);
                project.hashtags = hashtagArray;
            }

            // Set git repository
            if (formData.gitRepo) {
                project.repo = formData.gitRepo;
            }

            const projectSigner = await project.getSigner();

            // Publish the project event
            await project.sign();
            console.log("Project published successfully:", project);

            // Now, create the local project structure
            try {
                // getApiUrl will now always return a string (relative or absolute)
                // Use the project ID (which is the 'd' tag) for the API endpoint
                const apiUrl = getApiUrl(`/projects/${project.slug}`); // Use tagId for the route param
                const localCreateResponse = await fetch(apiUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        title: formData.name, // <-- Add title here
                        // Send necessary data to the backend script
                        description: formData.description,
                        nsec: projectSigner.nsec,
                        pubkey: projectSigner.pubkey,
                        repo: formData.gitRepo || undefined,
                        hashtags: formData.hashtags || undefined, // Send raw hashtags string
                        eventId: project.tagId(),
                    }),
                });

                if (!localCreateResponse.ok) {
                    const errorData = await localCreateResponse
                        .json()
                        .catch(() => ({ error: "Failed to parse error response" }));
                    throw new Error(
                        errorData.error ||
                            `Failed to create project backend structure: ${localCreateResponse.statusText}`,
                    );
                }

                project.publish();

                const localCreateData = await localCreateResponse.json();
                console.log("Project backend structure created:", localCreateData);
            } catch (backendError) {
                console.error("Error creating project backend structure:", backendError);
                toast({
                    title: "Backend Error",
                    description:
                        backendError instanceof Error
                            ? backendError.message
                            : "Failed to create project backend files.",
                    variant: "default", // Keep as default/warning since Nostr event succeeded
                });
            }

            // Show success toast
            toast({
                title: "Project created",
                description: `${formData.name} has been created successfully.`,
                variant: "default",
            });

            // Reset form and close dialog
            setFormData({ name: "", description: "", hashtags: "", gitRepo: "" });
            setIsCreatingProject(false);
            console.log("Project created successfully via Nostr:", project);
            // Refetch projects from the API to update the list
            fetchProjects();
        } catch (err) {
            console.error("Error creating project:", err);
            const errorMessage = err instanceof Error ? err.message : "Failed to create project";
            setFormError(errorMessage); // Set form-specific error
            toast({
                title: "Error",
                description: errorMessage,
                variant: "destructive",
            });
        } finally {
            setIsCreating(false);
        }
    };

    // Determine if actions requiring API calls should be disabled
    const actionsDisabled = !isConfigReady || isConfigLoading;
    const configErrorTooltip = configError
        ? `Configuration Error: ${configError}`
        : !isConfigReady
          ? "Loading configuration..."
          : "";

    return (
        <AppLayout>
            {/* Display Configuration Error Alert if present */}
            {configError && !isConfigLoading && (
                <Alert variant="destructive" className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Configuration Error</AlertTitle>
                    <AlertDescription>
                        {configError} Please check{" "}
                        <Link href="/settings" className="underline">
                            Application Settings
                        </Link>
                        . API interactions may fail.
                    </AlertDescription>
                </Alert>
            )}

            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-medium tracking-tight">Projects</h1>
                <Dialog open={isCreatingProject} onOpenChange={setIsCreatingProject}>
                    <DialogTrigger asChild disabled={actionsDisabled}>
                        {/* Add tooltip for disabled state */}
                        <Button className="rounded-md" disabled={actionsDisabled} title={configErrorTooltip}>
                            <Plus className="mr-2 h-4 w-4" />
                            New Project {isConfigLoading ? "(Loading Config...)" : ""}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[525px]">
                        <DialogHeader>
                            <DialogTitle className="text-xl">Create new project</DialogTitle>
                            <DialogDescription>
                                Add the details for your new project. You can edit these later.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            {/* Form fields remain the same */}
                            <div className="grid gap-2">
                                <Label htmlFor="name">Project name</Label>
                                <Input
                                    id="name"
                                    placeholder="My Awesome Project"
                                    className="rounded-md"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="spec">Description</Label>
                                <Textarea
                                    id="spec"
                                    placeholder="Describe what you're building..."
                                    className="rounded-md min-h-[100px]"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="hashtags">Related hashtags</Label>
                                <Input
                                    id="hashtags"
                                    placeholder="nostr, bitcoin, development (comma separated)"
                                    className="rounded-md"
                                    value={formData.hashtags}
                                    onChange={(e) => setFormData({ ...formData, hashtags: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="gitRepo">Git Repository</Label>
                                <Input
                                    id="gitRepo"
                                    placeholder="github.com/username/repository"
                                    className="rounded-md"
                                    value={formData.gitRepo}
                                    onChange={(e) => setFormData({ ...formData, gitRepo: e.target.value })}
                                />
                            </div>
                            {/* Display form-specific error */}
                            {formError && <div className="text-red-500 text-sm mt-2">{formError}</div>}
                            {/* Display config error as well if relevant */}
                            {configError && <div className="text-orange-600 text-sm mt-2">Note: {configError}</div>}
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsCreatingProject(false);
                                    setFormData({ name: "", description: "", hashtags: "", gitRepo: "" });
                                    setFormError(null); // Clear form error on cancel
                                }}
                                className="rounded-md"
                                disabled={isCreating}
                            >
                                Cancel
                            </Button>
                            {/* Disable create button if config not ready/error or already creating */}
                            <Button
                                onClick={handleCreateProject}
                                className="rounded-md"
                                disabled={isCreating || actionsDisabled}
                                title={configErrorTooltip}
                            >
                                {isCreating ? "Creating..." : "Create project"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {isLoadingProjects ? (
                    <div className="col-span-3 text-center py-10 text-muted-foreground">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                        <p>Loading projects...</p>
                    </div>
                ) : projectsError ? (
                    <div className="col-span-3">
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Error Loading Projects</AlertTitle>
                            <AlertDescription>
                                {projectsError}
                                <Button variant="outline" size="sm" onClick={fetchProjects} className="ml-4">
                                    Retry
                                </Button>
                            </AlertDescription>
                        </Alert>
                    </div>
                ) : projects.length > 0 ? (
                    // Now mapping over NDKProject instances from the store
                    projects.map((project) => (
                        <ProjectCard
                            key={project.dTag || project.id} // Use dTag or event ID as key
                            // Adapt the passed project object to match ProjectCardDisplayProps
                            project={{
                                id: project.id,
                                slug: project.dTag || project.id || "unknown-slug", // Use dTag, fallback to id or placeholder
                                title: project.title || project.dTag || "Untitled Project", // Ensure title is always a string, fallback to dTag or placeholder
                                description: project.content,
                                hashtags: project.hashtags,
                                repo: project.repo,
                                // Add other props expected by ProjectCardDisplayProps if necessary
                                // For example, if it needs a specific date format:
                                // updatedAt: project.created_at ? new Date(project.created_at * 1000).toLocaleDateString() : 'N/A',
                            }}
                        />
                    ))
                ) : (
                    <div className="col-span-3 text-center py-10 text-muted-foreground">
                        {currentUser ? (
                            <p>No projects found. Create your first project to get started!</p>
                        ) : (
                            <p>Please log in to view your projects.</p> // This might need adjustment if login isn't strictly required to *view* projects fetched via API
                        )}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

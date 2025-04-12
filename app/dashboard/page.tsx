"use client";

import { useMemo, useState, useEffect } from "react";
import { Plus, AlertTriangle } from "lucide-react"; // Added AlertTriangle
import Link from "next/link"; // Added Link import
import { NDKSubscriptionCacheUsage, useNDK, useNDKCurrentUser, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { NDKProject } from "@/lib/nostr/events/project";
import { ProjectCard } from "@/components/events/project/card";
import { useToast } from "@/hooks/use-toast";
import { useConfig } from "@/hooks/useConfig"; // Import useConfig

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

export default function DashboardPage() {
    const { ndk } = useNDK();
    const currentUser = useNDKCurrentUser();
    // Subscribe to projects created by the current user
    const { events: projects, eose } = useSubscribe(
        currentUser ? [{ kinds: [NDKProject.kind], authors: [currentUser?.pubkey] }] : false,
    );
    const { toast } = useToast();
    // Use the hook, getting isReady and error state
    const { getApiUrl, isLoading: isConfigLoading, isReady: isConfigReady, error: configError } = useConfig();
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        tagline: "",
        description: "",
        hashtags: "",
        gitRepo: "",
    });
    const [formError, setFormError] = useState<string | null>(null); // Renamed local error state

    // Removed local useEffect for isConfigReady

    const activeProjects = useMemo(() => {
        return projects.filter((project) => project.hasTag("deleted") === false);
    }, [projects]);

    console.log("Fetched projects:", activeProjects.map(p => p.inspect).join("\n\n"));

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
             toast({ title: "Configuration Error", description: configError || "Configuration is not ready.", variant: "destructive" });
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

            // Publish the project event
            await project.publish();
            console.log("Project published successfully:", project);

            // Now, create the local project structure
            try {
                // getApiUrl will now always return a string (relative or absolute)
                const apiUrl = getApiUrl('/projects/create-local');
                const localCreateResponse = await fetch(apiUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        name: formData.name,
                        description: formData.description,
                    }),
                });

                if (!localCreateResponse.ok) {
                    const errorData = await localCreateResponse.json().catch(() => ({ error: "Failed to parse error response" }));
                    throw new Error(
                        errorData.error ||
                            `Failed to create local project structure: ${localCreateResponse.statusText}`,
                    );
                }

                const localCreateData = await localCreateResponse.json();
                console.log("Local project structure created:", localCreateData);

            } catch (localError) {
                console.error("Error creating local project structure:", localError);
                toast({
                    title: "Local Files Error",
                    description:
                        localError instanceof Error ? localError.message : "Failed to create local project files.",
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
            setFormData({ name: "", tagline: "", description: "", hashtags: "", gitRepo: "" });
            setIsCreatingProject(false);
            console.log("Project created successfully:", project);

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
    const configErrorTooltip = configError ? `Configuration Error: ${configError}` : !isConfigReady ? "Loading configuration..." : "";

    return (
        <AppLayout>
            {/* Display Configuration Error Alert if present */}
            {configError && !isConfigLoading && (
                 <Alert variant="destructive" className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Configuration Error</AlertTitle>
                    <AlertDescription>
                        {configError} Please check <Link href="/settings" className="underline">Application Settings</Link>. API interactions may fail.
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
                                <Label htmlFor="tagline">Tagline</Label>
                                <Input
                                    id="tagline"
                                    placeholder="A short description of your project"
                                    className="rounded-md"
                                    // Removed tagline input
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="spec">Initial product spec</Label>
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
                                    setFormData({ name: "", tagline: "", description: "", hashtags: "", gitRepo: "" });
                                    setFormError(null); // Clear form error on cancel
                                }}
                                className="rounded-md"
                                disabled={isCreating}
                            >
                                Cancel
                            </Button>
                            {/* Disable create button if config not ready/error or already creating */}
                            <Button onClick={handleCreateProject} className="rounded-md" disabled={isCreating || actionsDisabled} title={configErrorTooltip}>
                                {isCreating ? "Creating..." : "Create project"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {!eose ? (
                    <div className="col-span-3 text-center py-10 text-muted-foreground">
                        <p>Loading projects...</p>
                    </div>
                ) : activeProjects && activeProjects.length > 0 ? (
                    activeProjects
                        .map((project) => <ProjectCard key={project.id} project={project} />)
                ) : (
                    <div className="col-span-3 text-center py-10 text-muted-foreground">
                        {currentUser ? (
                            <p>No projects found. Create your first project to get started!</p>
                        ) : (
                            <p>Please log in to view your projects.</p>
                        )}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

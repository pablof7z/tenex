"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useNDK, useNDKCurrentUser } from "@nostr-dev-kit/ndk-hooks";
import { NDKProject } from "@/lib/nostr/events/project";
import { useToast } from "@/hooks/use-toast";
import { useConfig } from "@/hooks/useConfig";
import { Button } from "@/components/ui/button";
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

interface NewProjectButtonProps {
    onProjectCreated?: () => void;
}

export function NewProjectButton({ onProjectCreated }: NewProjectButtonProps) {
    const { ndk } = useNDK();
    const currentUser = useNDKCurrentUser();
    const { toast } = useToast();
    const { getApiUrl, isLoading: isConfigLoading, isReady: isConfigReady, error: configError } = useConfig();

    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        hashtags: "",
        repoUrl: "",
    });
    const [formError, setFormError] = useState<string | null>(null);

    const handleCreateProject = async () => {
        setFormError(null);
        if (!formData.name || !formData.description) {
            setFormError("Project name and description are required.");
            return;
        }

        if (!ndk || !currentUser) {
            setFormError("You must be logged in to create a project.");
            return;
        }

        if (!isConfigReady) {
            toast({
                title: "Configuration Error",
                description: configError || "Configuration is not ready.",
                variant: "destructive",
            });
            return;
        }

        try {
            setIsCreating(true);

            const project = new NDKProject(ndk);
            project.ndk = ndk;
            project.content = formData.description;
            project.title = formData.name;

            if (formData.hashtags) {
                const hashtagArray = formData.hashtags
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter((tag) => tag.length > 0);
                project.hashtags = hashtagArray;
            }

            if (formData.repoUrl) {
                project.repo = formData.repoUrl;
            }

            const projectSigner = await project.getSigner();

            await project.sign();

            try {
                const apiUrl = getApiUrl(`/projects/${project.slug}`);
                const localCreateResponse = await fetch(apiUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        title: formData.name,
                        description: formData.description,
                        nsec: projectSigner.nsec,
                        pubkey: projectSigner.pubkey,
                        repo: formData.repoUrl || undefined,
                        hashtags: formData.hashtags || undefined,
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

                await localCreateResponse.json();
            } catch (backendError) {
                console.error("Error creating project backend structure:", backendError);
                toast({
                    title: "Backend Error",
                    description:
                        backendError instanceof Error
                            ? backendError.message
                            : "Failed to create project backend files.",
                    variant: "default",
                });
            }

            toast({
                title: "Project created",
                description: `${formData.name} has been created successfully.`,
                variant: "default",
            });

            setFormData({ name: "", description: "", hashtags: "", repoUrl: "" });
            setIsCreatingProject(false);
            if (onProjectCreated) onProjectCreated();
        } catch (err) {
            console.error("Error creating project:", err);
            const errorMessage = err instanceof Error ? err.message : "Failed to create project";
            setFormError(errorMessage);
            toast({
                title: "Error",
                description: errorMessage,
                variant: "destructive",
            });
        } finally {
            setIsCreating(false);
        }
    };

    const actionsDisabled = !isConfigReady || isConfigLoading;
    const configErrorTooltip = configError
        ? `Configuration Error: ${configError}`
        : !isConfigReady
        ? "Loading configuration..."
        : "";

    return (
        <Dialog open={isCreatingProject} onOpenChange={setIsCreatingProject}>
            <DialogTrigger asChild disabled={actionsDisabled}>
                <Button className="rounded-md" disabled={actionsDisabled} title={configErrorTooltip}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Project {isConfigLoading ? "(Loading Config...)" : ""}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px]">
                <DialogHeader>
                    <DialogTitle className="text-xl">Create new project</DialogTitle>
                    <DialogDescription>
                        Add the details for your new project. You can edit these later.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
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
                        <Label htmlFor="repoUrl">Git Repository</Label>
                        <Input
                            id="repoUrl"
                            placeholder="github.com/username/repository"
                            className="rounded-md"
                            value={formData.repoUrl}
                            onChange={(e) => setFormData({ ...formData, repoUrl: e.target.value })}
                        />
                    </div>
                    {formError && <div className="text-red-500 text-sm mt-2">{formError}</div>}
                    {configError && <div className="text-orange-600 text-sm mt-2">Note: {configError}</div>}
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => {
                            setIsCreatingProject(false);
                            setFormData({ name: "", description: "", hashtags: "", repoUrl: "" });
                            setFormError(null);
                        }}
                        className="rounded-md"
                        disabled={isCreating}
                    >
                        Cancel
                    </Button>
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
    );
}
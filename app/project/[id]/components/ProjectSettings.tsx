import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link"; // Added Link import
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NDKProject } from "@/lib/nostr/events/project";
import { toast } from "@/components/ui/use-toast";
import { useConfig } from "@/hooks/useConfig"; // Import useConfig
import { Copy, Eye, EyeOff, Loader2, AlertTriangle } from "lucide-react"; // Added Loader2, AlertTriangle
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Added Alert components


interface ProjectSettingsProps {
    project: NDKProject;
}

export function ProjectSettings({ project }: ProjectSettingsProps) {
    const [name, setName] = useState(project.title || "");
    const [hashtags, setHashtags] = useState(project.hashtags?.join(", ") || "");
    const [gitRepo, setGitRepo] = useState(project.repo || "");
    const [nsec, setNsec] = useState<string | null>(null);
    const [showNsec, setShowNsec] = useState(false);
    const [isLoadingNsec, setIsLoadingNsec] = useState(true);
    const [isGeneratingNsec, setIsGeneratingNsec] = useState(false);
    const [isConfiguringMcp, setIsConfiguringMcp] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const router = useRouter();
    // Use isReady and error directly from the hook
    const { getApiUrl, isLoading: isConfigLoading, isReady: isConfigReady, error: configError } = useConfig();

    // Removed local useEffect for isConfigReady/configError

    useEffect(() => {
        const fetchNsec = async () => {
            setIsLoadingNsec(true);
            try {
                const encryptedKey = project.tagValue("key");
                if (encryptedKey) {
                    const fetchedNsec = await project.getNsec();
                    setNsec(fetchedNsec);
                } else {
                    setNsec(null);
                }
            } catch (error) {
                console.error("Failed to fetch or decrypt nsec:", error);
                setNsec(null);
                toast({
                    title: "Error fetching Nsec",
                    description: "Could not fetch or decrypt the project's nsec.",
                    variant: "destructive",
                });
            } finally {
                setIsLoadingNsec(false);
            }
        };
        fetchNsec();
    }, [project]);

    // Helper function to call the configure API, wrapped in useCallback
    const callConfigureApi = useCallback(async (nsecValue: string): Promise<boolean> => {
        // Check readiness using the hook's state
        if (!isConfigReady) {
            toast({ title: "Configuration Error", description: configError || "Configuration not ready.", variant: "destructive" });
            return false;
        }
        if (!project?.id) {
            toast({ title: "Error", description: "Project ID is missing.", variant: "destructive" });
            return false;
        }

        const apiUrl = getApiUrl(`/projects/${project.id}/configure`);
        // getApiUrl now always returns a string, no need to check for null

        setIsConfiguringMcp(true);
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

            console.log("MCP configuration updated successfully via API.");
            return true; // Indicate success
        } catch (error: unknown) {
            console.error("Failed to configure MCP via API:", error);
            const errorMessage = error instanceof Error ? error.message : "Could not update backend MCP settings.";
            toast({
                title: "MCP Configuration Failed",
                description: errorMessage,
                variant: "destructive",
            });
            // configError from the hook will display the persistent error if it was the cause
            return false; // Indicate failure
        } finally {
            setIsConfiguringMcp(false);
        }
    }, [isConfigReady, project, getApiUrl, configError]); // Added configError dependency

    const handleSave = async () => {
        setIsSaving(true);
        project.title = name;
        project.repo = gitRepo;
        project.hashtags = hashtags.split(",").map((tag) => tag.trim()).filter(t => t);
        try {
            await project.publishReplaceable();
            toast({
                title: "Project Saved",
                description: "Your project settings have been updated.",
            });
        } catch (error) {
            console.error("Failed to save project:", error);
            toast({
                title: "Error Saving Project",
                description: "Could not save project settings.",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleGenerateNsec = async () => {
        // Rely on callConfigureApi to check config readiness
        setIsGeneratingNsec(true);
        try {
            await project.getSigner();
            const newNsec = await project.getNsec();
            setNsec(newNsec);
            await project.publishReplaceable();

            let configureSuccess = false;
            if (newNsec) {
                configureSuccess = await callConfigureApi(newNsec);
            }

            if (configureSuccess) {
                toast({
                    title: "Nsec Generated & Configured",
                    description: "A new nsec has been generated, saved, and configured.",
                });
            } else if (newNsec) {
                 toast({
                    title: "Nsec Generated (Config Failed)",
                    description: "Nsec generated and saved, but backend configuration failed. Check errors.",
                    variant: "default",
                });
            } else {
                 throw new Error("Failed to retrieve generated NSEC after generation.");
            }

        } catch (error) {
            console.error("Failed to generate nsec:", error);
            toast({
                title: "Error Generating Nsec",
                description: error instanceof Error ? error.message : "Could not generate or save a new nsec.",
                variant: "destructive",
            });
        } finally {
            setIsGeneratingNsec(false);
        }
    };

    const handleCopyNsec = () => {
        if (nsec) {
            navigator.clipboard
                .writeText(nsec)
                .then(() => {
                    toast({ title: "Nsec Copied", description: "Project nsec copied to clipboard." });
                })
                .catch((err: unknown) => {
                    console.error("Failed to copy nsec: ", err);
                    toast({
                        title: "Copy Failed",
                        description: "Could not copy nsec to clipboard.",
                        variant: "destructive",
                    });
                });
        }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const existingDeletedTag = project.tags.find(t => t[0] === 'deleted');
            if (!existingDeletedTag) {
                project.tags.push(['deleted']);
            }
            await project.publishReplaceable();
            toast({
                title: "Project Marked for Deletion",
                description: "The project event has been updated.",
            });
            router.push('/dashboard');
        } catch (error) {
            console.error("Failed to delete project:", error);
            toast({
                title: "Error Deleting Project",
                description: "Could not mark the project for deletion.",
                variant: "destructive",
            });
            setIsDeleting(false);
        }
    };

    // Determine if actions should be disabled based on hook state
    const actionsDisabled = !isConfigReady || isConfigLoading;
    const generateDisabled = actionsDisabled || isGeneratingNsec || isConfiguringMcp;
    const saveDisabled = isSaving;
    const deleteDisabled = isDeleting;
    const configErrorTooltip = configError ? `Configuration Error: ${configError}` : !isConfigReady ? "Loading configuration..." : "";


    return (
        <Card className="rounded-md border-border">
            <CardHeader>
                <CardTitle className="text-xl">Project Settings</CardTitle>
                <CardDescription>Manage your project configuration and signing key.</CardDescription>
                 {/* Display persistent config error Alert if any */}
                 {configError && !isConfigLoading && (
                    <Alert variant="destructive" className="mt-2">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Configuration Error</AlertTitle>
                        <AlertDescription>
                             {configError} Please check <Link href="/settings" className="underline">Application Settings</Link>. API interactions may fail.
                        </AlertDescription>
                    </Alert>
                 )}
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Existing Fields */}
                <div className="grid gap-2">
                    <Label htmlFor="project-name">Project name</Label>
                    <Input
                        id="project-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="rounded-md"
                        disabled={saveDisabled}
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="project-hashtags">Related hashtags</Label>
                    <Input
                        id="project-hashtags"
                        value={hashtags}
                        onChange={(e) => setHashtags(e.target.value)}
                        className="rounded-md"
                        placeholder="nostr, project, development"
                        disabled={saveDisabled}
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="project-repo">Git Repository</Label>
                    <Input
                        id="project-repo"
                        value={gitRepo}
                        onChange={(e) => setGitRepo(e.target.value)}
                        className="rounded-md"
                        placeholder="github.com/username/repo"
                        disabled={saveDisabled}
                    />
                </div>

                {/* Nsec Section */}
                <div className="grid gap-2">
                    <Label htmlFor="project-nsec">Project Nsec (Secret Key)</Label>
                    {isLoadingNsec ? (
                        <p className="text-sm text-muted-foreground">Loading nsec...</p>
                    ) : nsec ? (
                        <div className="flex items-center space-x-2">
                            <Input
                                id="project-nsec"
                                type={showNsec ? "text" : "password"}
                                value={nsec}
                                readOnly
                                className="rounded-md flex-grow"
                                placeholder="nsec..."
                            />
                            {/* Disable buttons if config has error or is loading */}
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setShowNsec(!showNsec)}
                                title={showNsec ? "Hide Nsec" : "Show Nsec"}
                                disabled={actionsDisabled}
                            >
                                {showNsec ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                            <Button variant="outline" size="icon" onClick={handleCopyNsec} title={configErrorTooltip || "Copy Nsec"} disabled={actionsDisabled}>
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col space-y-2">
                            <p className="text-sm text-muted-foreground">
                                No nsec found for this project. Generate one to allow the project to sign events and
                                configure backend tools.
                            </p>
                            {/* Disable button if config has error or is loading, or during generation/configuration */}
                            <Button
                                className="rounded-md w-fit"
                                onClick={handleGenerateNsec}
                                disabled={generateDisabled}
                                title={configErrorTooltip || ""}
                            >
                                {isGeneratingNsec || isConfiguringMcp ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : null}
                                {isGeneratingNsec
                                    ? "Generating..."
                                    : isConfiguringMcp
                                      ? "Configuring..."
                                      : "Generate Nsec"}
                            </Button>
                        </div>
                    )}

                    <p className="text-xs text-muted-foreground pt-1">
                        This key allows the project to publish updates and interact on Nostr. Keep it secret. It's also
                        used to configure backend tools.
                    </p>
                </div>

                {/* Save Button */}
                <Button className="rounded-md mt-4" onClick={handleSave} disabled={saveDisabled}>
                     {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isSaving ? "Saving..." : "Save Changes"}
                </Button>

                {/* Delete Project Section */}
                <div className="pt-6 border-t border-destructive/20 mt-6">
                    <h3 className="text-lg font-semibold text-destructive">Danger Zone</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Deleting your project marks it as deleted on Nostr relays. This action cannot be easily undone.
                    </p>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="rounded-md" disabled={deleteDisabled}>
                                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                {isDeleting ? "Deleting..." : "Delete Project"}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be easily undone. This will mark the project event as deleted
                                    on Nostr relays. Are you sure you want to delete the project
                                    named "{project.title || 'Untitled Project'}"?
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    {isDeleting ? "Deleting..." : "Yes, delete project"}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardContent>
        </Card>
    );
}

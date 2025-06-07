import { useNDK } from "@nostr-dev-kit/ndk-hooks";
import { AlertTriangle, Copy, Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { useConfig } from "@/hooks/useConfig";
import { LoadedProject } from "@/hooks/useProjects";
import { NDKProject } from "@/lib/nostr/events/project";
import { NsecManager } from "./NsecManager"; // Import the new component
import { ProjectAgentProfileSettings } from "./ProjectAgentProfileSettings";

interface ProjectSettingsProps {
    project: LoadedProject;
    projectSlug: string;
}

export function ProjectSettings({ project, projectSlug }: ProjectSettingsProps) {
    const [name, setName] = useState(project.title || "");
    const [hashtags, setHashtags] = useState(project.event!.hashtags?.join(", ") || "");
    const [repoUrl, setRepoUrl] = useState(project.repo || "");
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const router = useRouter();
    const { getApiUrl, isLoading: isConfigLoading, isReady: isConfigReady, error: configError } = useConfig();
    const { ndk } = useNDK();

    const handleSave = async () => {
        setIsSaving(true);
        project.event ??= new NDKProject(ndk!);
        project.event.title = name;
        project.event.repo = repoUrl;
        project.event.hashtags = hashtags
            .split(",")
            .map((tag) => tag.trim())
            .filter((t) => t);
        try {
            await project.event.publishReplaceable();
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

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const existingDeletedTag = project.tags.find((t) => t[0] === "deleted");
            if (!existingDeletedTag) {
                project.tags.push(["deleted"]);
            }
            await project.publishReplaceable();
            toast({
                title: "Project Marked for Deletion",
                description: "The project event has been updated.",
            });
            router.push("/dashboard");
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

    const actionsDisabled = !isConfigReady || isConfigLoading;
    // Nsec related button states are handled within NsecManager
    const saveDisabled = isSaving;
    const deleteDisabled = isDeleting;
    const configErrorTooltip = configError
        ? `Configuration Error: ${configError}`
        : !isConfigReady
          ? "Loading configuration..."
          : "";

    return (
        <div className="flex flex-col space-y-4">
            <Card className="rounded-md border-border">
                <CardHeader>
                    <CardTitle className="text-xl">Project Settings</CardTitle>
                    <CardDescription>Manage your project configuration and signing key.</CardDescription>
                    {configError && !isConfigLoading && (
                        <Alert variant="destructive" className="mt-2">
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
                </CardHeader>
                <CardContent className="space-y-4">
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
                            value={repoUrl}
                            onChange={(e) => setRepoUrl(e.target.value)}
                            className="rounded-md"
                            placeholder="github.com/username/repo"
                            disabled={saveDisabled}
                        />
                    </div>

                    {/* Render NsecManager */}
                    <NsecManager
                        project={project}
                        isConfigReady={isConfigReady}
                        configError={configError}
                        getApiUrl={getApiUrl}
                    />

                    <Button className="rounded-md mt-4" onClick={handleSave} disabled={saveDisabled}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {isSaving ? "Saving..." : "Save Changes"}
                    </Button>

                    <div className="pt-6 border-t border-destructive/20 mt-6">
                        <h3 className="text-lg font-semibold text-destructive">Danger Zone</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Deleting your project marks it as deleted on Nostr relays. This action cannot be easily
                            undone.
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
                                        on Nostr relays. Are you sure you want to delete the project named "
                                        {project.title || "Untitled Project"}"?
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={handleDelete}
                                        disabled={isDeleting}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                        {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        {isDeleting ? "Deleting..." : "Yes, delete project"}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </CardContent>
            </Card>

            <ProjectAgentProfileSettings project={project} projectSlug={projectSlug} />
        </div>
    );
}

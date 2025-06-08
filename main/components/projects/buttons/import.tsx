"use client";

import { useState, useEffect, useCallback } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useNDK } from "@nostr-dev-kit/ndk-hooks";
import { NDKProject } from "@/lib/nostr/events/project";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import { useToast } from "@/components/ui/use-toast";
import { useConfig } from "@/hooks/useConfig";
import { useProjects } from "@/hooks/useProjects";
import { nip19 } from "nostr-tools";

export function ImportProjectsButton() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState<string | null>(null);
    const [userProjects, setUserProjects] = useState<NDKProject[]>([]);
    const [importedNaddrs, setImportedNaddrs] = useState<Set<string>>(new Set());
    const { ndk, currentUser } = useNDK();
    const { toast } = useToast();
    const { config } = useConfig();
    const { refresh } = useProjects();

    const fetchUserProjects = useCallback(async () => {
        if (!ndk || !currentUser) return;

        setLoading(true);
        try {
            const events = await ndk.fetchEvents({
                kinds: [31933],
                authors: [currentUser.pubkey],
            });

            const projects = Array.from(events).map((event) => {
                const project = new NDKProject(ndk, event.rawEvent());
                return project;
            });

            setUserProjects(projects.sort((a, b) => (b.created_at || 0) - (a.created_at || 0)));
        } catch (error) {
            console.error("Failed to fetch user projects:", error);
            toast({
                title: "Error",
                description: "Failed to fetch your projects from Nostr",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    }, [ndk, currentUser, toast]);

    const checkExistingProjects = useCallback(async () => {
        try {
            const response = await fetch("/api/projects");
            if (response.ok) {
                const localProjects = await response.json();
                const naddrs = new Set<string>();

                for (const project of localProjects) {
                    try {
                        const metadataPath = `${project.path}/.tenex/metadata.json`;
                        const metaResponse = await fetch(`/api/projects/path?path=${encodeURIComponent(metadataPath)}`);
                        if (metaResponse.ok) {
                            const metadata = await metaResponse.json();
                            if (metadata.projectNaddr) {
                                naddrs.add(metadata.projectNaddr);
                            }
                        }
                    } catch (error) {
                        console.error("Error reading project metadata:", error);
                    }
                }

                setImportedNaddrs(naddrs);
            }
        } catch (error) {
            console.error("Failed to check existing projects:", error);
        }
    }, []);

    useEffect(() => {
        if (open && currentUser) {
            fetchUserProjects();
            checkExistingProjects();
        }
    }, [open, currentUser, fetchUserProjects, checkExistingProjects]);

    const handleImportProject = async (project: NDKProject) => {
        if (!config?.backend) {
            toast({
                title: "Error",
                description: "Backend URL not configured",
                variant: "destructive",
            });
            return;
        }

        const projectNaddr = project.encode();
        setImporting(projectNaddr);

        try {
            const response = await fetch(`${config.backend}/api/projects/import`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-backend-command": config.backendCommand || "npx tenex",
                },
                body: JSON.stringify({
                    projectNaddr,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to import project");
            }

            toast({
                title: "Success",
                description: `Project "${project.title}" imported successfully`,
            });

            setImportedNaddrs((prev) => new Set(prev).add(projectNaddr));
            refresh();
            setOpen(false);
        } catch (error) {
            console.error("Import error:", error);
            toast({
                title: "Import Failed",
                description: error instanceof Error ? error.message : "Failed to import project",
                variant: "destructive",
            });
        } finally {
            setImporting(null);
        }
    };

    const getProjectStatus = (project: NDKProject) => {
        const naddr = project.encode();
        if (importedNaddrs.has(naddr)) {
            return "imported";
        }
        return "available";
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Import Projects
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Import Your Projects</DialogTitle>
                    <DialogDescription>
                        Select a project from your published Nostr events to import locally
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="h-[400px] pr-4">
                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <Card key={i}>
                                    <CardHeader>
                                        <Skeleton className="h-5 w-3/4" />
                                        <Skeleton className="h-4 w-1/2 mt-2" />
                                    </CardHeader>
                                    <CardContent>
                                        <Skeleton className="h-4 w-full" />
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : userProjects.length === 0 ? (
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                No projects found. Create a project first to see it here.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <div className="space-y-4">
                            {userProjects.map((project) => {
                                const status = getProjectStatus(project);
                                const isImported = status === "imported";
                                const projectNaddr = project.encode();

                                return (
                                    <Card key={project.dTag} className={isImported ? "opacity-60" : ""}>
                                        <CardHeader>
                                            <div className="flex items-start justify-between">
                                                <div className="space-y-1 flex-1">
                                                    <CardTitle className="text-base">
                                                        {project.title || "Untitled Project"}
                                                    </CardTitle>
                                                    <CardDescription className="text-sm">
                                                        {project.content || "No description"}
                                                    </CardDescription>
                                                </div>
                                                {isImported && (
                                                    <Badge variant="secondary" className="ml-2">
                                                        <CheckCircle2 className="mr-1 h-3 w-3" />
                                                        Imported
                                                    </Badge>
                                                )}
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex flex-wrap gap-2 mb-4">
                                                {project.hashtags?.map((tag) => (
                                                    <Badge key={tag} variant="outline" className="text-xs">
                                                        {tag}
                                                    </Badge>
                                                ))}
                                            </div>
                                            {project.repo && (
                                                <p className="text-xs text-muted-foreground mb-3">
                                                    Repository: {project.repo}
                                                </p>
                                            )}
                                            <Button
                                                onClick={() => handleImportProject(project)}
                                                disabled={isImported || importing === projectNaddr}
                                                size="sm"
                                                className="w-full"
                                            >
                                                {importing === projectNaddr ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Importing...
                                                    </>
                                                ) : isImported ? (
                                                    "Already Imported"
                                                ) : (
                                                    "Import Project"
                                                )}
                                            </Button>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

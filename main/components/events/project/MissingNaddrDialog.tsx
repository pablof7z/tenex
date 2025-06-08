"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { useConfig } from "@/hooks/useConfig";
import type { LoadedProject } from "@/hooks/useProjects";
import { NDKProject } from "@/lib/nostr/events/project";
import ndk from "@/lib/nostr/ndk";
import { NDKEvent, type NDKFilter } from "@nostr-dev-kit/ndk";
import { useNDKCurrentPubkey } from "@nostr-dev-kit/ndk-hooks";
import { AlertTriangle, Check, Search, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { nip19 } from "nostr-tools";
import { useEffect, useState } from "react";

interface MissingNaddrDialogProps {
    project: LoadedProject;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function MissingNaddrDialog({ project, open, onOpenChange }: MissingNaddrDialogProps) {
    const [searching, setSearching] = useState(false);
    const [foundEvents, setFoundEvents] = useState<NDKProject[]>([]);
    const [fixing, setFixing] = useState(false);
    const currentUserPubkey = useNDKCurrentPubkey();
    const { getApiUrl } = useConfig();
    const router = useRouter();

    useEffect(() => {
        if (open) {
            searchForProjectEvents();
        }
    }, [open]);

    const searchForProjectEvents = async () => {
        if (!currentUserPubkey) {
            console.error("No logged-in user pubkey found");
            return;
        }

        setSearching(true);
        setFoundEvents([]);

        try {
            // Search for project events (kind 31933) by the logged-in user
            const filter: NDKFilter = {
                kinds: [31933],
                authors: [currentUserPubkey],
            };

            const events = await ndk.fetchEvents(filter);
            const projectEvents = Array.from(events).map((event) => NDKProject.from(event));

            // Filter events by similar name/title
            const similarEvents = projectEvents.filter((event) => {
                const eventTitle = event.tagValue("title")?.toLowerCase() || "";
                const eventDTag = event.tagValue("d")?.toLowerCase() || "";
                const projectName = project.title.toLowerCase();
                const projectSlug = project.slug.toLowerCase();

                return (
                    eventTitle.includes(projectName) ||
                    projectName.includes(eventTitle) ||
                    eventDTag.includes(projectSlug) ||
                    projectSlug.includes(eventDTag) ||
                    eventTitle.includes(projectSlug) ||
                    projectSlug.includes(eventTitle)
                );
            });

            setFoundEvents(similarEvents);
        } catch (error) {
            console.error("Error searching for project events:", error);
        } finally {
            setSearching(false);
        }
    };

    const fixProjectNaddr = async (event: NDKProject) => {
        setFixing(true);

        const naddr = nip19.naddrEncode({
            identifier: event.tagValue("d") || "",
            pubkey: event.pubkey,
            kind: 31933,
        });

        try {
            const response = await fetch(getApiUrl(`/projects/${project.slug}/update-naddr`), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ projectNaddr: naddr }),
            });

            if (!response.ok) {
                throw new Error("Failed to update project metadata");
            }

            toast({
                title: "Success",
                description: "Project reference has been fixed. Refreshing...",
            });

            // Close dialog and refresh the page
            onOpenChange(false);
            setTimeout(() => {
                router.refresh();
                window.location.reload();
            }, 500);
        } catch (error) {
            console.error("Failed to fix project naddr:", error);
            toast({
                title: "Error",
                description: "Failed to update project reference. Please try again.",
                variant: "destructive",
            });
        } finally {
            setFixing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        Missing Project Event Reference
                    </DialogTitle>
                    <DialogDescription>
                        This project is missing its Nostr event reference (naddr) in the metadata file.
                    </DialogDescription>
                </DialogHeader>

                <Alert>
                    <AlertDescription>
                        The <code className="text-sm bg-muted px-1 py-0.5 rounded">metadata.json</code> file in the
                        project's <code className="text-sm bg-muted px-1 py-0.5 rounded">.tenex</code> directory is
                        missing the <code className="text-sm bg-muted px-1 py-0.5 rounded">projectNaddr</code> field.
                    </AlertDescription>
                </Alert>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium">Similar Project Events</h3>
                        <Button onClick={searchForProjectEvents} disabled={searching} size="sm" variant="outline">
                            <Search className="h-4 w-4 mr-2" />
                            {searching ? "Searching..." : "Search Again"}
                        </Button>
                    </div>

                    {foundEvents.length === 0 && !searching && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            No similar project events found for "{project.title}"
                        </p>
                    )}

                    {foundEvents.length > 0 && (
                        <div className="space-y-2">
                            {foundEvents.map((event) => {
                                return (
                                    <Card key={event.id}>
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 space-y-1">
                                                    <p className="font-medium">
                                                        {event.tagValue("title") || "Untitled"}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {event.tagValue("description") || "No description"}
                                                    </p>
                                                </div>
                                                <Button
                                                    onClick={() => fixProjectNaddr(event)}
                                                    size="sm"
                                                    variant="default"
                                                    disabled={fixing}
                                                >
                                                    {fixing ? (
                                                        <>
                                                            <Check className="h-4 w-4 mr-2 animate-spin" />
                                                            Fixing...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Wrench className="h-4 w-4 mr-2" />
                                                            Use This
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}

                    {foundEvents.length > 0 && (
                        <Alert>
                            <AlertDescription className="text-sm">
                                Click "Use This" on the correct project event above to fix the missing reference.
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

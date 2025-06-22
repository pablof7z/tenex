import { type NDKArticle, type NDKFilter, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { ChevronLeftIcon } from "@radix-ui/react-icons";
import { EVENT_KINDS } from "../lib/constants";
import { formatDistanceToNow } from "date-fns";
import { FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useProject } from "../hooks/useProject";
import { useTimeFormat } from "../hooks/useTimeFormat";
import { EmptyState } from "./common/EmptyState";
import { LoadingState } from "./common/LoadingState";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
import { ScrollArea } from "./ui/scroll-area";

interface DocsPageProps {
    onBack: () => void;
}

interface SpecDocument {
    id: string;
    name: string;
    title: string;
    summary: string;
    content: string;
    publishedAt: number;
    event: NDKArticle;
}

export function DocsPage({ onBack }: DocsPageProps) {
    const { projectId } = useParams();
    const project = useProject(projectId);
    const [selectedDoc, setSelectedDoc] = useState<SpecDocument | null>(null);
    const { formatAbsoluteTime } = useTimeFormat();

    // First, fetch the default agent event to get its pubkey
    const agentFilter = useMemo(() => {
        if (!project) return false;

        const defaultAgentTag = project.tags.find(
            (tag) => tag[0] === "agent" && tag[2] === "default"
        );

        if (!defaultAgentTag?.[1]) return false;

        return [
            {
                ids: [defaultAgentTag[1]],
                kinds: [4199], // NDKAgent kind
            },
        ];
    }, [project]);

    const { events: agentEvents } = useSubscribe(agentFilter, {}, [project?.id]);

    const agentPubkey = useMemo(() => {
        if (!agentEvents || agentEvents.length === 0) return null;
        return agentEvents[0]?.pubkey || null;
    }, [agentEvents]);

    // Subscribe to NDKArticle events from the default agent
    const filter = useMemo<NDKFilter[] | false>(() => {
        if (!agentPubkey) return false;

        return [
            {
                kinds: [EVENT_KINDS.ARTICLE], // NDKArticle kind
                authors: [agentPubkey],
            },
        ];
    }, [agentPubkey]);

    const { events: docEvents, eose } = useSubscribe<NDKArticle>(filter, { wrap: true }, [
        agentPubkey,
    ]);

    // Process documents
    const documents = useMemo(() => {
        if (!docEvents) return [];

        // Group by d tag and keep only the most recent version
        const latestDocs = new Map<string, SpecDocument>();

        for (const event of docEvents) {
            const dTag = event.tags.find((tag) => tag[0] === "d")?.[1];
            if (!dTag) continue;

            const doc: SpecDocument = {
                id: event.id,
                name: dTag,
                title: event.title || `${dTag} Specification`,
                summary: event.tags.find((tag) => tag[0] === "summary")?.[1] || "No summary",
                content: event.content,
                publishedAt: event.published_at || event.created_at || 0,
                event,
            };

            // Keep only the most recent version
            const existing = latestDocs.get(dTag);
            if (!existing || doc.publishedAt > existing.publishedAt) {
                latestDocs.set(dTag, doc);
            }
        }

        // Sort by published date, newest first
        return Array.from(latestDocs.values()).sort((a, b) => b.publishedAt - a.publishedAt);
    }, [docEvents]);

    if (!project) {
        return <LoadingState />;
    }

    return (
        <div className="flex flex-col h-screen bg-background">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={onBack}>
                        <ChevronLeftIcon className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-semibold">Documentation</h1>
                        <p className="text-sm text-muted-foreground">{project.title}</p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Document List */}
                <div className="w-80 border-r flex flex-col">
                    <div className="p-4 border-b">
                        <h2 className="font-medium">Specifications</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Living documentation for this project
                        </p>
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="p-4 space-y-2">
                            {!eose && documents.length === 0 ? (
                                <LoadingState />
                            ) : documents.length === 0 ? (
                                <EmptyState
                                    icon={<FileText className="w-8 h-8 text-muted-foreground" />}
                                    title="No documentation"
                                    description="No specification documents have been published yet"
                                />
                            ) : (
                                documents.map((doc) => (
                                    <Card
                                        key={doc.id}
                                        className={`p-3 cursor-pointer transition-colors hover:bg-accent ${
                                            selectedDoc?.id === doc.id ? "bg-accent" : ""
                                        }`}
                                        onClick={() => setSelectedDoc(doc)}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-medium truncate">{doc.name}</h3>
                                                <p className="text-sm text-muted-foreground truncate">
                                                    {doc.title}
                                                </p>
                                            </div>
                                            <HoverCard>
                                                <HoverCardTrigger asChild>
                                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {formatDistanceToNow(
                                                            doc.publishedAt * 1000,
                                                            {
                                                                addSuffix: true,
                                                            }
                                                        )}
                                                    </span>
                                                </HoverCardTrigger>
                                                <HoverCardContent side="left" className="w-80">
                                                    <div className="space-y-2">
                                                        <div>
                                                            <h4 className="font-medium">
                                                                Latest Change
                                                            </h4>
                                                            <p className="text-sm text-muted-foreground">
                                                                {doc.summary}
                                                            </p>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            Published{" "}
                                                            {formatAbsoluteTime(doc.publishedAt)}
                                                        </div>
                                                    </div>
                                                </HoverCardContent>
                                            </HoverCard>
                                        </div>
                                    </Card>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </div>

                {/* Document Viewer */}
                <div className="flex-1 flex flex-col">
                    {selectedDoc ? (
                        <>
                            <div className="p-6 border-b">
                                <h1 className="text-2xl font-bold mb-2">{selectedDoc.title}</h1>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <span>
                                        Last updated{" "}
                                        {formatDistanceToNow(selectedDoc.publishedAt * 1000, {
                                            addSuffix: true,
                                        })}
                                    </span>
                                    <span>•</span>
                                    <span>{selectedDoc.summary}</span>
                                </div>
                            </div>
                            <ScrollArea className="flex-1">
                                <div className="p-6">
                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                        <pre className="whitespace-pre-wrap font-sans">
                                            {selectedDoc.content}
                                        </pre>
                                    </div>
                                </div>
                            </ScrollArea>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <EmptyState
                                icon={<FileText className="w-8 h-8 text-muted-foreground" />}
                                title="Select a document"
                                description="Choose a specification from the list to view its contents"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

import { type NDKEvent, type NDKKind, NDKList } from "@nostr-dev-kit/ndk";
import {
    useNDK,
    useNDKCurrentUser,
    useNDKSessionSigners,
    useSubscribe,
} from "@nostr-dev-kit/ndk-hooks";
import { EVENT_KINDS } from "../lib/constants";
import { ArrowLeft, Bot, CheckCircle2, Copy, Eye } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "./common/EmptyState";
import { ErrorState } from "./common/ErrorState";
import { Button } from "./ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";

interface AgentRequest {
    id: string;
    agentPubkey: string;
    agentName: string;
    projectNaddr: string;
    agentEventId?: string;
    event: NDKEvent;
    isApproved: boolean;
}

interface AgentRequestsPageProps {
    onBack?: () => void;
}

export function AgentRequestsPage({ onBack }: AgentRequestsPageProps = {}) {
    const { ndk } = useNDK();
    const user = useNDKCurrentUser();
    const signers = useNDKSessionSigners();
    const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<NDKEvent | null>(null);
    const [copiedEvent, setCopiedEvent] = useState<string | null>(null);

    // Fetch existing agent list (kind 13199)
    const { events: agentLists } = useSubscribe<NDKList>(
        user
            ? [
                  {
                      kinds: [EVENT_KINDS.AGENT_REQUEST_LIST as NDKKind],
                      authors: [user.pubkey],
                      limit: 1,
                  },
              ]
            : false,
        { wrap: true },
        [user?.pubkey]
    );

    const existingAgentList = agentLists?.[0];

    // Fetch agent requests (kind 3199) that are for this user
    const { events: agentRequests } = useSubscribe(
        user
            ? [
                  {
                      kinds: [EVENT_KINDS.AGENT_REQUEST as NDKKind],
                      "#p": [user.pubkey],
                  },
              ]
            : false,
        {},
        [user?.pubkey]
    );

    // Get approved agents from existing list
    const approvedAgents = useMemo(() => {
        const approved = new Set<string>();
        if (existingAgentList) {
            for (const tag of existingAgentList.tags.filter((tag) => tag[0] === "p" && tag[1])) {
                approved.add(tag[1] as string);
            }
        }
        return approved;
    }, [existingAgentList]);

    // Process agent requests
    const processedRequests = useMemo((): AgentRequest[] => {
        if (!agentRequests) return [];

        return agentRequests.map((event) => {
            const nameTag = event.tags.find((tag) => tag[0] === "name");
            const aTag = event.tags.find((tag) => tag[0] === "a");
            const eTag = event.tags.find((tag) => tag[0] === "e");

            return {
                id: event.id,
                agentPubkey: event.pubkey,
                agentName: nameTag?.[1] || "Unknown Agent",
                projectNaddr: aTag?.[1] || "",
                agentEventId: eTag?.[1],
                event,
                isApproved: approvedAgents.has(event.pubkey),
            };
        });
    }, [agentRequests, approvedAgents]);

    // Filter out already approved agents
    const pendingRequests = processedRequests.filter((req) => !req.isApproved);

    const handleToggleAgent = (agentId: string) => {
        setSelectedAgents((prev) => {
            const next = new Set(prev);
            if (next.has(agentId)) {
                next.delete(agentId);
            } else {
                next.add(agentId);
            }
            return next;
        });
    };

    const handleCopyNevent = async (event: NDKEvent) => {
        try {
            await navigator.clipboard.writeText(event.encode());
            setCopiedEvent(event.id);
            setTimeout(() => setCopiedEvent(null), 2000);
        } catch (_err) {}
    };

    const handleSaveAgents = async () => {
        if (!user || !ndk || selectedAgents.size === 0) return;

        const signer = signers.get(user.pubkey);
        if (!signer) return;

        setSaving(true);
        setError(null);

        try {
            // Create new agent list event
            const newAgentList = new NDKList(ndk);
            newAgentList.kind = 13199 as NDKKind;
            newAgentList.tags = [];

            // Add existing approved agents
            if (existingAgentList) {
                for (const tag of existingAgentList.tags.filter((tag) => tag[0] === "p")) {
                    newAgentList.tags.push(tag);
                }
            }

            // Add newly selected agents
            for (const agentId of selectedAgents) {
                const request = pendingRequests.find((req) => req.id === agentId);
                if (request && !approvedAgents.has(request.agentPubkey)) {
                    newAgentList.tags.push(["p", request.agentPubkey, request.agentName]);
                }
            }

            // Sign and publish
            await newAgentList.sign(signer);
            await newAgentList.publish();

            // Clear selection after successful save
            setSelectedAgents(new Set());

            // Show success feedback
            setTimeout(() => {
                window.location.reload(); // Refresh to show updated list
            }, 1000);
        } catch (_err) {
            // console.error("Failed to save agent list:", err);
            setError("Failed to save agent list. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    if (!user) {
        return (
            <div className="p-6">
                <ErrorState
                    title="Not Signed In"
                    message="Please sign in to manage agent requests"
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="bg-card border-b border-border backdrop-blur-xl bg-card/95 sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-3">
                        {onBack && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onBack}
                                className="w-9 h-9"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        )}
                        <div>
                            <h1 className="text-2xl font-semibold">Agent Requests</h1>
                            {pendingRequests.length > 0 && (
                                <p className="text-sm text-muted-foreground mt-1">
                                    {pendingRequests.length} pending request
                                    {pendingRequests.length !== 1 ? "s" : ""}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-6 py-8">
                {error && <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>}

                {pendingRequests.length === 0 ? (
                    <EmptyState
                        icon={<Bot className="w-8 h-8 text-muted-foreground" />}
                        title="No Pending Requests"
                        description="When agents request to be associated with your account, they will appear here."
                    />
                ) : (
                    <>
                        <div className="mb-6">
                            <p className="text-gray-600 mb-4">
                                Select the agents you want to acknowledge as being controlled by
                                you:
                            </p>
                        </div>

                        <div className="space-y-4 mb-6">
                            {pendingRequests.map((request) => (
                                <Card key={request.id}>
                                    <CardHeader>
                                        <div className="flex items-start gap-4">
                                            <Checkbox
                                                checked={selectedAgents.has(request.id)}
                                                onCheckedChange={() =>
                                                    handleToggleAgent(request.id)
                                                }
                                                className="mt-1"
                                            />
                                            <div className="flex-1">
                                                <CardTitle className="text-lg">
                                                    {request.agentName}
                                                </CardTitle>
                                                <CardDescription>
                                                    <span className="font-mono text-xs">
                                                        {request.agentPubkey.slice(0, 8)}...
                                                    </span>
                                                    {request.projectNaddr && (
                                                        <span className="ml-2 text-xs">
                                                            Project:{" "}
                                                            {request.projectNaddr.slice(0, 20)}...
                                                        </span>
                                                    )}
                                                </CardDescription>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setSelectedEvent(request.event)}
                                                    title="View raw event"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleCopyNevent(request.event)}
                                                    title="Copy nevent"
                                                >
                                                    {copiedEvent === request.id ? (
                                                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                                                    ) : (
                                                        <Copy className="w-4 h-4" />
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                </Card>
                            ))}
                        </div>

                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-600">
                                {selectedAgents.size} agent{selectedAgents.size !== 1 ? "s" : ""}{" "}
                                selected
                            </p>
                            <Button
                                onClick={handleSaveAgents}
                                disabled={selectedAgents.size === 0 || saving}
                                variant="primary"
                            >
                                {saving ? "Saving..." : "Save Selected Agents"}
                            </Button>
                        </div>
                    </>
                )}

                {processedRequests.filter((req) => req.isApproved).length > 0 && (
                    <div className="mt-12">
                        <h2 className="text-xl font-semibold mb-4">Approved Agents</h2>
                        <div className="space-y-2">
                            {processedRequests
                                .filter((req) => req.isApproved)
                                .map((request) => (
                                    <div
                                        key={request.id}
                                        className="flex items-center gap-2 p-3 bg-green-50 rounded-lg"
                                    >
                                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                                        <span className="font-medium">{request.agentName}</span>
                                        <span className="text-sm text-gray-600 font-mono">
                                            {request.agentPubkey.slice(0, 8)}...
                                        </span>
                                        <div className="ml-auto flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setSelectedEvent(request.event)}
                                                title="View raw event"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleCopyNevent(request.event)}
                                                title="Copy nevent"
                                            >
                                                {copiedEvent === request.id ? (
                                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                                ) : (
                                                    <Copy className="w-4 h-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Raw Event Dialog */}
            <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
                <DialogContent className="max-w-2xl max-h-[80vh]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Eye className="w-5 h-5" />
                            Raw Event Data
                        </DialogTitle>
                        <DialogDescription>
                            Complete Nostr event data for this agent request
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="h-[60vh] pr-4">
                        <pre className="bg-muted p-4 rounded-md text-xs font-mono whitespace-pre-wrap">
                            {selectedEvent && JSON.stringify(selectedEvent.rawEvent(), null, 2)}
                        </pre>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
    );
}

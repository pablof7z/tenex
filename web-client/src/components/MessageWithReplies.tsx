import { useNDK, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import type { NDKEvent } from "@nostr-dev-kit/ndk-hooks";
import type { NDKProject } from "@nostr-dev-kit/ndk-svelte";
import { ChevronDown, ChevronRight, Send, Reply } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { EVENT_KINDS } from "../lib/constants";
import { StatusUpdate } from "./tasks/StatusUpdate";
import { Button } from "./ui/button";

interface MessageWithRepliesProps {
    event: NDKEvent;
    project: NDKProject;
}

// Simple reply component that doesn't have its own subscriptions
const ReplyMessage = memo(function ReplyMessage({ 
    event, 
    onReply,
    depth = 0
}: { 
    event: NDKEvent; 
    onReply: (event: NDKEvent) => void;
    depth?: number;
}) {
    return (
        <div className={depth > 0 ? "pl-4" : ""}>
            <StatusUpdate event={event} onReply={onReply} />
        </div>
    );
});

export const MessageWithReplies = memo(function MessageWithReplies({
    event,
    project,
}: MessageWithRepliesProps) {
    const { ndk } = useNDK();
    const [showReplies, setShowReplies] = useState(false);
    const [replyToEvent, setReplyToEvent] = useState<NDKEvent | null>(null);
    const [replyInput, setReplyInput] = useState("");
    const [isSending, setIsSending] = useState(false);

    // Subscribe to ALL replies in the thread at once to avoid nested subscriptions
    const { events: allReplies } = useSubscribe(
        showReplies && typeof event.filter === "function"
            ? [
                  {
                      kinds: [EVENT_KINDS.GENERIC_REPLY],
                      ...event.filter(),
                  },
              ]
            : false,
        {},
        [event.id, showReplies]
    );

    // Build reply tree structure
    const replyTree = useMemo(() => {
        if (!allReplies || allReplies.length === 0) return { direct: [], all: [] };
        
        const directReplies: NDKEvent[] = [];
        const replyMap = new Map<string, NDKEvent[]>();
        
        // First pass: categorize replies
        for (const reply of allReplies) {
            const eTag = reply.tags?.find(tag => tag[0] === "e" && tag[3] === "reply");
            const parentId = eTag?.[1] || reply.tags?.find(tag => tag[0] === "e")?.[1];
            
            if (parentId === event.id) {
                directReplies.push(reply);
            } else if (parentId) {
                const existing = replyMap.get(parentId) || [];
                existing.push(reply);
                replyMap.set(parentId, existing);
            }
        }
        
        // Sort by timestamp
        directReplies.sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0));
        
        return { direct: directReplies, replyMap };
    }, [allReplies, event.id]);

    const handleReply = useCallback((targetEvent: NDKEvent) => {
        setReplyToEvent(targetEvent);
        setShowReplies(true);
    }, []);

    const handleSendReply = useCallback(async () => {
        if (!replyInput.trim() || !ndk?.signer || isSending || !replyToEvent) return;

        setIsSending(true);
        try {
            const replyEvent = replyToEvent.reply();
            replyEvent.content = replyInput.trim();
            
            // Add project tag
            replyEvent.tags.push(["a", project.tagId()]);
            
            await replyEvent.publish();
            
            setReplyInput("");
            setReplyToEvent(null);
        } catch (error) {
            console.error("Failed to send reply:", error);
        } finally {
            setIsSending(false);
        }
    }, [replyInput, ndk, replyToEvent, isSending, project]);

    const handleKeyPress = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendReply();
            }
        },
        [handleSendReply]
    );

    // Render a reply and its sub-replies
    const renderReplyBranch = useCallback((reply: NDKEvent, currentDepth: number) => {
        const subReplies = replyTree.replyMap?.get(reply.id) || [];
        
        return (
            <div key={reply.id}>
                <ReplyMessage 
                    event={reply} 
                    onReply={handleReply}
                    depth={currentDepth}
                />
                {subReplies.length > 0 && (
                    <div className="border-l-2 border-muted ml-5">
                        {subReplies
                            .sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0))
                            .map(subReply => renderReplyBranch(subReply, currentDepth + 1))}
                    </div>
                )}
            </div>
        );
    }, [replyTree.replyMap, handleReply]);

    return (
        <div className="group">
            <StatusUpdate event={event} onReply={() => handleReply(event)} />
            
            {/* Reply count and toggle */}
            {replyTree.direct.length > 0 && (
                <div className="pl-11 -mt-1">
                    <button
                        type="button"
                        onClick={() => setShowReplies(!showReplies)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {showReplies ? (
                            <ChevronDown className="w-3 h-3" />
                        ) : (
                            <ChevronRight className="w-3 h-3" />
                        )}
                        {allReplies?.length || 0} {(allReplies?.length || 0) === 1 ? "reply" : "replies"}
                    </button>
                </div>
            )}

            {/* Replies */}
            {showReplies && replyTree.direct.length > 0 && (
                <div className="pl-11 mt-2 space-y-1 border-l-2 border-muted ml-5">
                    {replyTree.direct.map(reply => renderReplyBranch(reply, 0))}
                </div>
            )}

            {/* Reply input */}
            {replyToEvent && (
                <div className="pl-11 mt-2">
                    <div className="bg-muted/50 p-2 rounded mb-2">
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Reply className="w-3 h-3" />
                            Replying to {replyToEvent.id === event.id ? "this message" : "a reply"}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <textarea
                            value={replyInput}
                            onChange={(e) => setReplyInput(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder="Write a reply..."
                            className="flex-1 min-h-[60px] p-2 text-sm bg-background border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <div className="flex flex-col gap-1">
                            <Button
                                size="sm"
                                onClick={handleSendReply}
                                disabled={!replyInput.trim() || isSending}
                            >
                                <Send className="w-4 h-4" />
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                    setReplyToEvent(null);
                                    setReplyInput("");
                                }}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});
import { type NDKKind, NDKTask } from "@nostr-dev-kit/ndk";
import {
    NDKEvent,
    type NDKProject,
    useEvent,
    useNDK,
    useSubscribe,
} from "@nostr-dev-kit/ndk-hooks";
import { EVENT_KINDS } from "@tenex/types/events";
import { useAtom } from "jotai";
import { ArrowDown, Send } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useMentionAutocomplete } from "../hooks/useMentionAutocomplete";
import { useProjectAgents } from "../hooks/useProjectAgents";
import { useProjectLLMConfigs } from "../hooks/useProjectLLMConfigs";
import { useScrollManagement } from "../hooks/useScrollManagement";
import { messageDraftsAtom, selectedTaskAtom } from "../lib/store";
import { BackendButtons } from "./BackendButtons";
import { ChatDebugDialog } from "./chat/ChatDebugDialog";
import { ChatHeader } from "./chat/ChatHeader";
import { ChatInputArea } from "./chat/ChatInputArea";
import { ChatTypingIndicator } from "./chat/ChatTypingIndicator";
import { AgentDiscoveryCard } from "./common/AgentDiscoveryCard";
import { CommandExecutionCard } from "./common/CommandExecutionCard";
import { StatusUpdate } from "./tasks/StatusUpdate";
import { TaskCard } from "./tasks/TaskCard";
import { Button } from "./ui/button";

interface ChatInterfaceProps {
    statusUpdates?: NDKEvent[];
    taskId?: string;
    inputPlaceholder?: string;
    allowInput?: boolean;
    onReplyToTask?: (taskId: string) => void;
    className?: string;
    // New props for thread mode
    project?: NDKProject;
    threadId?: string;
    threadTitle?: string;
    initialAgentPubkeys?: string[];
    onBack?: () => void;
}

// Memoized message list component
const MessageList = memo(
    ({
        messages,
        onMessageClick,
        onTaskClick,
    }: {
        messages: NDKEvent[];
        onMessageClick?: (event: NDKEvent) => void;
        onTaskClick?: (task: NDKTask) => void;
    }) => {
        return (
            <div className="space-y-1">
                {messages.map((event) => {
                    // Check if this is a task event
                    if (event.kind === EVENT_KINDS.TASK) {
                        // For tasks, we'll render them as a special message with the task card
                        const task = event as NDKTask;
                        const taskComplexity = task.tags?.find(
                            (tag) => tag[0] === "complexity"
                        )?.[1];

                        return (
                            <div key={event.id} className="p-3">
                                <div className="text-xs text-muted-foreground mb-2">
                                    Task created • Complexity: {taskComplexity}/10
                                </div>
                                <TaskCard task={task} onClick={() => onTaskClick?.(task)} />
                            </div>
                        );
                    }

                    // Check for render-type tag
                    const renderType = event.tagValue("render-type");

                    // If render-type is "agent_discovery", render the discovery card
                    if (renderType === "agent_discovery") {
                        return (
                            <div key={event.id}>
                                <AgentDiscoveryCard event={event} />
                            </div>
                        );
                    }

                    // For all other events, render as status update
                    return (
                        <div
                            key={event.id}
                            onClick={() => onMessageClick?.(event)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    onMessageClick?.(event);
                                }
                            }}
                            className={onMessageClick ? "cursor-pointer" : ""}
                            tabIndex={onMessageClick ? 0 : undefined}
                            role={onMessageClick ? "button" : undefined}
                        >
                            <StatusUpdate event={event} />
                        </div>
                    );
                })}
            </div>
        );
    }
);

MessageList.displayName = "MessageList";

export function ChatInterface({
    statusUpdates = [],
    taskId,
    inputPlaceholder = "Add a comment...",
    allowInput = true,
    onReplyToTask,
    className = "",
    project,
    threadId,
    threadTitle,
    initialAgentPubkeys = [],
    onBack,
}: ChatInterfaceProps) {
    const { ndk } = useNDK();
    const [isSending, setIsSending] = useState(false);
    const [kind11Event, setKind11Event] = useState<NDKEvent | null>(null);
    const [showDebugDialog, setShowDebugDialog] = useState(false);
    const [debugIndicator, setDebugIndicator] = useState<NDKEvent | null>(null);
    const [, setSelectedTask] = useAtom(selectedTaskAtom);
    const [messageDrafts, setMessageDrafts] = useAtom(messageDraftsAtom);

    // Determine if we're in thread mode
    const isThreadMode = !!(project && threadTitle);

    // Get project agents for @mentions
    const projectAgents = useProjectAgents(project?.tagId());

    // Generate a stable conversation ID for draft persistence
    const conversationId = useMemo(() => {
        if (isThreadMode) {
            // For existing threads, use the thread event ID
            if (threadId && threadId !== "new") return threadId;
            // For new threads, use a stable identifier based on thread title
            if (threadTitle) return `new-${threadTitle}`;
        } else if (taskId) {
            // For task conversations, use the task ID
            return taskId;
        }
        return null;
    }, [isThreadMode, threadId, threadTitle, taskId]);

    // Initialize message input from drafts
    const [messageInput, setMessageInput] = useState(() => {
        if (conversationId) {
            return messageDrafts.get(conversationId) || "";
        }
        return "";
    });

    // Update draft when messageInput changes
    useEffect(() => {
        if (!conversationId) return;

        if (messageInput.trim()) {
            // Save draft if there's content
            setMessageDrafts((prev) => {
                const newDrafts = new Map(prev);
                newDrafts.set(conversationId, messageInput);
                return newDrafts;
            });
        } else {
            // Remove draft if empty
            setMessageDrafts((prev) => {
                const newDrafts = new Map(prev);
                newDrafts.delete(conversationId);
                return newDrafts;
            });
        }
    }, [messageInput, conversationId, setMessageDrafts]);

    // Get project directory and LLM configurations
    // Extract just the d-tag from the project's tagId (format: 31933:pubkey:d-tag)
    const projectTagId = project?.tagId();
    const projectDir = projectTagId ? projectTagId.split(":")[2] : undefined;
    const availableLLMConfigs = useProjectLLMConfigs(projectDir);

    // Use mention autocomplete hook
    const {
        textareaRef,
        showAgentMenu,
        filteredAgents,
        selectedAgentIndex,
        handleInputChange,
        handleKeyDown: handleMentionKeyDown,
        insertMention,
        extractMentions,
    } = useMentionAutocomplete(projectAgents, messageInput, setMessageInput);

    // Auto-focus the input when thread view opens
    useEffect(() => {
        if (isThreadMode && textareaRef.current) {
            // Small delay to ensure DOM is ready
            setTimeout(() => {
                textareaRef.current?.focus();
            }, 100);
        }
    }, [isThreadMode]);

    // Subscribe to existing thread if we have a threadId (but not for 'new' threads)
    const existingThread = useEvent(threadId && threadId !== "new" ? threadId : false);

    // Use existing thread or the kind11Event for new threads
    const currentThreadEvent = existingThread || kind11Event;

    // Get thread title from the thread event if we don't have it from props
    const effectiveThreadTitle = useMemo(() => {
        if (threadTitle) return threadTitle;
        if (currentThreadEvent) {
            const titleTag = currentThreadEvent.tags?.find(
                (tag: string[]) => tag[0] === "title"
            )?.[1];
            if (titleTag) return titleTag;
            // Fallback to first line of content
            const firstLine = currentThreadEvent.content?.split("\n")[0] || "Thread";
            return firstLine.length > 50 ? `${firstLine.slice(0, 50)}...` : firstLine;
        }
        return "Thread";
    }, [threadTitle, currentThreadEvent]);

    // Subscribe to thread messages when currentThreadEvent is available
    const { events: threadReplies } = useSubscribe(
        currentThreadEvent && typeof currentThreadEvent.nip22Filter === "function"
            ? [
                  {
                      kinds: [EVENT_KINDS.THREAD_REPLY as NDKKind],
                      ...currentThreadEvent.nip22Filter(),
                  },
              ]
            : false,
        {},
        [currentThreadEvent?.id]
    );

    // Subscribe to tasks related to the thread
    // This ensures tasks are in the cache when referenced via nostr:nevent1...
    const { events: relatedTasks } = useSubscribe(
        currentThreadEvent && typeof currentThreadEvent.filter === "function"
            ? [{ kinds: [NDKTask.kind], ...currentThreadEvent.filter() }]
            : false,
        {},
        [currentThreadEvent?.id]
    );

    // Subscribe to typing indicators when we have a thread or task
    const { events: typingIndicatorEvents } = useSubscribe(
        currentThreadEvent || taskId
            ? [
                  {
                      kinds: [
                          EVENT_KINDS.TYPING_INDICATOR as NDKKind,
                          EVENT_KINDS.TYPING_INDICATOR_STOP as NDKKind,
                      ],
                      "#e": currentThreadEvent ? [currentThreadEvent.id] : taskId ? [taskId] : [],
                      since: Math.floor(Date.now() / 1000) - 60, // Only show indicators from last minute
                  },
              ]
            : false,
        {},
        [currentThreadEvent?.id, taskId]
    );

    // Process typing indicators - only keep latest per pubkey
    const activeTypingIndicators = useMemo(() => {
        if (!typingIndicatorEvents || typingIndicatorEvents.length === 0) return [];

        // Group by pubkey and keep only the latest event
        const indicatorsByPubkey = new Map<string, NDKEvent>();

        // Sort events by created_at to process them in order
        const sortedEvents = [...typingIndicatorEvents].sort(
            (a, b) => (a.created_at ?? 0) - (b.created_at ?? 0)
        );

        for (const event of sortedEvents) {
            if (event.kind === EVENT_KINDS.TYPING_INDICATOR_STOP) {
                // Stop typing event - remove the indicator
                indicatorsByPubkey.delete(event.pubkey);
            } else if (event.kind === EVENT_KINDS.TYPING_INDICATOR) {
                // Start typing event - add/update the indicator
                indicatorsByPubkey.set(event.pubkey, event);
            }
        }

        // Filter out indicators older than 30 seconds (safety net)
        const thirtySecondsAgo = Math.floor(Date.now() / 1000) - 30;
        const active = Array.from(indicatorsByPubkey.values()).filter(
            (event) =>
                (event.created_at ?? 0) > thirtySecondsAgo &&
                event.kind === EVENT_KINDS.TYPING_INDICATOR
        );

        return active;
    }, [typingIndicatorEvents]);

    // Combine the thread event and its replies
    const threadMessages = useMemo(() => {
        if (!currentThreadEvent) return [];

        // Start with the thread event itself
        const messages = [currentThreadEvent];

        // Add all replies
        if (threadReplies && threadReplies.length > 0) {
            messages.push(...threadReplies);
        }

        // Add all related tasks
        if (relatedTasks && relatedTasks.length > 0) {
            messages.push(...relatedTasks);
        }

        // Sort by created_at timestamp
        return messages.sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0));
    }, [currentThreadEvent, threadReplies, relatedTasks]);

    // Get unique participants from thread messages and p-tags
    const threadParticipants = useMemo(() => {
        if (!isThreadMode) return [];

        const participantSet = new Set<string>();

        // Add participants from messages
        for (const message of threadMessages) {
            participantSet.add(message.pubkey);

            // Also add any p-tagged participants from the original thread event
            if (message === currentThreadEvent) {
                for (const tag of message.tags || []) {
                    if (tag[0] === "p" && tag[1]) {
                        participantSet.add(tag[1]);
                    }
                }
            }
        }

        // If no messages yet but we have initial agent pubkeys, include them
        if (threadMessages.length === 0 && initialAgentPubkeys.length > 0) {
            for (const pubkey of initialAgentPubkeys) {
                participantSet.add(pubkey);
            }
        }

        return Array.from(participantSet);
    }, [isThreadMode, threadMessages, currentThreadEvent, initialAgentPubkeys]);

    const messageCount = isThreadMode ? threadMessages.length : statusUpdates.length;

    // Use scroll management hook
    const {
        messagesEndRef,
        messagesContainerRef,
        showNewMessageIndicator,
        handleScroll,
        scrollToBottom,
        setShowNewMessageIndicator,
    } = useScrollManagement(messageCount);

    // Send message
    const handleSendMessage = useCallback(async () => {
        if (!messageInput.trim() || !ndk?.signer || isSending) return;

        // For task mode, require taskId
        if (!isThreadMode && !taskId) return;

        setIsSending(true);
        try {
            let event: NDKEvent;

            // Extract mentions and get clean content
            const { cleanContent, mentionedAgents } = extractMentions(messageInput.trim());

            if (isThreadMode) {
                // Check if we have an existing thread with reply capability
                if (currentThreadEvent && typeof currentThreadEvent.reply === "function") {
                    // This is a reply to an existing thread
                    event = currentThreadEvent.reply();
                    event.content = cleanContent;

                    // Remove all p-tags that NDK's .reply() generated
                    event.tags = event.tags.filter((tag) => tag[0] !== "p");

                    event.tags.push(["a", project?.tagId()]);

                    // Add mentioned agents to the reply (explicit p-tags)
                    for (const agent of mentionedAgents) {
                        event.tags.push(["p", agent.pubkey]);
                    }
                } else if (!kind11Event) {
                    // This is the first message, create a new thread (kind 11)
                    event = new NDKEvent(ndk);
                    event.kind = EVENT_KINDS.CHAT;
                    event.content = cleanContent;
                    event.tags = [
                        ["title", threadTitle!],
                        ["a", project?.tagId()],
                    ];

                    // Add initial agents as p-tags
                    if (initialAgentPubkeys.length > 0) {
                        const projectAgentsMap = new Map(projectAgents.map((a) => [a.pubkey, a]));
                        for (const pubkey of initialAgentPubkeys) {
                            const agent = projectAgentsMap.get(pubkey);
                            if (agent) {
                                event.tags.push(["p", pubkey]);
                            }
                        }
                    }

                    // Add mentioned agents to the initial message
                    for (const agent of mentionedAgents) {
                        // Don't add duplicate p-tags
                        if (!event.tags.some((tag) => tag[0] === "p" && tag[1] === agent.pubkey)) {
                            event.tags.push(["p", agent.pubkey]);
                        }
                    }

                    await event.sign();

                    // Store the kind11Event to start subscription
                    setKind11Event(event);

                    // Publish the event
                    await event.publish();
                    setMessageInput("");

                    // Clean up draft for new thread since it now has a real ID
                    if (conversationId && conversationId.startsWith("new-")) {
                        setMessageDrafts((prev) => {
                            const newDrafts = new Map(prev);
                            newDrafts.delete(conversationId);
                            return newDrafts;
                        });
                    }

                    // Scroll to bottom after creating thread
                    requestAnimationFrame(() => {
                        scrollToBottom(true); // Force scroll after sending
                    });

                    return; // Exit early since we've handled publishing
                } else {
                    // We have a kind11Event but it might not have reply() yet
                    // This shouldn't happen in normal flow, but let's handle it
                    return;
                }
            } else {
                throw new Error("Task mode not implemented yet");
            }

            // Publish the reply event
            await event.publish();
            setMessageInput("");

            // Scroll to bottom after sending
            requestAnimationFrame(() => {
                scrollToBottom(true); // Force scroll after sending
            });
        } catch (_error) {
        } finally {
            setIsSending(false);
        }
    }, [
        messageInput,
        ndk,
        isSending,
        isThreadMode,
        taskId,
        currentThreadEvent,
        kind11Event,
        project,
        threadTitle,
        initialAgentPubkeys,
        projectAgents,
        scrollToBottom,
        extractMentions,
        conversationId,
        setMessageDrafts,
    ]);

    const handleKeyPress = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            // Let mention autocomplete handle key first
            const consumed = handleMentionKeyDown(e);
            if (!consumed && e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        },
        [handleMentionKeyDown, handleSendMessage]
    );

    const handleStatusUpdateClick = useCallback(
        (event: NDKEvent) => {
            // Get the task ID this status update is related to
            const relatedTaskId = event.tags?.find((tag) => tag[0] === "e")?.[1];
            if (relatedTaskId && onReplyToTask) {
                onReplyToTask(relatedTaskId);
            }
        },
        [onReplyToTask]
    );

    return (
        <div className={`bg-background flex flex-col ${className}`}>
            {/* Header for thread mode */}
            {isThreadMode && (
                <ChatHeader
                    title={effectiveThreadTitle}
                    subtitle="Thread discussion"
                    participants={threadParticipants}
                    messages={threadMessages}
                    projectPubkey={project?.pubkey}
                    projectId={projectTagId}
                    projectEvent={project}
                    availableModels={availableLLMConfigs}
                    onBack={onBack}
                />
            )}

            {/* Messages Container */}
            <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto relative"
                id="chat-messages-container"
                onScroll={handleScroll}
            >
                <div className="p-2">
                    {/* Show thread messages if in thread mode, otherwise show status updates */}
                    {isThreadMode ? (
                        threadMessages && threadMessages.length > 0 ? (
                            <MessageList
                                messages={threadMessages}
                                onTaskClick={(task) => setSelectedTask(task)}
                            />
                        ) : threadId && threadId !== "new" && !currentThreadEvent ? (
                            // Loading state for existing thread
                            <div className="text-center py-12">
                                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                                    <Send className="w-6 h-6 text-muted-foreground" />
                                </div>
                                <h3 className="text-lg font-medium text-foreground mb-2">
                                    Loading thread...
                                </h3>
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Send className="w-6 h-6 text-muted-foreground" />
                                </div>
                                <h3 className="text-lg font-medium text-foreground mb-2">
                                    Start the conversation
                                </h3>
                            </div>
                        )
                    ) : statusUpdates.length > 0 ? (
                        <MessageList
                            messages={statusUpdates}
                            onMessageClick={handleStatusUpdateClick}
                            onTaskClick={(task) => setSelectedTask(task)}
                        />
                    ) : (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                                <Send className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-medium text-foreground mb-2">
                                No updates yet
                            </h3>
                            <p className="text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed mb-6">
                                Status updates and conversations will appear here.
                            </p>
                            {taskId && project && (
                                <div className="max-w-sm mx-auto">
                                    <BackendButtons
                                        taskId={taskId}
                                        projectTagId={project.tagId()}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Command Execution Cards */}
                    {(project || threadId) && (
                        <CommandExecutionCard
                            projectId={project?.tagId() || ""}
                            conversationId={threadId || currentThreadEvent?.id}
                        />
                    )}

                    {/* Typing Indicators */}
                    <ChatTypingIndicator
                        activeIndicators={activeTypingIndicators}
                        onDebugClick={(indicator) => {
                            setDebugIndicator(indicator);
                            setShowDebugDialog(true);
                        }}
                    />

                    {/* Scroll anchor - moved inside the content container */}
                    <div ref={messagesEndRef} className="h-1" />
                </div>

                {/* New Message Indicator */}
                {showNewMessageIndicator && (
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                                scrollToBottom(true);
                                setShowNewMessageIndicator(false);
                            }}
                            className="flex items-center gap-2 shadow-lg"
                        >
                            <ArrowDown className="w-4 h-4" />
                            New message
                        </Button>
                    </div>
                )}
            </div>

            {/* Input Area */}
            {allowInput && (isThreadMode || taskId) && (
                <ChatInputArea
                    ref={textareaRef}
                    messageInput={messageInput}
                    isSending={isSending}
                    placeholder={isThreadMode ? "Share your thoughts..." : inputPlaceholder}
                    showAgentMenu={showAgentMenu}
                    filteredAgents={filteredAgents}
                    selectedAgentIndex={selectedAgentIndex}
                    onInputChange={handleInputChange}
                    onKeyDown={handleKeyPress}
                    onSendMessage={handleSendMessage}
                    onSelectAgent={insertMention}
                />
            )}

            {/* Debug Dialog */}
            {showDebugDialog && (
                <ChatDebugDialog
                    indicator={debugIndicator}
                    onClose={() => {
                        setShowDebugDialog(false);
                        setDebugIndicator(null);
                    }}
                />
            )}
        </div>
    );
}

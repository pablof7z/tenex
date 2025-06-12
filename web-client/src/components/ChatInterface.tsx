import {
	NDKEvent,
	type NDKProject,
	useEvent,
	useNDK,
	useSubscribe,
} from "@nostr-dev-kit/ndk-hooks";
import { EVENT_KINDS } from "../../../shared/src/types/events";
import { ArrowDown, ArrowLeft, AtSign, Send, Info, X } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type ProjectAgent, useProjectAgents } from "../hooks/useProjectAgents";
import { BackendButtons } from "./BackendButtons";
import { StatusUpdate } from "./tasks/StatusUpdate";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

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
const MessageList = memo(({ messages, onMessageClick }: { messages: NDKEvent[], onMessageClick?: (event: NDKEvent) => void }) => {
	return (
		<div className="space-y-1">
			{messages.map((event) => (
				<div
					key={event.id}
					onClick={() => onMessageClick?.(event)}
					className={onMessageClick ? "cursor-pointer" : ""}
				>
					<StatusUpdate event={event} />
				</div>
			))}
		</div>
	);
});

MessageList.displayName = 'MessageList';

// Memoized agent mention dropdown
const AgentMentionDropdown = memo(({ 
	agents, 
	selectedIndex, 
	onSelect 
}: { 
	agents: ProjectAgent[], 
	selectedIndex: number, 
	onSelect: (agent: ProjectAgent) => void 
}) => {
	return (
		<div className="absolute bottom-full left-0 mb-1 w-64 max-h-48 overflow-y-auto bg-popover border border-border rounded-md shadow-md z-50">
			<div className="p-1">
				{agents.map((agent, index) => (
					<button
						key={agent.pubkey}
						onClick={() => onSelect(agent)}
						onMouseDown={(e) => e.preventDefault()} // Prevent blur on click
						className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 transition-colors ${
							index === selectedIndex
								? "bg-accent text-accent-foreground"
								: "hover:bg-accent/50"
						}`}
					>
						<AtSign className="w-4 h-4 text-muted-foreground" />
						<span className="font-medium">{agent.name}</span>
					</button>
				))}
			</div>
		</div>
	);
});

AgentMentionDropdown.displayName = 'AgentMentionDropdown';

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
	const [messageInput, setMessageInput] = useState("");
	const [isSending, setIsSending] = useState(false);
	const [kind11Event, setKind11Event] = useState<NDKEvent | null>(null);
	const [showAgentMenu, setShowAgentMenu] = useState(false);
	const [mentionSearch, setMentionSearch] = useState("");
	const [selectedAgentIndex, setSelectedAgentIndex] = useState(0);
	const [isNearBottom, setIsNearBottom] = useState(true);
	const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false);
	const [showDebugDialog, setShowDebugDialog] = useState(false);
	const [debugIndicator, setDebugIndicator] = useState<NDKEvent | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const messagesContainerRef = useRef<HTMLDivElement>(null);

	// Determine if we're in thread mode
	const isThreadMode = !!(project && threadTitle);

	// Get project agents for @mentions
	const projectAgents = useProjectAgents(project?.tagId());

	// Debug logging
	useEffect(() => {
		console.log("ChatInterface - Project agents:", projectAgents);
		console.log("ChatInterface - Project tagId:", project?.tagId());
	}, [projectAgents, project]);

	// Filter agents based on mention search
	const filteredAgents = useMemo(() => {
		if (!mentionSearch) return projectAgents;
		const searchLower = mentionSearch.toLowerCase();
		return projectAgents.filter((agent) =>
			agent.name.toLowerCase().includes(searchLower),
		);
	}, [projectAgents, mentionSearch]);

	// Subscribe to existing thread if we have a threadId (but not for 'new' threads)
	const existingThread = useEvent(
		threadId && threadId !== "new" ? threadId : false,
	);
	console.log({ existingThread });

	// Use existing thread or the kind11Event for new threads
	const currentThreadEvent = existingThread || kind11Event;

	// Get thread title from the thread event if we don't have it from props
	const effectiveThreadTitle = useMemo(() => {
		if (threadTitle) return threadTitle;
		if (currentThreadEvent) {
			const titleTag = currentThreadEvent.tags?.find(
				(tag: string[]) => tag[0] === "title",
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
		currentThreadEvent && typeof currentThreadEvent.nip22Filter === 'function'
			? [{ kinds: [1111], ...currentThreadEvent.nip22Filter() }]
			: false,
		{},
		[currentThreadEvent?.id],
	);

	// Subscribe to typing indicators when we have a thread or task
	const { events: typingIndicatorEvents } = useSubscribe(
		currentThreadEvent || taskId
			? [{
					kinds: [EVENT_KINDS.TYPING_INDICATOR as any, EVENT_KINDS.TYPING_INDICATOR_STOP as any], // Both start and stop events
					"#e": currentThreadEvent ? [currentThreadEvent.id] : taskId ? [taskId] : [],
					since: Math.floor(Date.now() / 1000) - 60, // Only show indicators from last minute
				}]
			: false,
		{},
		[currentThreadEvent?.id, taskId],
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

		// Filter out indicators older than 30 seconds (safety net in case stop event was missed)
		const thirtySecondsAgo = Math.floor(Date.now() / 1000) - 30;
		const active = Array.from(indicatorsByPubkey.values()).filter(
			event => (event.created_at ?? 0) > thirtySecondsAgo && event.kind === EVENT_KINDS.TYPING_INDICATOR
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

		// Sort by created_at timestamp
		return messages.sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0));
	}, [currentThreadEvent, threadReplies]);

	// Check if user is at the very bottom of scroll
	const checkIfNearBottom = useCallback(() => {
		const container = messagesContainerRef.current;
		if (!container) return true;
		
		// Consider "at bottom" if within 5px of the bottom (to account for rounding)
		const threshold = 5;
		const isNear = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
		return isNear;
	}, []);

	// Handle scroll events
	const handleScroll = useCallback(() => {
		const nearBottom = checkIfNearBottom();
		setIsNearBottom(nearBottom);
		
		// Hide new message indicator if user scrolls to bottom
		if (nearBottom && showNewMessageIndicator) {
			setShowNewMessageIndicator(false);
		}
	}, [checkIfNearBottom, showNewMessageIndicator]);

	// Auto-scroll to bottom when new messages arrive
	const scrollToBottom = useCallback((force = false) => {
		// Only scroll if user is near bottom or if forced
		if (!force && !isNearBottom) return;
		
		// Try multiple methods to ensure scrolling works in all contexts
		if (messagesEndRef.current) {
			// Method 1: scrollIntoView on the anchor element
			messagesEndRef.current.scrollIntoView({
				behavior: "smooth",
				block: "end",
			});
		}
		
		// Method 2: Also try to scroll the container itself
		const container = messagesContainerRef.current;
		if (container) {
			container.scrollTop = container.scrollHeight;
		}
	}, [isNearBottom]);

	// Track previous message count to detect new messages
	const prevMessageCountRef = useRef(0);
	
	useEffect(() => {
		const messageCount = isThreadMode ? threadMessages.length : statusUpdates.length;
		
		// Only handle if we have new messages
		if (messageCount > prevMessageCountRef.current) {
			// Check if user is near bottom before new messages
			const nearBottom = checkIfNearBottom();
			
			// Small delay to ensure DOM is updated
			const timer = setTimeout(() => {
				if (nearBottom) {
					// User was near bottom, auto-scroll
					scrollToBottom(true);
				} else {
					// User was scrolled up, show indicator
					setShowNewMessageIndicator(true);
				}
			}, 100);
			prevMessageCountRef.current = messageCount;
			return () => clearTimeout(timer);
		}
	}, [isThreadMode, threadMessages.length, statusUpdates.length, scrollToBottom, checkIfNearBottom]);
	
	// Also scroll on initial load when messages first appear
	useEffect(() => {
		if (isThreadMode && threadMessages.length > 0) {
			// Delay to ensure the Sheet animation has completed
			const timer = setTimeout(() => {
				scrollToBottom(true); // Force scroll on initial load
			}, 300);
			return () => clearTimeout(timer);
		}
	}, [isThreadMode, threadMessages.length > 0, scrollToBottom]);

	// Extract mentions from message and add p-tags
	const extractMentions = (
		content: string,
	): { cleanContent: string; mentionedAgents: ProjectAgent[] } => {
		const mentionRegex = /@(\w+)/g;
		const mentionedAgents: ProjectAgent[] = [];
		const cleanContent = content;

		// Find all @mentions in the content
		const matches = content.matchAll(mentionRegex);
		for (const match of matches) {
			const mentionName = match[1];
			const agent = projectAgents.find(
				(a) => a.name.toLowerCase() === mentionName.toLowerCase(),
			);
			if (agent && !mentionedAgents.some((a) => a.pubkey === agent.pubkey)) {
				mentionedAgents.push(agent);
			}
		}

		return { cleanContent, mentionedAgents };
	};

	// Send message
	const handleSendMessage = async () => {
		if (!messageInput.trim() || !ndk?.signer || isSending) return;

		// For task mode, require taskId
		if (!isThreadMode && !taskId) return;

		setIsSending(true);
		try {
			let event: NDKEvent;

			// Extract mentions and get clean content
			const { cleanContent, mentionedAgents } = extractMentions(
				messageInput.trim(),
			);

			if (isThreadMode) {
				// Check if we have an existing thread with reply capability
				if (currentThreadEvent && typeof currentThreadEvent.reply === 'function') {
					// This is a reply to an existing thread
					event = currentThreadEvent.reply();
					event.content = cleanContent;
					event.tags.push(["a", project?.tagId()]);
					
					// Add mentioned agents to the reply
					mentionedAgents.forEach((agent) => {
						event.tags.push(["p", agent.pubkey]);
					});
				} else if (!kind11Event) {
					// This is the first message, create a new thread (kind 11)
					event = new NDKEvent(ndk);
					event.kind = 11;
					event.content = cleanContent;
					event.tags = [
						["title", threadTitle!],
						["a", project?.tagId()],
					];

					// Add initial agents as p-tags
					if (initialAgentPubkeys.length > 0) {
						const projectAgentsMap = new Map(
							projectAgents.map((a) => [a.pubkey, a]),
						);
						initialAgentPubkeys.forEach((pubkey) => {
							const agent = projectAgentsMap.get(pubkey);
							if (agent) {
								event.tags.push(["p", pubkey]);
							}
						});
					}
					
					// Add mentioned agents to the initial message
					mentionedAgents.forEach((agent) => {
						// Don't add duplicate p-tags
						if (!event.tags.some(tag => tag[0] === "p" && tag[1] === agent.pubkey)) {
							event.tags.push(["p", agent.pubkey]);
						}
					});

					await event.sign();

					// Store the kind11Event to start subscription
					setKind11Event(event);
					
					// Publish the event
					await event.publish();
					setMessageInput("");
					
					// Scroll to bottom after creating thread
					setTimeout(() => {
						scrollToBottom(true); // Force scroll after sending
					}, 100);
					
					return; // Exit early since we've handled publishing
				} else {
					// We have a kind11Event but it might not have reply() yet
					// This shouldn't happen in normal flow, but let's handle it
					console.warn("Thread event exists but doesn't support reply(). Waiting for thread to be properly loaded.");
					return;
				}
			} else {
				throw new Error("Task mode not implemented yet");
			}

			// Publish the reply event
			await event.publish();
			setMessageInput("");
			
			// Scroll to bottom after sending
			setTimeout(() => {
				scrollToBottom(true); // Force scroll after sending
			}, 100);
		} catch (error) {
			console.error("Failed to send message:", error);
		} finally {
			setIsSending(false);
		}
	};

	// Handle @mention autocomplete
	const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const value = e.target.value;
		setMessageInput(value);

		// Check for @ symbol
		const cursorPosition = e.target.selectionStart;
		const textBeforeCursor = value.slice(0, cursorPosition);
		const lastAtIndex = textBeforeCursor.lastIndexOf("@");

		if (lastAtIndex !== -1 && lastAtIndex === textBeforeCursor.length - 1) {
			// Just typed @
			setShowAgentMenu(true);
			setMentionSearch("");
			setSelectedAgentIndex(0);
		} else if (
			lastAtIndex !== -1 &&
			textBeforeCursor.substring(lastAtIndex + 1).match(/^\w+$/)
		) {
			// Typing after @
			const search = textBeforeCursor.substring(lastAtIndex + 1);
			setMentionSearch(search);
			setShowAgentMenu(true);
			setSelectedAgentIndex(0);
		} else {
			setShowAgentMenu(false);
		}
	}, []);

	// Insert agent mention
	const insertMention = useCallback(
		(agent: ProjectAgent) => {
			if (!textareaRef.current) return;

			const textarea = textareaRef.current;
			const cursorPosition = textarea.selectionStart;
			const textBeforeCursor = messageInput.slice(0, cursorPosition);
			const lastAtIndex = textBeforeCursor.lastIndexOf("@");

			if (lastAtIndex !== -1) {
				const beforeMention = messageInput.slice(0, lastAtIndex);
				const afterCursor = messageInput.slice(cursorPosition);
				const newValue = `${beforeMention}@${agent.name} ${afterCursor}`;
				setMessageInput(newValue);

				// Set cursor position after the mention
				setTimeout(() => {
					const newCursorPos = lastAtIndex + agent.name.length + 2;
					textarea.setSelectionRange(newCursorPos, newCursorPos);
					textarea.focus();
				}, 0);
			}

			setShowAgentMenu(false);
			setMentionSearch("");
		},
		[messageInput],
	);

	const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (showAgentMenu && filteredAgents.length > 0) {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setSelectedAgentIndex((prev) =>
					prev < filteredAgents.length - 1 ? prev + 1 : prev,
				);
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setSelectedAgentIndex((prev) => (prev > 0 ? prev - 1 : prev));
			} else if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				if (filteredAgents[selectedAgentIndex]) {
					insertMention(filteredAgents[selectedAgentIndex]);
				}
			} else if (e.key === "Escape") {
				e.preventDefault();
				setShowAgentMenu(false);
			}
		} else if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
	}, [showAgentMenu, filteredAgents, selectedAgentIndex, insertMention, handleSendMessage]);

	const handleStatusUpdateClick = useCallback((event: NDKEvent) => {
		// Get the task ID this status update is related to
		const relatedTaskId = event.tags?.find((tag) => tag[0] === "e")?.[1];
		if (relatedTaskId && onReplyToTask) {
			onReplyToTask(relatedTaskId);
		}
	}, [onReplyToTask]);

	return (
		<div className={`bg-background flex flex-col ${className}`}>
			{/* Header for thread mode */}
			{isThreadMode && onBack && (
				<div className="bg-card border-b border-border/60 backdrop-blur-xl bg-card/95 sticky top-0 z-50">
					<div className="flex items-center justify-between px-3 sm:px-4 py-3 sm:py-4">
						<div className="flex items-center gap-2 sm:gap-3">
							<Button
								variant="ghost"
								size="icon"
								onClick={onBack}
								className="w-8 h-8 sm:w-9 sm:h-9 hover:bg-accent"
							>
								<ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
							</Button>
							<div>
								<h1 className="text-lg sm:text-xl font-semibold text-foreground truncate max-w-48">
									{effectiveThreadTitle}
								</h1>
								<p className="text-xs text-muted-foreground mt-0.5">
									Thread discussion
								</p>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Messages Container */}
			<div 
				ref={messagesContainerRef}
				className="flex-1 overflow-y-auto relative" 
				id="chat-messages-container"
				onScroll={handleScroll}>
				<div className="p-2">
					{/* Show thread messages if in thread mode, otherwise show status updates */}
					{isThreadMode ? (
						threadMessages && threadMessages.length > 0 ? (
							<MessageList messages={threadMessages} />
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
						<MessageList messages={statusUpdates} onMessageClick={handleStatusUpdateClick} />
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
					
					{/* Typing Indicators */}
					{activeTypingIndicators.length > 0 && (
						<div className="px-4 py-2 space-y-1">
							{activeTypingIndicators.map((indicator) => {
								// Extract system prompt and prompt from tags
								const systemPromptTag = indicator.tags.find(tag => tag[0] === 'system-prompt');
								const promptTag = indicator.tags.find(tag => tag[0] === 'prompt');
								const hasDebugInfo = systemPromptTag || promptTag;
								
								return (
									<div
										key={indicator.id}
										className="flex items-center gap-2 text-sm text-muted-foreground"
									>
										<div className="flex gap-0.5">
											<span className="w-1.5 h-1.5 bg-muted-foreground/70 rounded-full animate-typing-bounce" style={{ animationDelay: "0ms" }} />
											<span className="w-1.5 h-1.5 bg-muted-foreground/70 rounded-full animate-typing-bounce" style={{ animationDelay: "200ms" }} />
											<span className="w-1.5 h-1.5 bg-muted-foreground/70 rounded-full animate-typing-bounce" style={{ animationDelay: "400ms" }} />
										</div>
										<span className="italic">{indicator.content}</span>
										{hasDebugInfo && (
											<Button
												variant="ghost"
												size="sm"
												className="h-5 w-5 p-0 hover:bg-muted"
												onClick={() => {
													setDebugIndicator(indicator);
													setShowDebugDialog(true);
												}}
											>
												<Info className="h-3 w-3" />
											</Button>
										)}
									</div>
								);
							})}
						</div>
					)}
					
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
				<div className="border-t border-border bg-card p-3 sm:p-4">
					<div className="flex gap-2 items-end">
						<div className="flex-1 relative">
							<Textarea
								ref={textareaRef}
								value={messageInput}
								onChange={handleInputChange}
								onKeyDown={handleKeyPress}
								placeholder={
									isThreadMode ? "Share your thoughts..." : inputPlaceholder
								}
								className="resize-none min-h-[40px] max-h-[120px] text-sm"
								rows={1}
								disabled={isSending}
							/>

							{/* Agent mention dropdown */}
							{showAgentMenu && filteredAgents.length > 0 && (
								<AgentMentionDropdown 
									agents={filteredAgents}
									selectedIndex={selectedAgentIndex}
									onSelect={insertMention}
								/>
							)}
						</div>
						<Button
							onClick={handleSendMessage}
							disabled={!messageInput.trim() || isSending}
							size="sm"
							className="px-3 py-2 h-10"
						>
							{isSending ? (
								<div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
							) : (
								<Send className="w-4 h-4" />
							)}
						</Button>
					</div>
				</div>
			)}

			{/* Debug Dialog */}
			{showDebugDialog && debugIndicator && (
				<div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
					<div className="bg-background border rounded-lg shadow-lg max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
						<div className="flex items-center justify-between p-4 border-b">
							<h3 className="text-lg font-semibold">LLM Debug Information</h3>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => {
									setShowDebugDialog(false);
									setDebugIndicator(null);
								}}
								className="h-8 w-8 p-0"
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
						<div className="flex-1 overflow-auto p-4 space-y-4">
							{/* System Prompt */}
							{debugIndicator.tags.find(tag => tag[0] === 'system-prompt') && (
								<div>
									<h4 className="font-semibold mb-2">System Prompt</h4>
									<pre className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap overflow-x-auto">
										{debugIndicator.tags.find(tag => tag[0] === 'system-prompt')?.[1]}
									</pre>
								</div>
							)}
							
							{/* User Prompt */}
							{debugIndicator.tags.find(tag => tag[0] === 'prompt') && (
								<div>
									<h4 className="font-semibold mb-2">User Prompt</h4>
									<pre className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap overflow-x-auto">
										{debugIndicator.tags.find(tag => tag[0] === 'prompt')?.[1]}
									</pre>
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

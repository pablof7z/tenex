import {
	NDKEvent,
	type NDKProject,
	useEvent,
	useNDK,
	useSubscribe,
} from "@nostr-dev-kit/ndk-hooks";
import { ArrowLeft, AtSign, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

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
		return projectAgents.filter((agent) =>
			agent.name.toLowerCase().includes(mentionSearch.toLowerCase()),
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
			return firstLine.length > 50 ? firstLine.slice(0, 50) + "..." : firstLine;
		}
		return "Thread";
	}, [threadTitle, currentThreadEvent]);

	// Subscribe to thread messages when currentThreadEvent is available
	const { events: threadReplies } = useSubscribe(
		currentThreadEvent
			? [{ kinds: [1111], ...currentThreadEvent.nip22Filter() }]
			: false,
		{},
		[currentThreadEvent?.id],
	);

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

	// Auto-scroll to bottom when new messages arrive
	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({
			behavior: "smooth",
			block: "nearest",
		});
	};

	useEffect(() => {
		// Small delay to ensure DOM is updated
		const timer = setTimeout(() => {
			scrollToBottom();
		}, 100);
		return () => clearTimeout(timer);
	}, [statusUpdates, threadMessages, threadReplies]);

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
				if (threadId && threadId !== "new" && currentThreadEvent) {
					event = currentThreadEvent.reply();
					event.content = cleanContent;
					event.tags.push(["a", project!.tagId()]);
				} else {
					// Create new thread event (kind 11) for the first message
					event = new NDKEvent(ndk);
					event.kind = 11;
					event.content = cleanContent;
					event.tags = [
						["title", threadTitle!],
						["a", project!.tagId()],
					];

					// Add initial agents as p-tags if this is the first message
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

					await event.sign();

					// Store the kind11Event to start subscription
					if (!kind11Event) {
						setKind11Event(event);
					}
				}
			} else {
				throw new Error("Task mode not implemented yet");
			}

			// Add p-tags for mentioned agents
			mentionedAgents.forEach((agent) => {
				event.tags.push(["p", agent.pubkey]);
			});

			event.publish();
			setMessageInput("");
		} catch (error) {
			console.error("Failed to send message:", error);
		} finally {
			setIsSending(false);
		}
	};

	// Handle @mention autocomplete
	const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
	};

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

	const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
	};

	const handleStatusUpdateClick = (event: NDKEvent) => {
		// Get the task ID this status update is related to
		const relatedTaskId = event.tags?.find((tag) => tag[0] === "e")?.[1];
		if (relatedTaskId && onReplyToTask) {
			onReplyToTask(relatedTaskId);
		}
	};

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
			<div className="flex-1 overflow-y-auto">
				<div className="p-2">
					{/* Show thread messages if in thread mode, otherwise show status updates */}
					{isThreadMode ? (
						threadMessages && threadMessages.length > 0 ? (
							<div className="space-y-1">
								{threadMessages.map((event) => (
									<div key={event.id}>
										<StatusUpdate event={event} />
									</div>
								))}
							</div>
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
						<div className="space-y-1">
							{statusUpdates.map((event) => (
								<div
									key={event.id}
									onClick={() => handleStatusUpdateClick(event)}
									className={onReplyToTask ? "cursor-pointer" : ""}
								>
									<StatusUpdate event={event} />
								</div>
							))}
						</div>
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
				</div>

				{/* Scroll anchor */}
				<div ref={messagesEndRef} />
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
								<div className="absolute bottom-full left-0 mb-1 w-64 max-h-48 overflow-y-auto bg-popover border border-border rounded-md shadow-md z-50">
									<div className="p-1">
										{filteredAgents.map((agent, index) => (
											<button
												key={agent.pubkey}
												onClick={() => insertMention(agent)}
												onMouseDown={(e) => e.preventDefault()} // Prevent blur on click
												className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 transition-colors ${
													index === selectedAgentIndex
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
		</div>
	);
}

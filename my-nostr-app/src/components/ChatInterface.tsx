import {
	NDKEvent,
	type NDKProject,
	useNDK,
	useSubscribe,
} from "@nostr-dev-kit/ndk-hooks";
import { ArrowLeft, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BackendButtons } from "./BackendButtons";
import { StatusUpdate } from "./StatusUpdate";
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
	onBack,
}: ChatInterfaceProps) {
	const { ndk } = useNDK();
	const [messageInput, setMessageInput] = useState("");
	const [isSending, setIsSending] = useState(false);
	const [kind11Event, setKind11Event] = useState<NDKEvent | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Determine if we're in thread mode
	const isThreadMode = !!(project && threadTitle);

	// Subscribe to existing thread if we have a threadId
	const { events: existingThread } = useSubscribe(
		threadId ? [{ ids: [threadId] }] : false,
		{},
		[threadId],
	);

	// Use existing thread or the kind11Event for new threads
	const currentThreadEvent =
		threadId && existingThread.length > 0 ? existingThread[0] : kind11Event;

	// Subscribe to thread messages when currentThreadEvent is available
	const { events: threadMessages } = useSubscribe(
		currentThreadEvent
			? [
					{ ids: [currentThreadEvent.id] },
					{ kinds: [1111], ...currentThreadEvent.filter() },
				]
			: false,
		{},
		[currentThreadEvent?.id],
	);

	// Auto-scroll to bottom when new messages arrive
	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	useEffect(() => {
		scrollToBottom();
	}, [statusUpdates, threadMessages]);

	// Send message
	const handleSendMessage = async () => {
		if (!messageInput.trim() || !ndk?.signer || isSending) return;

		// For task mode, require taskId
		if (!isThreadMode && !taskId) return;

		setIsSending(true);
		try {
			let event: NDKEvent;

			if (isThreadMode) {
				if (threadId && currentThreadEvent) {
					event = currentThreadEvent.reply();
					event.content = messageInput.trim();
					event.tags.push(["a", project!.tagId()]);
				} else {
					// Create new thread event (kind 11) for the first message
					event = new NDKEvent(ndk);
					event.kind = 11;
					event.content = messageInput.trim();
					event.tags = [
						["title", threadTitle!],
						["a", project!.tagId()],
					];

					await event.sign();

					// Store the kind11Event to start subscription
					if (!kind11Event) {
						setKind11Event(event);
					}
				}
			} else {
				throw new Error("Task mode not implemented yet");
			}

			event.publish();
			setMessageInput("");
		} catch (error) {
			console.error("Failed to send message:", error);
		} finally {
			setIsSending(false);
		}
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
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
		<div className={`min-h-screen bg-slate-50 flex flex-col ${className}`}>
			{/* Header for thread mode */}
			{isThreadMode && onBack && (
				<div className="bg-white border-b border-slate-200/60 backdrop-blur-xl bg-white/95 sticky top-0 z-50">
					<div className="flex items-center justify-between px-3 sm:px-4 py-3 sm:py-4">
						<div className="flex items-center gap-2 sm:gap-3">
							<Button
								variant="ghost"
								size="icon"
								onClick={onBack}
								className="w-8 h-8 sm:w-9 sm:h-9 text-slate-700 hover:bg-slate-100"
							>
								<ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
							</Button>
							<div>
								<h1 className="text-lg sm:text-xl font-semibold text-slate-900 truncate max-w-48">
									{threadTitle}
								</h1>
								<p className="text-xs text-slate-500 mt-0.5">
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
						) : (
							<div className="text-center py-12">
								<div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
									<Send className="w-6 h-6 text-slate-400" />
								</div>
								<h3 className="text-lg font-medium text-slate-900 mb-2">
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
							<div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
								<Send className="w-6 h-6 text-slate-400" />
							</div>
							<h3 className="text-lg font-medium text-slate-900 mb-2">
								No updates yet
							</h3>
							<p className="text-slate-600 text-sm max-w-sm mx-auto leading-relaxed mb-6">
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
				<div className="border-t border-slate-200 bg-white p-3 sm:p-4">
					<div className="flex gap-2 items-end">
						<div className="flex-1">
							<Textarea
								value={messageInput}
								onChange={(e) => setMessageInput(e.target.value)}
								onKeyDown={handleKeyPress}
								placeholder={
									isThreadMode ? "Share your thoughts..." : inputPlaceholder
								}
								className="resize-none min-h-[40px] max-h-[120px] text-sm border-slate-300 focus:ring-blue-500 focus:border-blue-500"
								rows={1}
								disabled={isSending}
							/>
						</div>
						<Button
							onClick={handleSendMessage}
							disabled={!messageInput.trim() || isSending}
							size="sm"
							className="bg-blue-600 hover:bg-blue-700 px-3 py-2 h-10"
						>
							{isSending ? (
								<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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

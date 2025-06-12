import {
	type NDKArticle,
	type NDKEvent,
	type NDKProject,
	NDKTask,
	useSubscribe,
} from "@nostr-dev-kit/ndk-hooks";
import {
	Archive,
	ArrowLeft,
	BookOpen,
	Edit3,
	MoreVertical,
	Plus,
	Trash2,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { ProjectAgent } from "../../hooks/useProjectAgents";
import { CreateTaskDialog } from "../dialogs/CreateTaskDialog";
import { TaskCreationOptionsDialog } from "../dialogs/TaskCreationOptionsDialog";
import { ThreadDialog } from "../dialogs/ThreadDialog";
import { VoiceTaskDialog } from "../dialogs/VoiceTaskDialog";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

interface ProjectDetailProps {
	project: NDKProject;
	onBack: () => void;
	onTaskSelect: (project: NDKProject, taskId: string) => void;
	onEditProject: (project: NDKProject) => void;
	onThreadStart: (
		project: NDKProject,
		threadTitle: string,
		selectedAgents: ProjectAgent[],
	) => void;
	onThreadSelect?: (
		project: NDKProject,
		threadId: string,
		threadTitle: string,
	) => void;
	onArticleSelect?: (project: NDKProject, article: NDKArticle) => void;
}

export function ProjectDetail({
	project,
	onBack,
	onTaskSelect,
	onEditProject,
	onThreadStart,
	onThreadSelect,
}: ProjectDetailProps) {
	const [showOptionsDialog, setShowOptionsDialog] = useState(false);
	const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
	const [showVoiceTaskDialog, setShowVoiceTaskDialog] = useState(false);
	const [showThreadDialog, setShowThreadDialog] = useState(false);
	const [activeTab, setActiveTab] = useState<"tasks" | "threads" | "docs">("tasks");
	const [deletedTaskIds, setDeletedTaskIds] = useState<Set<string>>(new Set());

	const { events: allTasks } = useSubscribe<NDKTask>(
		project
			? [
					{
						kinds: [NDKTask.kind],
						...project.filter(),
						limit: 100,
					},
				]
			: false,
		{ wrap: true },
		[project?.tagId()],
	);

	// Filter out deleted tasks
	const tasks = useMemo(() => {
		return allTasks.filter((task) => !deletedTaskIds.has(task.id));
	}, [allTasks, deletedTaskIds]);

	// Subscribe to threads (kind 11) for this project
	const { events: threads } = useSubscribe(
		project
			? [
					{
						kinds: [11],
						...project.filter(),
						limit: 50,
					},
				]
			: false,
		{},
		[project?.tagId()],
	);

	// Subscribe to documentation articles (kind 30023) for this project
	const { events: articles } = useSubscribe<NDKArticle>(
		project
			? [
					{
						kinds: [30023],
						...project.filter(),
						limit: 50,
					},
				]
			: false,
		{ wrap: true },
		[project?.tagId()],
	);

	// Subscribe to thread replies (kind 1111) for all threads
	const { events: threadReplies } = useSubscribe(
		threads.length > 0
			? [
					{
						kinds: [1111],
						"#e": threads.map((t) => t.id),
					},
				]
			: false,
		{},
		[threads.length],
	);

	// Get status updates for all tasks (kind 1 events with 'e' tag referencing any task)
	const { events: statusUpdates } = useSubscribe(
		allTasks.length > 0
			? [
					{
						kinds: [1],
						"#e": allTasks.map((t) => t.id),
					},
				]
			: false,
		{},
		[allTasks.length],
	);

	// Track unread status updates per task
	const taskUnreadMap = useMemo(() => {
		const unreadMap = new Map<string, number>();
		const seenUpdates = JSON.parse(
			localStorage.getItem("seenStatusUpdates") || "{}",
		);

		statusUpdates.forEach((update) => {
			const taskId = update.tags?.find(
				(tag) => tag[0] === "e" && tag[3] === "task",
			)?.[1];
			if (taskId && !seenUpdates[update.id]) {
				const currentUnread = unreadMap.get(taskId) || 0;
				unreadMap.set(taskId, currentUnread + 1);
			}
		});

		return unreadMap;
	}, [statusUpdates]);

	// Track unread thread replies per thread
	const threadUnreadMap = useMemo(() => {
		const unreadMap = new Map<string, number>();
		const seenThreadReplies = JSON.parse(
			localStorage.getItem("seenThreadReplies") || "{}",
		);

		threadReplies.forEach((reply) => {
			const threadId = reply.tags?.find((tag) => tag[0] === "e")?.[1];
			if (threadId && !seenThreadReplies[reply.id]) {
				const currentUnread = unreadMap.get(threadId) || 0;
				unreadMap.set(threadId, currentUnread + 1);
			}
		});

		return unreadMap;
	}, [threadReplies]);

	// Get recent message for each thread
	const threadRecentMessages = useMemo(() => {
		const recentMap = new Map<string, { content: string; timestamp: number }>();

		threadReplies.forEach((reply) => {
			const threadId = reply.tags?.find((tag) => tag[0] === "e")?.[1];
			if (threadId && reply.created_at) {
				const existing = recentMap.get(threadId);
				if (!existing || reply.created_at > existing.timestamp) {
					recentMap.set(threadId, {
						content: reply.content || "",
						timestamp: reply.created_at,
					});
				}
			}
		});

		return recentMap;
	}, [threadReplies]);

	const formatTime = (timestamp: number) => {
		const date = new Date(timestamp * 1000);
		const now = new Date();
		const diffHours = Math.abs(now.getTime() - date.getTime()) / 36e5;

		if (diffHours < 24) {
			return date.toLocaleTimeString("en-US", {
				hour: "2-digit",
				minute: "2-digit",
				hour12: false,
			});
		}
		if (diffHours < 24 * 7) {
			return date.toLocaleDateString("en-US", { weekday: "short" });
		}
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		});
	};

	const getTaskTitle = (task: NDKTask) => {
		// Try to get title from tags first, fallback to content
		const titleTag = task.tags?.find((tag) => tag[0] === "title")?.[1];
		if (titleTag) return titleTag;

		// Fallback to first line of content
		const firstLine = task.content?.split("\n")[0] || "Untitled Task";
		return firstLine.length > 50 ? `${firstLine.slice(0, 50)}...` : firstLine;
	};

	const getTaskDescription = (task: NDKTask) => {
		// Get description from content, skipping the first line if it's the title
		const lines = task.content?.split("\n") || [];
		const titleTag = task.tags?.find((tag) => tag[0] === "title")?.[1];

		if (titleTag && lines.length > 1) {
			return `${lines.slice(1).join(" ").slice(0, 80)}...`;
		}
		if (lines.length > 1) {
			return `${lines.slice(1).join(" ").slice(0, 80)}...`;
		}

		return "No description";
	};

	const markTaskStatusUpdatesSeen = (taskId: string) => {
		const seenUpdates = JSON.parse(
			localStorage.getItem("seenStatusUpdates") || "{}",
		);
		const taskStatusUpdates = statusUpdates.filter((update) => {
			const updateTaskId = update.tags?.find(
				(tag) => tag[0] === "e" && tag[3] === "task",
			)?.[1];
			return updateTaskId === taskId;
		});

		taskStatusUpdates.forEach((update) => {
			seenUpdates[update.id] = true;
		});

		localStorage.setItem("seenStatusUpdates", JSON.stringify(seenUpdates));
	};

	const markThreadRepliesSeen = (threadId: string) => {
		const seenThreadReplies = JSON.parse(
			localStorage.getItem("seenThreadReplies") || "{}",
		);
		const threadRepliesForThread = threadReplies.filter((reply) => {
			const replyThreadId = reply.tags?.find((tag) => tag[0] === "e")?.[1];
			return replyThreadId === threadId;
		});

		threadRepliesForThread.forEach((reply) => {
			seenThreadReplies[reply.id] = true;
		});

		localStorage.setItem(
			"seenThreadReplies",
			JSON.stringify(seenThreadReplies),
		);
	};

	const getThreadTitle = (thread: NDKEvent) => {
		const titleTag = thread.tags?.find(
			(tag: string[]) => tag[0] === "title",
		)?.[1];
		if (titleTag) return titleTag;

		const firstLine = thread.content?.split("\n")[0] || "Untitled Thread";
		return firstLine.length > 50 ? `${firstLine.slice(0, 50)}...` : firstLine;
	};

	const handleOptionSelect = (option: "task" | "voice" | "thread") => {
		switch (option) {
			case "task":
				setShowCreateTaskDialog(true);
				break;
			case "voice": {
				const openaiApiKey = localStorage.getItem("openaiApiKey");
				if (!openaiApiKey) {
					alert(
						"Please set your OpenAI API key in settings first before using voice recording.",
					);
					return;
				}
				setShowVoiceTaskDialog(true);
				break;
			}
			case "thread":
				setShowThreadDialog(true);
				break;
		}
	};

	// Thread Item Component
	const ThreadItem = ({
		thread,
		onThreadClick,
	}: { thread: NDKEvent; onThreadClick: () => void }) => {
		const unreadCount = threadUnreadMap.get(thread.id) || 0;
		const recentMessage = threadRecentMessages.get(thread.id);

		return (
			<div className="overflow-hidden rounded-lg sm:rounded-xl mx-0.5 sm:mx-1 bg-card border border-border">
				<div
					className="group flex items-center p-2.5 sm:p-3 cursor-pointer transition-all duration-200 ease-out border border-transparent bg-card hover:bg-accent hover:shadow-sm active:scale-[0.98]"
					onClick={onThreadClick}
				>
					{/* Thread Icon */}
					<div className="mr-3 sm:mr-4 flex-shrink-0">
						<div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
							<div className="w-2 h-2 bg-blue-500 rounded-full" />
						</div>
					</div>

					{/* Content */}
					<div className="flex-1 min-w-0">
						<div className="flex items-start justify-between mb-0.5 sm:mb-1">
							<div className="flex-1 min-w-0">
								<h3 className="font-semibold text-foreground truncate text-sm sm:text-[15px] leading-tight">
									{getThreadTitle(thread)}
								</h3>
								<div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1">
									<span className="text-xs text-muted-foreground hidden sm:inline">
										{formatTime(thread.created_at!)}
									</span>
								</div>
							</div>
							<div className="flex items-center gap-1.5">
								{unreadCount > 0 && (
									<Badge
										variant="destructive"
										className="h-5 px-1.5 text-xs font-medium"
									>
										{unreadCount}
									</Badge>
								)}
							</div>
						</div>
						{recentMessage && (
							<p className="text-xs sm:text-sm text-muted-foreground truncate leading-relaxed">
								{recentMessage.content.length > 80
									? `${recentMessage.content.slice(0, 80)}...`
									: recentMessage.content}
							</p>
						)}
					</div>
				</div>
			</div>
		);
	};

	// Swipe Task Item Component
	const SwipeTaskItem = ({
		task,
		onTaskClick,
	}: { task: NDKTask; onTaskClick: () => void }) => {
		const [swipeOffset, setSwipeOffset] = useState(0);
		const [isActionTriggered, setIsActionTriggered] = useState(false);
		const containerRef = useRef<HTMLDivElement>(null);
		const startX = useRef(0);
		const currentX = useRef(0);
		const isDragging = useRef(false);

		const unreadCount = taskUnreadMap.get(task.id) || 0;

		const handleTouchStart = (e: React.TouchEvent) => {
			startX.current = e.touches[0].clientX;
			currentX.current = e.touches[0].clientX;
			isDragging.current = true;
			setIsActionTriggered(false);
		};

		const handleTouchMove = (e: React.TouchEvent) => {
			if (!isDragging.current) return;

			currentX.current = e.touches[0].clientX;
			const deltaX = currentX.current - startX.current;

			// Only allow left swipe (positive deltaX)
			if (deltaX > 0) {
				const clampedOffset = Math.min(deltaX, 180); // Max swipe distance
				setSwipeOffset(clampedOffset);

				// Trigger haptic feedback at different thresholds
				if (clampedOffset >= 60 && !isActionTriggered) {
					setIsActionTriggered(true);
					// Add haptic feedback if available
					if (navigator.vibrate) {
						navigator.vibrate(10);
					}
				} else if (clampedOffset < 60 && isActionTriggered) {
					setIsActionTriggered(false);
				}

				// Additional feedback at higher thresholds
				if (clampedOffset >= 120 && navigator.vibrate) {
					navigator.vibrate(5);
				}
			}
		};

		const handleTouchEnd = () => {
			isDragging.current = false;

			if (swipeOffset >= 140) {
				handleSwipeAction("more");
			} else if (swipeOffset >= 100) {
				handleSwipeAction("archive");
			} else if (swipeOffset >= 60) {
				handleSwipeAction("delete");
			}

			// Reset swipe
			setSwipeOffset(0);
			setIsActionTriggered(false);
		};

		const handleSwipeAction = (action: "delete" | "archive" | "more") => {
			switch (action) {
				case "delete":
					task.delete();
					setDeletedTaskIds((prev) => new Set([...prev, task.id]));
					break;
				case "archive":
					alert(`Archive task: ${getTaskTitle(task)}`);
					break;
				case "more":
					alert(`More options for: ${getTaskTitle(task)}`);
					break;
			}
		};

		const handleMouseDown = (e: React.MouseEvent) => {
			startX.current = e.clientX;
			currentX.current = e.clientX;
			isDragging.current = true;
			setIsActionTriggered(false);

			const handleMouseMove = (e: MouseEvent) => {
				if (!isDragging.current) return;

				currentX.current = e.clientX;
				const deltaX = currentX.current - startX.current;

				if (deltaX > 0) {
					const clampedOffset = Math.min(deltaX, 180);
					setSwipeOffset(clampedOffset);

					if (clampedOffset >= 60 && !isActionTriggered) {
						setIsActionTriggered(true);
					} else if (clampedOffset < 60 && isActionTriggered) {
						setIsActionTriggered(false);
					}
				}
			};

			const handleMouseUp = () => {
				isDragging.current = false;

				if (swipeOffset >= 140) {
					handleSwipeAction("more");
				} else if (swipeOffset >= 100) {
					handleSwipeAction("archive");
				} else if (swipeOffset >= 60) {
					handleSwipeAction("delete");
				}

				setSwipeOffset(0);
				setIsActionTriggered(false);

				document.removeEventListener("mousemove", handleMouseMove);
				document.removeEventListener("mouseup", handleMouseUp);
			};

			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);
		};

		return (
			<div className="relative overflow-hidden rounded-lg sm:rounded-xl mx-0.5 sm:mx-1 bg-card border border-border">
				{/* Action Background - Multiple Actions */}
				<div
					className="absolute inset-y-0 left-0 flex"
					style={{
						width: "180px",
						opacity: swipeOffset > 0 ? 1 : 0,
						transform: `translateX(${Math.max(0, swipeOffset - 180)}px)`,
						transition: isDragging.current ? "none" : "transform 0.3s ease-out",
					}}
				>
					{/* Delete Action */}
					<div
						className={`w-20 bg-gradient-to-r from-red-500 to-red-600 flex items-center justify-center transition-all duration-200 ${
							swipeOffset >= 60 ? "scale-105" : "scale-100"
						}`}
					>
						<Trash2
							className={`w-5 h-5 text-white transition-all duration-200 ${swipeOffset >= 60 ? "scale-125" : "scale-100"}`}
						/>
					</div>

					{/* Archive Action */}
					<div
						className={`w-20 bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center transition-all duration-200 ${
							swipeOffset >= 100 ? "scale-105" : "scale-100"
						}`}
					>
						<Archive
							className={`w-5 h-5 text-white transition-all duration-200 ${swipeOffset >= 100 ? "scale-125" : "scale-100"}`}
						/>
					</div>

					{/* More Action */}
					<div
						className={`w-20 bg-gradient-to-r from-muted-foreground/60 to-muted-foreground/80 flex items-center justify-center transition-all duration-200 ${
							swipeOffset >= 140 ? "scale-105" : "scale-100"
						}`}
					>
						<MoreVertical
							className={`w-5 h-5 text-white transition-all duration-200 ${swipeOffset >= 140 ? "scale-125" : "scale-100"}`}
						/>
					</div>
				</div>

				{/* Swipe Progress Indicator */}
				<div
					className="absolute top-0 left-0 h-1 transition-all duration-200"
					style={{
						width: `${Math.min((swipeOffset / 180) * 100, 100)}%`,
						opacity: swipeOffset > 20 ? 0.8 : 0,
						background:
							swipeOffset >= 140
								? "linear-gradient(to right, hsl(var(--muted-foreground)), hsl(var(--muted-foreground)))"
								: swipeOffset >= 100
									? "linear-gradient(to right, #f97316, #ea580c)"
									: swipeOffset >= 60
										? "linear-gradient(to right, #ef4444, #dc2626)"
										: "linear-gradient(to right, #60a5fa, #a855f7)",
					}}
				/>

				{/* Task Item */}
				<div
					ref={containerRef}
					className={`group flex items-center p-2.5 sm:p-3 cursor-pointer transition-all duration-200 ease-out border border-transparent bg-card ${
						swipeOffset === 0
							? "hover:bg-accent hover:shadow-sm active:scale-[0.98]"
							: ""
					}`}
					style={{
						transform: `translateX(${swipeOffset}px)`,
						transition: isDragging.current
							? "none"
							: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
						boxShadow:
							swipeOffset > 0
								? `0 ${Math.min(swipeOffset / 20, 4)}px ${Math.min(swipeOffset / 10, 12)}px rgba(0,0,0,0.1)`
								: undefined,
					}}
					onTouchStart={handleTouchStart}
					onTouchMove={handleTouchMove}
					onTouchEnd={handleTouchEnd}
					onMouseDown={handleMouseDown}
					onClick={() => {
						// Only trigger click if not swiping
						if (swipeOffset === 0) {
							onTaskClick();
						}
					}}
				>
					{/* Content */}
					<div className="flex-1 min-w-0">
						<div className="flex items-start justify-between mb-0.5 sm:mb-1">
							<div className="flex-1 min-w-0">
								<h3 className="font-semibold text-foreground truncate text-sm sm:text-[15px] leading-tight">
									{getTaskTitle(task)}
								</h3>
								<div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1">
									<span className="text-xs text-muted-foreground hidden sm:inline">
										{formatTime(task.created_at!)}
									</span>
								</div>
							</div>
							<div className="flex items-center gap-1.5">
								{unreadCount > 0 && (
									<Badge
										variant="destructive"
										className="h-5 px-1.5 text-xs font-medium"
									>
										{unreadCount}
									</Badge>
								)}
								<div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
									<Button
										variant="ghost"
										size="icon"
										className="w-7 h-7 sm:w-8 sm:h-8 text-muted-foreground hover:text-foreground hover:bg-accent"
									>
										<MoreVertical className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
									</Button>
								</div>
							</div>
						</div>
						<p className="text-xs sm:text-sm text-muted-foreground truncate leading-relaxed">
							{getTaskDescription(task)}
						</p>
					</div>
				</div>
			</div>
		);
	};

	return (
		<div className="min-h-screen bg-background">
			{/* Header */}
			<div className="bg-card border-b border-border backdrop-blur-xl bg-card/95 sticky top-0 z-50">
				<div className="flex items-center justify-between px-3 sm:px-4 py-3 sm:py-4">
					<div className="flex items-center gap-2 sm:gap-3">
						<Button
							variant="ghost"
							size="icon"
							onClick={onBack}
							className="w-8 h-8 sm:w-9 sm:h-9 text-foreground hover:bg-accent"
						>
							<ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
						</Button>
						<div>
							<h1 className="text-lg sm:text-xl font-semibold text-foreground truncate max-w-48">
								{project.title || "Untitled Project"}
							</h1>
							<p className="text-xs text-muted-foreground mt-0.5">
								{tasks.length} {tasks.length === 1 ? "task" : "tasks"} •{" "}
								{threads.length} {threads.length === 1 ? "thread" : "threads"} •{" "}
								{articles.length} {articles.length === 1 ? "doc" : "docs"}
							</p>
						</div>
					</div>
					<div className="flex items-center gap-1">
						<Button
							variant="ghost"
							size="icon"
							className="w-8 h-8 sm:w-9 sm:h-9 text-foreground hover:bg-accent"
							onClick={() => onEditProject(project)}
						>
							<Edit3 className="w-4 h-4 sm:w-5 sm:h-5" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							className="w-8 h-8 sm:w-9 sm:h-9 text-foreground hover:bg-accent"
						>
							<MoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
						</Button>
					</div>
				</div>
			</div>

			{/* Tabs */}
			<div className="bg-card border-b border-border sticky top-16 z-40">
				<div className="flex px-3 sm:px-4">
					<button
						className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
							activeTab === "tasks"
								? "border-blue-500 text-blue-600"
								: "border-transparent text-muted-foreground hover:text-foreground"
						}`}
						onClick={() => setActiveTab("tasks")}
					>
						Tasks ({tasks.length})
					</button>
					<button
						className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
							activeTab === "threads"
								? "border-blue-500 text-blue-600"
								: "border-transparent text-muted-foreground hover:text-foreground"
						}`}
						onClick={() => setActiveTab("threads")}
					>
						Threads ({threads.length})
					</button>
					<button
						className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
							activeTab === "docs"
								? "border-blue-500 text-blue-600"
								: "border-transparent text-muted-foreground hover:text-foreground"
						}`}
						onClick={() => setActiveTab("docs")}
					>
						Docs ({articles.length})
					</button>
				</div>
			</div>

			{/* Content */}
			<div className="pb-20">
				{activeTab === "tasks" ? (
					// Tasks Tab Content
					tasks.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-20 sm:py-32 px-4 sm:px-6 text-center">
							<div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-muted/50 to-muted rounded-full flex items-center justify-center mb-4 sm:mb-6 shadow-sm">
								<Plus className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" />
							</div>
							<h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2 sm:mb-3">
								No tasks yet
							</h3>
							<p className="text-muted-foreground mb-6 sm:mb-8 max-w-sm leading-relaxed text-sm sm:text-base">
								Create your first task to start organizing your project work.
							</p>
							<Button
								className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm px-5 sm:px-6 py-2 rounded-full text-sm sm:text-base"
								onClick={() => setShowOptionsDialog(true)}
							>
								<Plus className="w-4 h-4 mr-2" />
								Create Task
							</Button>
						</div>
					) : (
						<div className="space-y-0.5 sm:space-y-1 px-1 sm:px-2 pt-1 sm:pt-2">
							{tasks.map((task) => {
								const handleTaskClick = () => {
									markTaskStatusUpdatesSeen(task.id);
									onTaskSelect(project, task.encode());
								};

								return (
									<SwipeTaskItem
										key={task.id}
										task={task}
										onTaskClick={handleTaskClick}
									/>
								);
							})}
						</div>
					)
				) : // Threads Tab Content
				threads.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-20 sm:py-32 px-4 sm:px-6 text-center">
						<div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mb-4 sm:mb-6 shadow-sm">
							<div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500 rounded-full flex items-center justify-center">
								<div className="w-3 h-3 sm:w-4 sm:h-4 bg-white rounded-full" />
							</div>
						</div>
						<h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2 sm:mb-3">
							No threads yet
						</h3>
						<p className="text-muted-foreground mb-6 sm:mb-8 max-w-sm leading-relaxed text-sm sm:text-base">
							Start a discussion thread to collaborate with your team.
						</p>
						<Button
							className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm px-5 sm:px-6 py-2 rounded-full text-sm sm:text-base"
							onClick={() => setShowThreadDialog(true)}
						>
							<Plus className="w-4 h-4 mr-2" />
							Start Thread
						</Button>
					</div>
				) : (
					<div className="space-y-0.5 sm:space-y-1 px-1 sm:px-2 pt-1 sm:pt-2">
						{threads.map((thread) => {
							const handleThreadClick = () => {
								markThreadRepliesSeen(thread.id);
								onThreadSelect?.(
									project,
									thread.encode(),
									getThreadTitle(thread),
								);
							};

							return (
								<ThreadItem
									key={thread.id}
									thread={thread}
									onThreadClick={handleThreadClick}
								/>
							);
						})}
					</div>
				)}
			</div>

			{/* Floating Action Button */}
			<div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40">
				<Button
					variant="primary"
					size="icon-lg"
					rounded="full"
					className="shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95"
					onClick={() => setShowOptionsDialog(true)}
				>
					<Plus className="w-6 h-6" />
				</Button>
			</div>

			{/* Dialogs */}
			<TaskCreationOptionsDialog
				open={showOptionsDialog}
				onOpenChange={setShowOptionsDialog}
				onOptionSelect={handleOptionSelect}
			/>

			<CreateTaskDialog
				open={showCreateTaskDialog}
				onOpenChange={setShowCreateTaskDialog}
				project={project}
				onTaskCreated={() => {
					// Tasks will automatically refresh via useSubscribe
				}}
			/>

			<VoiceTaskDialog
				open={showVoiceTaskDialog}
				onOpenChange={setShowVoiceTaskDialog}
				project={project}
				onTaskCreated={() => {
					// Tasks will automatically refresh via useSubscribe
				}}
			/>

			<ThreadDialog
				open={showThreadDialog}
				onOpenChange={setShowThreadDialog}
				project={project}
				onThreadStart={(threadTitle, selectedAgents) => {
					onThreadStart(project, threadTitle, selectedAgents);
				}}
			/>
		</div>
	);
}

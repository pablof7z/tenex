import {
	NDKProject,
	NDKTask,
	useNDKCurrentUser,
	useSubscribe,
} from "@nostr-dev-kit/ndk-hooks";
import { Clock, MessageCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { ChatInterface } from "./ChatInterface";
import { SearchIconButton } from "./common/SearchBar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

interface ChatsPageProps {
	onTaskSelect?: (project: NDKProject, taskId: string) => void;
}

export function ChatsPage({ onTaskSelect }: ChatsPageProps) {
	const currentUser = useNDKCurrentUser();
	const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

	// Get all user's projects
	const { events: projects } = useSubscribe<NDKProject>(
		currentUser
			? [
					{
						kinds: [NDKProject.kind],
						authors: [currentUser.pubkey],
						limit: 50,
					},
				]
			: false,
		{ wrap: true },
		[currentUser?.pubkey],
	);

	// Get all tasks for these projects
	const { events: tasks } = useSubscribe<NDKTask>(
		projects.length > 0
			? [
					{
						kinds: [NDKTask.kind],
						"#a": projects.map(
							(p) => `${NDKProject.kind}:${p.pubkey}:${p.tagValue("d")}`,
						),
					},
				]
			: false,
		{ wrap: true },
		[projects.length],
	);

	// Get all status updates for all tasks
	const { events: allStatusUpdates } = useSubscribe(
		tasks.length > 0
			? [
					{
						kinds: [1],
						"#e": tasks.map((t) => t.id),
					},
				]
			: false,
		{},
		[tasks.length],
	);

	// Sort status updates by creation time (newest first)
	const sortedStatusUpdates = useMemo(() => {
		if (!allStatusUpdates) return [];
		return [...allStatusUpdates].sort(
			(a, b) => (b.created_at ?? 0) - (a.created_at ?? 0),
		);
	}, [allStatusUpdates]);

	// Get status updates for selected task (if any)
	const selectedTaskUpdates = useMemo(() => {
		if (!selectedTaskId) return sortedStatusUpdates;
		return sortedStatusUpdates.filter((update) => {
			const taskId = update.tags?.find((tag) => tag[0] === "e")?.[1];
			return taskId === selectedTaskId;
		});
	}, [sortedStatusUpdates, selectedTaskId]);

	// Helper functions
	const getTaskById = (taskId: string) => {
		return tasks.find((task) => task.id === taskId);
	};

	const getProjectForTask = (task: NDKTask) => {
		const projectReference = task.tags?.find((tag) => tag[0] === "a")?.[1];
		if (projectReference) {
			const parts = projectReference.split(":");
			if (parts.length >= 3) {
				const projectTagId = parts[2];
				return projects.find((p) => p.tagValue("d") === projectTagId);
			}
		}
		return null;
	};

	const getTaskTitle = (task: NDKTask) => {
		const titleTag = task.tags?.find((tag) => tag[0] === "title")?.[1];
		if (titleTag) return titleTag;

		const firstLine = task.content?.split("\n")[0] || "Untitled Task";
		return firstLine.length > 40 ? `${firstLine.slice(0, 40)}...` : firstLine;
	};

	const formatTimestamp = (timestamp: number) => {
		const date = new Date(timestamp * 1000);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return "now";
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
	};

	const handleReplyToTask = (taskId: string) => {
		setSelectedTaskId(taskId);
	};

	const handleTaskClick = (taskId: string) => {
		const task = getTaskById(taskId);
		const project = task ? getProjectForTask(task) : null;

		if (task && project && onTaskSelect) {
			onTaskSelect(project, taskId);
		}
	};

	if (!currentUser) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<div className="text-center">
					<p className="text-muted-foreground">No user logged in</p>
				</div>
			</div>
		);
	}

	return (
		<div className="h-screen bg-background flex flex-col">
			{/* Header */}
			<div className="bg-card border-b border-border/60 backdrop-blur-xl bg-card/95 sticky top-0 z-40">
				<div className="flex items-center justify-between px-3 sm:px-4 py-3 sm:py-4">
					<div className="flex items-center gap-2 sm:gap-3">
						<div>
							<h1 className="text-lg sm:text-xl font-semibold text-foreground">
								Chats
							</h1>
							<p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
								{selectedTaskId
									? "Task conversation"
									: `${sortedStatusUpdates.length} updates`}
							</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						{selectedTaskId && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setSelectedTaskId(null)}
								className="text-xs"
							>
								Show All
							</Button>
						)}
						<SearchIconButton
							onClick={() => {
								// TODO: Implement chat search
							}}
							size="sm"
							className="sm:w-9 sm:h-9"
						/>
					</div>
				</div>
			</div>

			{/* Selected Task Info */}
			{selectedTaskId && (
				<div className="bg-primary/5 border-b border-primary/10 p-3">
					{(() => {
						const task = getTaskById(selectedTaskId);
						const project = task ? getProjectForTask(task) : null;

						if (!task || !project) return null;

						return (
							<div className="flex items-center gap-3">
								<div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
									<MessageCircle className="w-4 h-4 text-primary-foreground" />
								</div>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 mb-1">
										<span className="font-semibold text-sm text-foreground truncate">
											{getTaskTitle(task)}
										</span>
										<Badge
											variant="outline"
											className="text-xs bg-background/50"
										>
											{project.title || "Project"}
										</Badge>
									</div>
									<div className="text-xs text-primary flex items-center gap-1">
										<Clock className="w-3 h-3" />
										{formatTimestamp(task.created_at!)}
									</div>
								</div>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => handleTaskClick(selectedTaskId)}
									className="text-primary hover:bg-primary/10"
								>
									View Task
								</Button>
							</div>
						);
					})()}
				</div>
			)}

			{/* Chat Interface */}
			<div
				className="flex-1 pb-safe-or-6"
				style={{
					paddingBottom: "max(5rem, calc(env(safe-area-inset-bottom) + 1rem))",
				}}
			>
				{sortedStatusUpdates.length === 0 ? (
					<div className="h-full flex items-center justify-center">
						<div className="text-center">
							<div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
								<MessageCircle className="w-6 h-6 text-muted-foreground" />
							</div>
							<h3 className="text-lg font-medium text-foreground mb-2">
								No conversations yet
							</h3>
							<p className="text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed">
								Start working on tasks and their status updates will appear
								here.
							</p>
						</div>
					</div>
				) : (
					<ChatInterface
						statusUpdates={selectedTaskUpdates}
						taskId={selectedTaskId || undefined}
						inputPlaceholder={
							selectedTaskId
								? "Reply to this task..."
								: "Select a task update to reply"
						}
						allowInput={!!selectedTaskId}
						onReplyToTask={handleReplyToTask}
						className="h-full"
					/>
				)}
			</div>
		</div>
	);
}

import type { NDKEvent, NDKProject, NDKTask } from "@nostr-dev-kit/ndk-hooks";
import { useAtom } from "jotai";
import {
	ChevronDown,
	ChevronRight,
	Clock,
	ExternalLink,
	MessageSquare,
	Plus,
} from "lucide-react";
import { useMemo, useState } from "react";
import { selectedTaskAtom } from "../lib/store";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

interface ProjectColumnProps {
	project: NDKProject;
	tasks: NDKTask[];
	statusUpdates: NDKEvent[];
	onProjectClick?: (project: NDKProject) => void;
}

export function ProjectColumn({
	project,
	tasks,
	statusUpdates,
	onProjectClick,
}: ProjectColumnProps) {
	const title =
		project.title || project.tagValue("title") || "Untitled Project";
	const [isTasksExpanded, setIsTasksExpanded] = useState(false);
	const [selectedTask, setSelectedTask] = useAtom(selectedTaskAtom);

	// Get tasks for this project
	const projectTasks = useMemo(() => {
		return tasks
			.filter((task) => {
				const projectReference = task.tags?.find((tag) => tag[0] === "a")?.[1];
				if (projectReference) {
					const parts = projectReference.split(":");
					if (parts.length >= 3) {
						const projectTagId = parts[2];
						return project.tagValue("d") === projectTagId;
					}
				}
				return false;
			})
			.sort((a, b) => (b.created_at || 0) - (a.created_at || 0)); // Most recent first
	}, [tasks, project]);

	// Get status updates for this project
	const projectStatusUpdates = useMemo(() => {
		const projectTaskIds = projectTasks.map((task) => task.id);
		return statusUpdates
			.filter((update) => {
				const taskId = update.tags?.find(
					(tag) => tag[0] === "e" && tag[3] === "task",
				)?.[1];
				return taskId && projectTaskIds.includes(taskId);
			})
			.sort((a, b) => (b.created_at || 0) - (a.created_at || 0)); // Most recent first
	}, [statusUpdates, projectTasks]);

	const formatRelativeTime = (timestamp: number) => {
		const date = new Date(timestamp * 1000);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return "now";
		if (diffMins < 60) return `${diffMins}m`;
		if (diffHours < 24) return `${diffHours}h`;
		if (diffDays < 7) return `${diffDays}d`;
		return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
	};

	const getTaskTitle = (task: NDKTask) => {
		const titleTag = task.tags?.find((tag) => tag[0] === "title")?.[1];
		if (titleTag) return titleTag;

		const firstLine = task.content?.split("\n")[0] || "Untitled Task";
		return firstLine.length > 40 ? firstLine.slice(0, 40) + "..." : firstLine;
	};

	const getTaskStatus = (task: NDKTask) => {
		const statusTag = task.tags?.find((tag) => tag[0] === "status")?.[1];
		if (statusTag === "completed" || statusTag === "done") return "completed";
		if (statusTag === "in-progress" || statusTag === "active")
			return "in-progress";
		return "pending";
	};

	const getStatusBadgeVariant = (status: string) => {
		switch (status) {
			case "completed":
				return "default";
			case "in-progress":
				return "secondary";
			default:
				return "outline";
		}
	};

	const getProjectAvatar = (project: NDKProject) => {
		if (project.picture) {
			return project.picture;
		}
		const seed = project.tagValue("d") || project.title || "default";
		return `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(seed)}`;
	};

	const getInitials = (title: string) => {
		return title
			.split(" ")
			.map((word) => word.charAt(0))
			.join("")
			.toUpperCase()
			.slice(0, 2);
	};

	const getAvatarColors = (title: string) => {
		const colors = [
			"bg-gradient-to-br from-blue-500 to-blue-600",
			"bg-gradient-to-br from-emerald-500 to-emerald-600",
			"bg-gradient-to-br from-purple-500 to-purple-600",
			"bg-gradient-to-br from-amber-500 to-amber-600",
			"bg-gradient-to-br from-rose-500 to-rose-600",
			"bg-gradient-to-br from-indigo-500 to-indigo-600",
			"bg-gradient-to-br from-teal-500 to-teal-600",
			"bg-gradient-to-br from-orange-500 to-orange-600",
		];
		const index =
			title.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) %
			colors.length;
		return colors[index];
	};

	const recentTasks = projectTasks.slice(0, 3); // Show only 3 most recent tasks by default
	const allTasks = projectTasks; // Keep all tasks for expanded view
	const recentUpdates = projectStatusUpdates.slice(0, 10); // Show only 10 most recent updates

	return (
		<div className="w-80 flex-shrink-0 bg-slate-50 border-x-[1px] border-slate-200 flex flex-col h-full">
			{/* Column Header */}
			<div className="p-4 bg-white rounded-t-lg border-b border-slate-200">
				<div className="flex items-center gap-3 mb-3">
					<Avatar className="w-10 h-10">
						<AvatarImage src={getProjectAvatar(project)} alt={title} />
						<AvatarFallback
							className={`text-white font-semibold text-sm ${getAvatarColors(title)}`}
						>
							{getInitials(title)}
						</AvatarFallback>
					</Avatar>
					<div className="flex-1 min-w-0">
						<h3 className="font-semibold text-slate-900 truncate">{title}</h3>
						<p className="text-xs text-slate-500">
							{projectTasks.length} tasks • {projectStatusUpdates.length}{" "}
							updates
						</p>
					</div>
					<Button
						variant="ghost"
						size="icon"
						className="w-8 h-8 text-slate-500 hover:text-slate-700"
						onClick={(e) => {
							e.stopPropagation();
							onProjectClick?.(project);
						}}
						title="View project details"
					>
						<ExternalLink className="w-4 h-4" />
					</Button>
				</div>

				{/* Recent Tasks Section */}
				{projectTasks.length > 0 && (
					<div className="mb-3">
						<div className="flex items-center justify-between mb-2">
							<Button
								variant="ghost"
								size="sm"
								className="p-0 h-auto text-sm font-medium text-slate-700 hover:text-slate-900"
								onClick={() => setIsTasksExpanded(!isTasksExpanded)}
							>
								{isTasksExpanded ? (
									<ChevronDown className="w-4 h-4 mr-1" />
								) : (
									<ChevronRight className="w-4 h-4 mr-1" />
								)}
								Recent Tasks
							</Button>
							<Button
								variant="ghost"
								size="icon"
								className="w-6 h-6 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
							>
								<Plus className="w-4 h-4" />
							</Button>
						</div>

						<div className="space-y-1">
							{(isTasksExpanded ? allTasks : recentTasks).map((task) => {
								const isSelected = selectedTask?.id === task.id;
								return (
									<div
										key={task.id}
										className={`p-2 rounded-lg cursor-pointer transition-colors ${
											isSelected
												? "bg-blue-50 border border-blue-200"
												: "bg-slate-50 hover:bg-slate-100"
										}`}
										onClick={() => setSelectedTask(task)}
									>
										<h5 className="text-xs font-medium text-slate-900 leading-tight">
											{getTaskTitle(task)}
										</h5>
									</div>
								);
							})}
						</div>
					</div>
				)}
			</div>

			{/* Column Content */}
			<div className="flex-1 overflow-y-auto space-y-4">
				{/* Status Updates Section */}
				{recentUpdates.length > 0 && (
					<div>
						<div>
							{recentUpdates.map((update) => {
								// Find the task this update belongs to
								const taskId = update.tags?.find(
									(tag) => tag[0] === "e" && tag[3] === "task",
								)?.[1];
								const relatedTask = taskId
									? projectTasks.find((t) => t.id === taskId)
									: null;

								return (
									<div
										key={update.id}
										className="bg-white p-3 border-y border-slate-100"
									>
										<div className="flex items-start gap-2 mb-2">
											<div className="w-6 h-6 bg-slate-200 rounded-full flex-shrink-0 flex items-center justify-center">
												<MessageSquare className="w-3 h-3 text-slate-600" />
											</div>
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2 mb-1">
													<span className="text-xs font-medium text-slate-700">
														Agent Update
													</span>
													<span className="text-xs text-slate-500">
														{formatRelativeTime(update.created_at!)}
													</span>
												</div>
												{relatedTask && (
													<p className="text-xs text-slate-500 mb-1">
														Task: {getTaskTitle(relatedTask)}
													</p>
												)}
											</div>
										</div>
										<p className="text-sm text-slate-800 leading-relaxed">
											{update.content.length > 120
												? update.content.slice(0, 120) + "..."
												: update.content}
										</p>
									</div>
								);
							})}
						</div>
					</div>
				)}

				{/* Empty State */}
				{recentUpdates.length === 0 && (
					<div className="text-center py-8">
						<div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-3">
							<MessageSquare className="w-6 h-6 text-slate-400" />
						</div>
						<p className="text-sm text-slate-500">No recent updates</p>
					</div>
				)}
			</div>
		</div>
	);
}

import {
	type NDKEvent,
	type NDKTask,
	useSubscribe,
} from "@nostr-dev-kit/ndk-hooks";
import { useAtom } from "jotai";
import { Calendar, Clock, Hash, MessageSquare, User, X } from "lucide-react";
import { useMemo } from "react";
import { selectedTaskAtom } from "../lib/store";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

interface TaskDetailPanelProps {
	task: NDKTask;
	statusUpdates: NDKEvent[];
}

export function TaskDetailPanel({ task, statusUpdates }: TaskDetailPanelProps) {
	const [, setSelectedTask] = useAtom(selectedTaskAtom);

	const { events: taskUpdates } = useSubscribe(
		task
			? [
					{
						kinds: [1],
						"#e": [task.id],
						"#t": ["task"],
					},
				]
			: false,
		{},
		[task?.id],
	);

	const getTaskTitle = (task: NDKTask) => {
		const titleTag = task.tags?.find((tag) => tag[0] === "title")?.[1];
		if (titleTag) return titleTag;

		const firstLine = task.content?.split("\n")[0] || "Untitled Task";
		return firstLine.length > 60 ? firstLine.slice(0, 60) + "..." : firstLine;
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

	const formatDateTime = (timestamp: number) => {
		const date = new Date(timestamp * 1000);
		return date.toLocaleString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const formatRelativeTime = (timestamp: number) => {
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

	const sortedUpdates = useMemo(() => {
		return [...taskUpdates].sort(
			(a, b) => (b.created_at || 0) - (a.created_at || 0),
		);
	}, [taskUpdates]);

	const status = getTaskStatus(task);

	return (
		<div className="h-full bg-white border-l border-slate-200 flex flex-col">
			{/* Header */}
			<div className="p-6 border-b border-slate-200">
				<div className="flex items-start justify-between mb-4">
					<div className="flex-1 min-w-0">
						<h2 className="text-lg font-semibold text-slate-900 mb-2">
							{getTaskTitle(task)}
						</h2>
						<div className="flex items-center gap-2 flex-wrap">
							<Badge
								variant={getStatusBadgeVariant(status)}
								className="text-xs"
							>
								{status === "completed"
									? "Done"
									: status === "in-progress"
										? "In Progress"
										: "Pending"}
							</Badge>
							<div className="flex items-center gap-1 text-xs text-slate-500">
								<Calendar className="w-3 h-3" />
								{formatDateTime(task.created_at!)}
							</div>
							<div className="flex items-center gap-1 text-xs text-slate-500">
								<Hash className="w-3 h-3" />
								{task.id.slice(0, 8)}...
							</div>
						</div>
					</div>
					<Button
						variant="ghost"
						size="icon"
						className="w-8 h-8"
						onClick={() => setSelectedTask(null)}
					>
						<X className="w-4 h-4" />
					</Button>
				</div>

				{/* Task Content */}
				{task.content && (
					<div className="prose prose-sm max-w-none">
						<div className="bg-slate-50 rounded-lg p-4">
							<h4 className="text-sm font-medium text-slate-700 mb-2">
								Description
							</h4>
							<div className="text-sm text-slate-800 whitespace-pre-wrap">
								{task.content}
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Updates Section */}
			<div className="flex-1 overflow-y-auto p-6">
				<div className="flex items-center gap-2 mb-4">
					<MessageSquare className="w-4 h-4 text-slate-600" />
					<h3 className="text-sm font-medium text-slate-700">
						Updates ({sortedUpdates.length})
					</h3>
				</div>

				{sortedUpdates.length > 0 ? (
					<div className="space-y-4">
						{sortedUpdates.map((update) => (
							<Card key={update.id} className="p-4">
								<div className="flex items-start gap-3">
									<div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
										<User className="w-4 h-4 text-slate-600" />
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 mb-2">
											<span className="text-sm font-medium text-slate-700">
												Agent
											</span>
											<span className="text-xs text-slate-500">
												{formatRelativeTime(update.created_at!)}
											</span>
										</div>
										<div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
											{update.content}
										</div>
									</div>
								</div>
							</Card>
						))}
					</div>
				) : (
					<div className="text-center py-8">
						<div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
							<MessageSquare className="w-6 h-6 text-slate-400" />
						</div>
						<p className="text-sm text-slate-500">No updates yet</p>
						<p className="text-xs text-slate-400 mt-1">
							Updates will appear here as agents work on this task
						</p>
					</div>
				)}
			</div>
		</div>
	);
}

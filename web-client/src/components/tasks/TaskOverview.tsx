import type { NDKEvent, NDKTask } from "@nostr-dev-kit/ndk-hooks";
import { useProfileValue } from "@nostr-dev-kit/ndk-hooks";
import { AlertCircle, CheckCircle2, Circle, Clock } from "lucide-react";
import { useMemo } from "react";

interface TaskOverviewProps {
	task: NDKTask;
	statusUpdates: NDKEvent[];
	onClick?: () => void;
}

export function TaskOverview({
	task,
	statusUpdates,
	onClick,
}: TaskOverviewProps) {
	// Get task title
	const getTaskTitle = () => {
		const titleTag = task.tags?.find((tag) => tag[0] === "title")?.[1];
		if (titleTag) return titleTag;

		const firstLine = task.content?.split("\n")[0] || "Untitled Task";
		return firstLine.length > 60 ? `${firstLine.slice(0, 60)}...` : firstLine;
	};

	// Get latest status update for this task
	const latestUpdate = useMemo(() => {
		return statusUpdates
			.filter((update) => {
				const taskId = update.tags?.find(
					(tag) => tag[0] === "e" && tag[3] === "task",
				)?.[1];
				return taskId === task.id;
			})
			.sort((a, b) => (b.created_at || 0) - (a.created_at || 0))[0];
	}, [statusUpdates, task.id]);

	// Get agent info for latest update
	const AgentInfo = () => {
		if (!latestUpdate) return null;
		const profile = useProfileValue(latestUpdate.pubkey);
		const agentTag = latestUpdate.tagValue("agent");

		const getAgentName = () => {
			if (profile?.name) return profile.name;
			if (profile?.displayName) return profile.displayName;
			if (agentTag) return agentTag;
			return `Agent ${latestUpdate.pubkey.slice(0, 8)}`;
		};

		return (
			<span className="text-xs text-muted-foreground">{getAgentName()}</span>
		);
	};

	// Determine task status based on latest update
	const getTaskStatus = () => {
		if (!latestUpdate) return "pending";

		const content = latestUpdate.content.toLowerCase();
		if (
			content.includes("completed") ||
			content.includes("done") ||
			content.includes("finished")
		) {
			return "completed";
		}
		if (
			content.includes("error") ||
			content.includes("failed") ||
			content.includes("issue")
		) {
			return "error";
		}
		if (
			content.includes("working") ||
			content.includes("progress") ||
			content.includes("started")
		) {
			return "in_progress";
		}
		return "pending";
	};

	const status = getTaskStatus();

	// Get status icon and color
	const getStatusIcon = () => {
		switch (status) {
			case "completed":
				return <CheckCircle2 className="w-4 h-4 text-green-500" />;
			case "error":
				return <AlertCircle className="w-4 h-4 text-red-500" />;
			case "in_progress":
				return <Clock className="w-4 h-4 text-blue-500" />;
			default:
				return <Circle className="w-4 h-4 text-gray-400" />;
		}
	};

	const getStatusColor = () => {
		switch (status) {
			case "completed":
				return "border-green-500/20 bg-green-500/5";
			case "error":
				return "border-red-500/20 bg-red-500/5";
			case "in_progress":
				return "border-blue-500/20 bg-blue-500/5";
			default:
				return "border-gray-300/20 bg-gray-100/5";
		}
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

	return (
		<div
			className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${getStatusColor()}`}
			onClick={onClick}
		>
			<div className="flex items-start gap-3">
				<div className="mt-0.5">{getStatusIcon()}</div>
				<div className="flex-1 min-w-0">
					<h4 className="text-sm font-medium text-foreground mb-1">
						{getTaskTitle()}
					</h4>
					{latestUpdate && (
						<div className="space-y-1">
							<p className="text-xs text-muted-foreground line-clamp-2">
								{latestUpdate.content}
							</p>
							<div className="flex items-center gap-2 text-xs">
								<AgentInfo />
								<span className="text-muted-foreground">•</span>
								<span className="text-muted-foreground">
									{formatRelativeTime(latestUpdate.created_at!)}
								</span>
							</div>
						</div>
					)}
					{!latestUpdate && (
						<p className="text-xs text-muted-foreground">No updates yet</p>
					)}
				</div>
			</div>
		</div>
	);
}

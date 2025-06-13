import { NDKTask } from "@nostr-dev-kit/ndk";
import { Circle } from "lucide-react";
import { Card } from "../ui/card";

interface TaskCardProps {
	task: NDKTask;
	onClick?: () => void;
	className?: string;
}

export function TaskCard({ task, onClick, className }: TaskCardProps) {
	// Get task title
	const getTaskTitle = () => {
		const titleTag = task.tags?.find((tag) => tag[0] === "title")?.[1];
		if (titleTag) return titleTag;

		const firstLine = task.content?.split("\n")[0] || "Untitled Task";
		return firstLine.length > 60 ? `${firstLine.slice(0, 60)}...` : firstLine;
	};

	// Get task complexity
	const getTaskComplexity = () => {
		const complexityTag = task.tags?.find((tag) => tag[0] === "complexity")?.[1];
		return complexityTag ? parseInt(complexityTag, 10) : null;
	};

	// Get task content preview
	const getTaskPreview = () => {
		const lines = task.content?.split("\n") || [];
		const preview = lines.slice(0, 2).join(" ");
		return preview.length > 100 ? `${preview.slice(0, 100)}...` : preview;
	};

	const complexity = getTaskComplexity();

	return (
		<Card
			className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${className || ""}`}
			onClick={onClick}
		>
			<div className="flex items-start gap-3">
				<div className="mt-0.5">
					<Circle className="w-4 h-4 text-gray-400" />
				</div>
				<div className="flex-1 min-w-0">
					<h4 className="text-sm font-medium text-foreground mb-1">
						{getTaskTitle()}
					</h4>
					<p className="text-xs text-muted-foreground line-clamp-2 mb-2">
						{getTaskPreview()}
					</p>
					<div className="flex items-center gap-2 text-xs">
						{complexity && (
							<span className="px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
								Complexity: {complexity}/10
							</span>
						)}
						<span className="text-muted-foreground">
							Created {new Date((task.created_at || 0) * 1000).toLocaleDateString()}
						</span>
					</div>
				</div>
			</div>
		</Card>
	);
}
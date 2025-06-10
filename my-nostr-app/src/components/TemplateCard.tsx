import type { NDKProjectTemplate } from "@nostr-dev-kit/ndk-hooks";
import { Clock, ExternalLink, GitBranch } from "lucide-react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

interface TemplateCardProps {
	template: NDKProjectTemplate;
	isSelected?: boolean;
	onSelect?: (template: NDKProjectTemplate) => void;
	showSelect?: boolean;
}

export function TemplateCard({
	template,
	isSelected,
	onSelect,
	showSelect = false,
}: TemplateCardProps) {
	const formatTime = (timestamp: number) => {
		const date = new Date(timestamp * 1000);
		const now = new Date();
		const diffHours = Math.abs(now.getTime() - date.getTime()) / 36e5;

		if (diffHours < 1) {
			return "now";
		} else if (diffHours < 24) {
			return date.toLocaleTimeString("en-US", {
				hour: "2-digit",
				minute: "2-digit",
				hour12: false,
			});
		} else if (diffHours < 24 * 7) {
			return date.toLocaleDateString("en-US", { weekday: "short" });
		} else {
			return date.toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
			});
		}
	};

	const getInitials = (name: string) => {
		return name
			.split(" ")
			.map((word) => word.charAt(0))
			.join("")
			.toUpperCase()
			.slice(0, 2);
	};

	const getRepoUrl = () => {
		if (!template.repo) return null;
		return template.repo.startsWith("git+")
			? template.repo.slice(4)
			: template.repo;
	};

	const handleCardClick = () => {
		if (showSelect && onSelect) {
			onSelect(template);
		}
	};

	return (
		<Card
			className={`p-4 transition-all duration-200 ${
				showSelect
					? `cursor-pointer hover:shadow-md hover:scale-[1.02] ${
							isSelected
								? "ring-2 ring-blue-500 bg-blue-50"
								: "hover:bg-slate-50"
						}`
					: ""
			}`}
			onClick={handleCardClick}
		>
			{/* Header */}
			<div className="flex items-start justify-between mb-3">
				<div className="flex items-center gap-3">
					{template.image ? (
						<img
							src={template.image}
							alt={template.title || "Template"}
							className="w-10 h-10 rounded-lg object-cover"
						/>
					) : (
						<div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
							<span className="text-white font-semibold text-sm">
								{getInitials(template.title || "Template")}
							</span>
						</div>
					)}
					<div className="flex-1 min-w-0">
						<h3 className="font-semibold text-slate-900 truncate text-sm">
							{template.title || "Untitled Template"}
						</h3>
						<div className="flex items-center gap-2 mt-1">
							<Avatar className="w-4 h-4">
								<AvatarFallback className="text-xs bg-slate-200">
									{getInitials(
										template.author?.profile?.name ||
											template.author?.npub ||
											"A",
									)}
								</AvatarFallback>
							</Avatar>
							<span className="text-xs text-slate-500 truncate">
								{template.author?.profile?.name ||
									template.author?.npub.slice(0, 12) + "..." ||
									"Unknown"}
							</span>
						</div>
					</div>
				</div>
				<div className="flex items-center gap-1 text-xs text-slate-400">
					<Clock className="w-3 h-3" />
					<span>{formatTime(template.created_at!)}</span>
				</div>
			</div>

			{/* Description */}
			{template.description && (
				<p className="text-sm text-slate-600 mb-3 line-clamp-2">
					{template.description}
				</p>
			)}

			{/* Tags */}
			{template.tags && template.tags.length > 0 && (
				<div className="flex flex-wrap gap-1 mb-3">
					{template.tags.slice(0, 6).map((tag) => (
						<Badge key={tag} variant="secondary" className="text-xs h-5 px-2">
							{tag}
						</Badge>
					))}
					{template.tags.length > 6 && (
						<Badge variant="outline" className="text-xs h-5 px-2">
							+{template.tags.length - 6}
						</Badge>
					)}
				</div>
			)}

			{/* Actions */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					{getRepoUrl() && (
						<Button
							variant="ghost"
							size="sm"
							className="h-7 px-2 text-slate-600 hover:text-slate-900"
							onClick={(e) => {
								e.stopPropagation();
								window.open(getRepoUrl()!, "_blank");
							}}
						>
							<GitBranch className="w-3 h-3 mr-1" />
							Repo
							<ExternalLink className="w-3 h-3 ml-1" />
						</Button>
					)}
				</div>
				{showSelect && (
					<Button
						variant={isSelected ? "default" : "outline"}
						size="sm"
						className="h-7 px-3"
						onClick={(e) => {
							e.stopPropagation();
							if (onSelect) onSelect(template);
						}}
					>
						{isSelected ? "Selected" : "Select"}
					</Button>
				)}
			</div>
		</Card>
	);
}

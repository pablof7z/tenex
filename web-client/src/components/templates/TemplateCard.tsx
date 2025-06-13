import type { NDKProjectTemplate } from "@nostr-dev-kit/ndk-hooks";
import { Clock, ExternalLink, GitBranch } from "lucide-react";
import { useTimeFormat } from "../../hooks/useTimeFormat";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

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
	const { formatAutoTime } = useTimeFormat({ includeTime: false });

	const getInitials = (name: string) => {
		return name
			.split(" ")
			.map((word) => word.charAt(0))
			.join("")
			.toUpperCase()
			.slice(0, 2);
	};

	const getRepoUrl = () => {
		const repo = template.tagValue("repo");
		if (!repo) return null;
		return repo.startsWith("git+") ? repo.slice(4) : repo;
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
								? "ring-2 ring-primary bg-primary/5"
								: "hover:bg-accent"
						}`
					: ""
			}`}
			onClick={handleCardClick}
		>
			{/* Header */}
			<div className="flex items-start justify-between mb-3">
				<div className="flex items-center gap-3">
					{template.tagValue("image") ? (
						<img
							src={template.tagValue("image")}
							alt={template.tagValue("title") || "Template"}
							className="w-10 h-10 rounded-lg object-cover"
						/>
					) : (
						<div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
							<span className="text-white font-semibold text-sm">
								{getInitials(template.tagValue("title") || "Template")}
							</span>
						</div>
					)}
					<div className="flex-1 min-w-0">
						<h3 className="font-semibold text-foreground truncate text-sm">
							{template.tagValue("title") || "Untitled Template"}
						</h3>
						<div className="flex items-center gap-2 mt-1">
							<Avatar className="w-4 h-4">
								<AvatarFallback className="text-xs bg-muted">
									{getInitials(
										template.author?.profile?.name ||
											template.author?.npub ||
											"A",
									)}
								</AvatarFallback>
							</Avatar>
							<span className="text-xs text-muted-foreground truncate">
								{template.author?.profile?.name ||
									`${template.author?.npub.slice(0, 12)}...` ||
									"Unknown"}
							</span>
						</div>
					</div>
				</div>
				<div className="flex items-center gap-1 text-xs text-muted-foreground">
					<Clock className="w-3 h-3" />
					<span>{formatAutoTime(template.created_at!)}</span>
				</div>
			</div>

			{/* Description */}
			{template.tagValue("description") && (
				<p className="text-sm text-muted-foreground mb-3 line-clamp-2">
					{template.tagValue("description")}
				</p>
			)}

			{/* Tags */}
			{(() => {
				const tags = template.tags
					.filter((tag) => tag[0] === "t")
					.map((tag) => tag[1]);
				return (
					tags.length > 0 && (
						<div className="flex flex-wrap gap-1 mb-3">
							{tags.slice(0, 6).map((tag, index) => (
								<Badge
									key={`${tag}-${index}`}
									variant="secondary"
									className="text-xs h-5 px-2"
								>
									{tag}
								</Badge>
							))}
							{tags.length > 6 && (
								<Badge variant="outline" className="text-xs h-5 px-2">
									+{tags.length - 6}
								</Badge>
							)}
						</div>
					)
				);
			})()}

			{/* Actions */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					{getRepoUrl() && (
						<Button
							variant="ghost"
							size="sm"
							className="h-7 px-2 text-muted-foreground hover:text-foreground"
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

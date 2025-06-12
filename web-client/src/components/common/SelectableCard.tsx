import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

export interface SelectableCardProps<T> {
	item: T;
	isSelected: boolean;
	onSelect: (item: T) => void;
	onDeselect: (item: T) => void;
	renderIcon?: () => ReactNode;
	renderTitle: (item: T) => string;
	renderDescription?: (item: T) => ReactNode;
	renderMeta?: (item: T) => ReactNode;
	renderTags?: (item: T) => string[];
	renderActions?: (item: T) => ReactNode;
	selectButtonText?: string;
	selectedButtonText?: string;
	showSelectButton?: boolean;
	className?: string;
	clickable?: boolean;
	cardClassName?: string;
}

export function SelectableCard<T>({
	item,
	isSelected,
	onSelect,
	onDeselect,
	renderIcon,
	renderTitle,
	renderDescription,
	renderMeta,
	renderTags,
	renderActions,
	selectButtonText = "Select",
	selectedButtonText = "Selected",
	showSelectButton = true,
	className = "",
	clickable = false,
	cardClassName = "",
}: SelectableCardProps<T>) {
	const handleToggle = () => {
		if (isSelected) {
			onDeselect(item);
		} else {
			onSelect(item);
		}
	};

	const handleCardClick = () => {
		if (clickable) {
			handleToggle();
		}
	};

	const tags = renderTags?.(item) || [];

	return (
		<Card
			className={`p-4 transition-all duration-200 ${
				clickable
					? `cursor-pointer hover:shadow-md hover:scale-[1.02] ${
							isSelected
								? "ring-2 ring-blue-500 bg-blue-50"
								: "hover:bg-slate-50"
						}`
					: `hover:bg-slate-50 ${
							isSelected ? "border-blue-500 bg-blue-50/30" : "border-slate-200"
						}`
			} ${cardClassName || className}`}
			onClick={handleCardClick}
		>
			<div className="flex items-start justify-between">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-2">
						{renderIcon?.()}
						<h3 className="font-medium text-slate-900 truncate">
							{renderTitle(item)}
						</h3>
						{isSelected && !clickable && (
							<Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
						)}
					</div>

					{renderDescription && (
						<div className="text-sm text-slate-600 mb-3 leading-relaxed">
							{renderDescription(item)}
						</div>
					)}

					{renderMeta && (
						<div className="text-xs text-slate-500 mb-2">
							{renderMeta(item)}
						</div>
					)}

					{tags.length > 0 && (
						<div className="flex flex-wrap gap-1">
							{tags.map((tag, index) => (
								<Badge
									key={index}
									variant="outline"
									className="text-xs h-5 px-2"
								>
									{tag}
								</Badge>
							))}
						</div>
					)}
				</div>

				<div className="flex items-center gap-2 ml-4">
					{renderActions?.(item)}
					{showSelectButton && (
						<Button
							variant={isSelected ? "default" : "outline"}
							size="sm"
							onClick={(e) => {
								e.stopPropagation();
								handleToggle();
							}}
							className={`h-8 min-w-[80px] ${
								isSelected ? "bg-blue-600 hover:bg-blue-700" : ""
							}`}
						>
							{isSelected ? selectedButtonText : selectButtonText}
						</Button>
					)}
				</div>
			</div>
		</Card>
	);
}

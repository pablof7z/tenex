import type { ReactNode } from "react";
import { Button } from "../ui/button";

interface EmptyStateProps {
	icon: ReactNode;
	title: string;
	description?: string;
	action?: {
		label: string;
		onClick: () => void;
	};
	className?: string;
}

export function EmptyState({
	icon,
	title,
	description,
	action,
	className = "",
}: EmptyStateProps) {
	return (
		<div className={`text-center py-12 ${className}`}>
			<div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
				{icon}
			</div>
			<h3 className="text-lg font-medium text-foreground mb-2">{title}</h3>
			{description && (
				<p className="text-muted-foreground mb-4 max-w-md mx-auto">
					{description}
				</p>
			)}
			{action && (
				<Button variant="outline" onClick={action.onClick}>
					{action.label}
				</Button>
			)}
		</div>
	);
}

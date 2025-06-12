import { AlertCircle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../ui/button";

interface ErrorStateProps {
	title?: string;
	message: string;
	onRetry?: () => void;
	retryLabel?: string;
	icon?: ReactNode;
	className?: string;
}

export function ErrorState({
	title = "Something went wrong",
	message,
	onRetry,
	retryLabel = "Try again",
	icon,
	className = "",
}: ErrorStateProps) {
	return (
		<div className={`text-center py-12 ${className}`}>
			<div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
				{icon || <AlertCircle className="w-8 h-8 text-destructive" />}
			</div>
			<h3 className="text-lg font-medium text-foreground mb-2">{title}</h3>
			<p className="text-muted-foreground mb-4 max-w-md mx-auto">{message}</p>
			{onRetry && (
				<Button variant="outline" onClick={onRetry}>
					<RefreshCw className="w-4 h-4 mr-2" />
					{retryLabel}
				</Button>
			)}
		</div>
	);
}

// Inline error message for form fields, etc.
interface InlineErrorProps {
	message: string;
	className?: string;
}

export function InlineError({ message, className = "" }: InlineErrorProps) {
	return (
		<div
			className={`flex items-center gap-2 text-sm text-destructive ${className}`}
		>
			<AlertCircle className="w-4 h-4 flex-shrink-0" />
			<span>{message}</span>
		</div>
	);
}

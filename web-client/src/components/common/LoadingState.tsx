import { Loader2 } from "lucide-react";

interface LoadingStateProps {
	message?: string;
	size?: "sm" | "md" | "lg";
	className?: string;
	fullScreen?: boolean;
}

export function LoadingState({
	message = "Loading...",
	size = "md",
	className = "",
	fullScreen = false,
}: LoadingStateProps) {
	const sizeClasses = {
		sm: "w-4 h-4",
		md: "w-6 h-6",
		lg: "w-8 h-8",
	};

	const containerClasses = fullScreen
		? "min-h-screen flex items-center justify-center"
		: "flex items-center justify-center py-12";

	return (
		<div className={`${containerClasses} ${className}`}>
			<div className="text-center">
				<Loader2
					className={`${sizeClasses[size]} animate-spin text-muted-foreground mx-auto mb-4`}
				/>
				{message && <p className="text-sm text-muted-foreground">{message}</p>}
			</div>
		</div>
	);
}

// Inline loading spinner for use in buttons, etc.
interface InlineLoadingProps {
	size?: "sm" | "md" | "lg";
	className?: string;
}

export function InlineLoading({
	size = "sm",
	className = "",
}: InlineLoadingProps) {
	const sizeClasses = {
		sm: "w-4 h-4",
		md: "w-5 h-5",
		lg: "w-6 h-6",
	};

	return (
		<Loader2 className={`${sizeClasses[size]} animate-spin ${className}`} />
	);
}

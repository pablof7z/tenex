import { useProfileValue } from "@nostr-dev-kit/ndk-hooks";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

interface ParticipantAvatarsProps {
	participants: string[];
	maxVisible?: number;
	size?: "sm" | "md" | "lg";
	className?: string;
}

export function ParticipantAvatars({
	participants,
	maxVisible = 4,
	size = "sm",
	className = "",
}: ParticipantAvatarsProps) {
	const sizeClasses = {
		sm: "w-6 h-6",
		md: "w-8 h-8",
		lg: "w-10 h-10",
	};

	const visibleParticipants = participants.slice(0, maxVisible);
	const remainingCount = participants.length - maxVisible;

	return (
		<div className={`flex items-center ${className}`}>
			<div className="flex -space-x-1">
				{visibleParticipants.map((pubkey, index) => (
					<ParticipantAvatar
						key={pubkey}
						pubkey={pubkey}
						className={`border-2 border-background ${sizeClasses[size]} z-${10 - index}`}
					/>
				))}
				{remainingCount > 0 && (
					<div
						className={`${sizeClasses[size]} rounded-full bg-muted border-2 border-background flex items-center justify-center z-0`}
					>
						<span className="text-xs font-medium text-muted-foreground">
							+{remainingCount}
						</span>
					</div>
				)}
			</div>
		</div>
	);
}

interface ParticipantAvatarProps {
	pubkey: string;
	className?: string;
}

function ParticipantAvatar({ pubkey, className }: ParticipantAvatarProps) {
	const profile = useProfileValue(pubkey);

	const displayName =
		profile?.displayName || profile?.name || `${pubkey.slice(0, 8)}...`;
	const avatarUrl = profile?.image || profile?.picture;

	const getInitials = (name: string) => {
		if (name.includes("...")) {
			return name.slice(0, 2).toUpperCase();
		}
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);
	};

	return (
		<Avatar className={className}>
			<AvatarImage src={avatarUrl} alt={displayName} />
			<AvatarFallback className="text-xs">
				{getInitials(displayName)}
			</AvatarFallback>
		</Avatar>
	);
}
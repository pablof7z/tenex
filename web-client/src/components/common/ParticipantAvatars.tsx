import { useProfileValue } from "@nostr-dev-kit/ndk-hooks";
import { CSSUtils, ProfileUtils } from "@tenex/shared";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../ui/hover-card";

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
    const sizeClasses = CSSUtils.getAvatarClasses(size).avatar;

    const visibleParticipants = participants.slice(0, maxVisible);
    const remainingCount = participants.length - maxVisible;

    return (
        <div className={`flex items-center ${className}`}>
            <div className="flex -space-x-1">
                {visibleParticipants.map((pubkey, index) => (
                    <ParticipantAvatar
                        key={pubkey}
                        pubkey={pubkey}
                        className={`border-2 border-background ${sizeClasses} z-${10 - index}`}
                    />
                ))}
                {remainingCount > 0 && (
                    <div
                        className={`${sizeClasses} rounded-full bg-muted border-2 border-background flex items-center justify-center z-0`}
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

    const displayName = ProfileUtils.getDisplayName(profile || null, pubkey);
    const avatarUrl = ProfileUtils.getAvatarUrl(profile || null);
    const initials = ProfileUtils.getInitials(profile || null, pubkey);

    return (
        <HoverCard>
            <HoverCardTrigger asChild>
                <Avatar className={className}>
                    <AvatarImage src={avatarUrl} alt={displayName} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
            </HoverCardTrigger>
            <HoverCardContent className="w-64" side="top">
                <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                        <AvatarImage src={avatarUrl} alt={displayName} />
                        <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold truncate">{displayName}</h4>
                        {profile?.about && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                {profile.about}
                            </p>
                        )}
                    </div>
                </div>
            </HoverCardContent>
        </HoverCard>
    );
}

import { useProfileValue } from "@nostr-dev-kit/ndk-hooks";
import { ProfileUtils } from "../../lib/utils/business";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../ui/hover-card";

interface ParticipantAvatarProps {
    pubkey: string;
    className?: string;
}

export function ParticipantAvatar({ pubkey, className }: ParticipantAvatarProps) {
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
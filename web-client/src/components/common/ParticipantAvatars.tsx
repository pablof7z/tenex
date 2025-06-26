import { CSSUtils } from "../../lib/utils/business";
import { ParticipantAvatar } from "./ParticipantAvatar";

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


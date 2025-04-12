import { Hexpubkey } from "@nostr-dev-kit/ndk";
import { useProfile } from "@nostr-dev-kit/ndk-hooks";
import { cx } from "class-variance-authority";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const getInitials = (displayName?: string, pubkey?: string): string => {
    if (!displayName) return pubkey?.slice(0, 2) || "NU";

    const nameParts = displayName.split(" ");
    return nameParts.length > 1 ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase() : displayName[0].toUpperCase();
};

export default function UserAvatar({
    pubkey,
    className,
    size = "default",
}: {
    pubkey: Hexpubkey;
    className?: string;
    size?: "sm" | "default" | "lg";
}) {
    const profile = useProfile(pubkey);

    const sizeClasses = {
        sm: "h-6 w-6",
        default: "h-8 w-8",
        lg: "h-10 w-10",
    };

    const fallbackImage = `https://api.dicebear.com/8.x/identicon/svg?seed=${pubkey}`;

    return (
        <Avatar className={cx("rounded-lg", sizeClasses[size], className)}>
            <AvatarImage src={profile?.picture} />
            <AvatarFallback className="rounded-lg">
                {getInitials(profile?.display_name?.toString(), pubkey)}
            </AvatarFallback>
        </Avatar>
    );
}

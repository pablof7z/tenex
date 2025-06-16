import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { ArrowLeft } from "lucide-react";
import { ParticipantAvatarsWithModels } from "../common/ParticipantAvatarsWithModels";
import { Button } from "../ui/button";

interface ChatHeaderProps {
    title: string;
    subtitle?: string;
    participants?: string[];
    messages?: NDKEvent[];
    projectPubkey?: string;
    projectId?: string;
    projectEvent?: NDKEvent;
    availableModels?: Record<string, any>;
    onBack?: () => void;
}

export function ChatHeader({
    title,
    subtitle,
    participants,
    messages,
    projectPubkey,
    projectId,
    projectEvent,
    availableModels,
    onBack,
}: ChatHeaderProps) {
    if (!onBack) return null;

    // // console.log("[ChatHeader] Props:", {
    //     hasMessages: !!messages,
    //     messagesLength: messages?.length,
    //     projectPubkey,
    //     availableModels,
    // });

    return (
        <div className="bg-card border-b border-border/60 backdrop-blur-xl bg-card/95 sticky top-0 z-50">
            <div className="flex items-center justify-between px-3 sm:px-4 py-3 sm:py-4">
                <div className="flex items-center gap-2 sm:gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onBack}
                        className="w-8 h-8 sm:w-9 sm:h-9 hover:bg-accent"
                    >
                        <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                    </Button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg sm:text-xl font-semibold text-foreground truncate max-w-48">
                            {title}
                        </h1>
                        {subtitle && (
                            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
                        )}
                    </div>
                </div>
                {participants && participants.length > 0 && (
                    <ParticipantAvatarsWithModels
                        participants={participants}
                        messages={messages || []}
                        projectPubkey={projectPubkey || ""}
                        projectId={projectId}
                        projectEvent={projectEvent}
                        availableModels={availableModels}
                        maxVisible={4}
                        size="sm"
                    />
                )}
            </div>
        </div>
    );
}

import { ArrowLeft } from "lucide-react";
import { Button } from "../ui/button";
import { ParticipantAvatars } from "../common/ParticipantAvatars";

interface ChatHeaderProps {
  title: string;
  subtitle?: string;
  participants?: string[];
  onBack?: () => void;
}

export function ChatHeader({ title, subtitle, participants, onBack }: ChatHeaderProps) {
  if (!onBack) return null;

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
              <p className="text-xs text-muted-foreground mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {participants && participants.length > 0 && (
          <ParticipantAvatars 
            participants={participants} 
            maxVisible={4}
            size="sm"
          />
        )}
      </div>
    </div>
  );
}
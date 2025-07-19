import type { NDKArticle } from "@nostr-dev-kit/ndk-hooks";
import { BookOpen } from "lucide-react";
import { ParticipantAvatar } from "../common/ParticipantAvatar";
import { useTimeFormat } from "../../hooks/useTimeFormat";

interface DocCardProps {
    article: NDKArticle;
    onClick?: () => void;
}

export function DocCard({ article, onClick }: DocCardProps) {
    const { formatAutoTime } = useTimeFormat({
        includeTime: true,
        use24Hour: true,
    });

    return (
        <div className="border border-border rounded-lg bg-card hover:bg-accent/50 transition-colors cursor-pointer">
            <div className="p-4" onClick={onClick}>
                <div className="flex items-start space-x-3">
                    <ParticipantAvatar pubkey={article.author.pubkey} className="w-8 h-8 flex-shrink-0 mt-1" />
                    
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                            <BookOpen className="w-4 h-4 text-purple-600" />
                            <span className="text-sm font-medium text-foreground">
                                {article.author.profile?.displayName || article.author.npub}
                            </span>
                            <span className="text-sm text-muted-foreground">
                                published an article
                            </span>
                            <span className="text-sm text-muted-foreground">
                                {formatAutoTime(article.created_at!)}
                            </span>
                        </div>
                        
                        <h3 className="font-semibold text-foreground mb-2">
                            {article.title || "Untitled Article"}
                        </h3>
                        
                        {article.summary && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                                {article.summary}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
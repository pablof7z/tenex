import type { NDKProject, NDKArticle } from "@nostr-dev-kit/ndk-hooks";
import { useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { EVENT_KINDS } from "../../lib/constants";
import { BookOpen, Search } from "lucide-react";
import { ParticipantAvatar } from "../common/ParticipantAvatar";
import { Input } from "../ui/input";
import { useNavigation } from "../../contexts/NavigationContext";
import { useTimeFormat } from "../../hooks/useTimeFormat";
import { useState, useMemo } from "react";

interface DocsTabContentProps {
    project: NDKProject;
}

export function DocsTabContent({ project }: DocsTabContentProps) {
    const { goToArticle } = useNavigation();
    const [searchQuery, setSearchQuery] = useState("");
    
    const { formatAutoTime } = useTimeFormat({
        includeTime: true,
        use24Hour: true,
    });

    // Subscribe to articles for this project
    const { events: articles } = useSubscribe<NDKArticle>(
        project ? [{
            kinds: [EVENT_KINDS.ARTICLE],
            ...project.filter(),
            limit: 100,
        }] : false,
        { wrap: true },
        [project?.tagId()]
    );

    // Filter articles based on search query
    const filteredArticles = useMemo(() => {
        if (!searchQuery) return articles;
        
        return articles.filter(article => 
            article.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            article.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            article.content?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [articles, searchQuery]);

    const handleArticleSelect = (article: NDKArticle) => {
        goToArticle(project, article);
    };

    if (articles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <BookOpen className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                    No documentation yet
                </h3>
                <p className="text-muted-foreground max-w-sm">
                    Documentation articles will appear here when published by agents.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Search bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    placeholder="Search documentation..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                />
            </div>

            {/* Articles list */}
            <div className="space-y-3">
                {filteredArticles.map((article) => (
                    <div
                        key={article.id}
                        className="border border-border rounded-lg bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                        onClick={() => handleArticleSelect(article)}
                    >
                        <div className="p-4">
                            <div className="flex items-start space-x-3">
                                <ParticipantAvatar pubkey={article.author.pubkey} className="w-8 h-8 flex-shrink-0 mt-1" />
                                
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-2 mb-1">
                                        <BookOpen className="w-4 h-4 text-purple-600" />
                                        <span className="text-sm font-medium text-foreground">
                                            {article.author.profile?.displayName || article.author.npub}
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
                ))}
            </div>

            {filteredArticles.length === 0 && searchQuery && (
                <div className="text-center py-8">
                    <p className="text-muted-foreground">
                        No articles found matching "{searchQuery}"
                    </p>
                </div>
            )}
        </div>
    );
}
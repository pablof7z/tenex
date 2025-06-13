import { type NDKArticle, type NDKProject } from "@nostr-dev-kit/ndk-hooks";
import { BookOpen } from "lucide-react";

interface DocsTabContentProps {
  articles: NDKArticle[];
  project: NDKProject;
  onArticleSelect: (project: NDKProject, article: NDKArticle) => void;
  formatTime: (timestamp: number) => string;
}

export function DocsTabContent({
  articles,
  project,
  onArticleSelect,
  formatTime,
}: DocsTabContentProps) {
  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 sm:py-32 px-4 sm:px-6 text-center">
        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full flex items-center justify-center mb-4 sm:mb-6 shadow-sm">
          <BookOpen className="w-8 h-8 sm:w-10 sm:h-10 text-purple-600" />
        </div>
        <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2 sm:mb-3">
          No documentation yet
        </h3>
        <p className="text-muted-foreground mb-6 sm:mb-8 max-w-sm leading-relaxed text-sm sm:text-base">
          Documentation articles will appear here when published by agents.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5 sm:space-y-1 px-1 sm:px-2 pt-1 sm:pt-2">
      {articles.map((article) => (
        <div
          key={article.id}
          className="overflow-hidden rounded-lg sm:rounded-xl mx-0.5 sm:mx-1 bg-card border border-border"
        >
          <div
            className="group flex items-center p-2.5 sm:p-3 cursor-pointer transition-all duration-200 ease-out border border-transparent bg-card hover:bg-accent hover:shadow-sm active:scale-[0.98]"
            onClick={() => onArticleSelect(project, article)}
          >
            {/* Doc Icon */}
            <div className="mr-3 sm:mr-4 flex-shrink-0">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-purple-600" />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate text-sm sm:text-[15px] leading-tight">
                {article.title || "Untitled Document"}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                {article.summary ? (
                  <span className="line-clamp-2">{article.summary}</span>
                ) : (
                  <span className="italic">No summary available</span>
                )}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">
                  {formatTime(article.created_at!)}
                </span>
                {article.published_at && article.published_at !== article.created_at && (
                  <>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">
                      Updated {formatTime(article.published_at)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
import type { NDKArticle, NDKProject } from "@nostr-dev-kit/ndk-hooks";
import { ArrowLeft, Calendar, Clock, Copy, Edit3, Hash } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTimeFormat } from "../../hooks/useTimeFormat";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { toast } from "sonner";

interface DocumentationViewProps {
    project: NDKProject;
    article: NDKArticle;
    onBack: () => void;
}

export function DocumentationView({ project, article, onBack }: DocumentationViewProps) {
    const { formatDateOnly, formatTimeOnly } = useTimeFormat({
        use24Hour: true,
    });

    const formatDate = (timestamp?: number) => {
        if (!timestamp) return "Unknown date";
        return formatDateOnly(timestamp);
    };

    const formatTime = (timestamp?: number) => {
        if (!timestamp) return "";
        return formatTimeOnly(timestamp);
    };

    const getReadingTime = (content?: string) => {
        if (!content) return "1 min read";
        const wordsPerMinute = 200;
        const words = content.trim().split(/\s+/).length;
        const minutes = Math.ceil(words / wordsPerMinute);
        return `${minutes} min read`;
    };

    const handleCopySpecEncoding = async () => {
        try {
            const encoded = article.encode();
            await navigator.clipboard.writeText(encoded);
            toast.success("Spec encoding copied to clipboard");
        } catch (_error) {
            toast.error("Failed to copy spec encoding");
        }
    };

    return (
        <div className="h-full flex flex-col bg-background">
            {/* Header */}
            <div className="bg-card border-b border-border backdrop-blur-xl bg-card/95 flex-shrink-0">
                <div className="flex items-center justify-between px-3 sm:px-4 py-3 sm:py-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onBack}
                            className="w-8 h-8 sm:w-9 sm:h-9 text-foreground hover:bg-accent"
                        >
                            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                        </Button>
                        <div>
                            <h1 className="text-sm sm:text-base font-medium text-muted-foreground">
                                {project.title || "Project"} / Documentation
                            </h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleCopySpecEncoding}
                            className="w-8 h-8 sm:w-9 sm:h-9 text-foreground hover:bg-accent"
                            title="Copy spec encoding"
                        >
                            <Copy className="w-4 h-4 sm:w-5 sm:h-5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 sm:w-9 sm:h-9 text-foreground hover:bg-accent"
                            title="Edit document"
                        >
                            <Edit3 className="w-4 h-4 sm:w-5 sm:h-5" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Scrollable Article Content */}
            <div className="flex-1 overflow-y-auto">
                <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                    {/* Title */}
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-4">
                        {article.title || "Untitled Document"}
                    </h1>

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-6 sm:mb-8 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDate(article.created_at)}</span>
                        </div>
                        {article.published_at && article.published_at !== article.created_at && (
                            <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                <span>Updated {formatDate(article.published_at)}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{getReadingTime(article.content)}</span>
                        </div>
                    </div>

                    {/* Summary */}
                    {article.summary && (
                        <div className="bg-muted/30 border border-border rounded-lg p-4 mb-6 sm:mb-8">
                            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                                {article.summary}
                            </p>
                        </div>
                    )}

                    {/* Tags */}
                    {article.tags && article.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-6 sm:mb-8">
                            {article.tags
                                .filter((tag) => tag[0] === "t" && tag[1])
                                .map((tag) => (
                                    <Badge
                                        key={`tag-${tag[1]}`}
                                        variant="secondary"
                                        className="flex items-center gap-1"
                                    >
                                        <Hash className="w-3 h-3" />
                                        {tag[1]}
                                    </Badge>
                                ))}
                        </div>
                    )}

                    {/* Content */}
                    <div className="prose prose-neutral dark:prose-invert max-w-none">
                        {article.content ? (
                            <div className="break-words">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        h1: ({ children }) => (
                                            <h1 className="text-3xl font-bold mt-8 mb-4">
                                                {children}
                                            </h1>
                                        ),
                                        h2: ({ children }) => (
                                            <h2 className="text-2xl font-semibold mt-6 mb-3">
                                                {children}
                                            </h2>
                                        ),
                                        h3: ({ children }) => (
                                            <h3 className="text-xl font-semibold mt-4 mb-2">
                                                {children}
                                            </h3>
                                        ),
                                        p: ({ children }) => (
                                            <p className="mb-4 leading-relaxed">{children}</p>
                                        ),
                                        ul: ({ children }) => (
                                            <ul className="list-disc pl-6 mb-4 space-y-2">
                                                {children}
                                            </ul>
                                        ),
                                        ol: ({ children }) => (
                                            <ol className="list-decimal pl-6 mb-4 space-y-2">
                                                {children}
                                            </ol>
                                        ),
                                        li: ({ children }) => (
                                            <li className="leading-relaxed">{children}</li>
                                        ),
                                        code: ({ className, children, ...props }) => {
                                            const isInline = !className?.startsWith("language-");
                                            if (isInline) {
                                                return (
                                                    <code
                                                        className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono"
                                                        {...props}
                                                    >
                                                        {children}
                                                    </code>
                                                );
                                            }
                                            // Block code (inside pre) - no background
                                            return (
                                                <code
                                                    className={`font-mono text-sm ${className || ""}`}
                                                    {...props}
                                                >
                                                    {children}
                                                </code>
                                            );
                                        },
                                        pre: ({ children }) => (
                                            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto font-mono text-sm mb-4 whitespace-pre">
                                                {children}
                                            </pre>
                                        ),
                                        blockquote: ({ children }) => (
                                            <blockquote className="border-l-4 border-muted-foreground/30 pl-4 italic mb-4">
                                                {children}
                                            </blockquote>
                                        ),
                                        a: ({ href, children }) => (
                                            <a
                                                href={href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:underline"
                                            >
                                                {children}
                                            </a>
                                        ),
                                        table: ({ children }) => (
                                            <div className="overflow-x-auto mb-4">
                                                <table className="min-w-full border-collapse">
                                                    {children}
                                                </table>
                                            </div>
                                        ),
                                        th: ({ children }) => (
                                            <th className="border border-border px-4 py-2 text-left font-semibold bg-muted">
                                                {children}
                                            </th>
                                        ),
                                        td: ({ children }) => (
                                            <td className="border border-border px-4 py-2">
                                                {children}
                                            </td>
                                        ),
                                    }}
                                >
                                    {article.content}
                                </ReactMarkdown>
                            </div>
                        ) : (
                            <p className="text-muted-foreground italic">
                                No content available for this document.
                            </p>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="mt-12 pt-6 border-t border-border">
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>
                                Published at {formatTime(article.created_at)} on{" "}
                                {formatDate(article.created_at)}
                            </span>
                            {article.published_at &&
                                article.published_at !== article.created_at && (
                                    <span>Last updated at {formatTime(article.published_at)}</span>
                                )}
                        </div>
                    </div>
                </article>
            </div>
        </div>
    );
}

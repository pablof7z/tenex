import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { NostrTemplate } from "@/types/template";
import { useProfileValue } from "@nostr-dev-kit/ndk-hooks";
import { Calendar, ExternalLink, GitBranch, User } from "lucide-react";
import React from "react";

interface TemplateCardProps {
    template: NostrTemplate;
    onClick?: (template: NostrTemplate) => void;
    isSelected?: boolean;
}

export function TemplateCard({ template, onClick, isSelected = false }: TemplateCardProps) {
    // Fetch author profile using NDK hooks
    const profile = useProfileValue(template.authorPubkey);

    // Format creation date
    const formatDate = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    // Extract display name from profile
    const getDisplayName = () => {
        if (profile?.displayName) return profile.displayName;
        if (profile?.name) return profile.name;
        return template.authorPubkey.slice(0, 8) + "...";
    };

    // Handle card click
    const handleClick = () => {
        if (onClick) {
            onClick(template);
        }
    };

    // Convert git+https:// URL to regular https:// for display
    const getDisplayUrl = (repoUrl: string) => {
        return repoUrl.replace(/^git\+/, "");
    };

    return (
        <Card
            className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                isSelected ? "ring-2 ring-primary ring-offset-2" : ""
            }`}
            onClick={handleClick}
        >
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <CardTitle className="text-lg font-semibold line-clamp-1">{template.name}</CardTitle>
                        <CardDescription className="mt-1 break-words">{template.description}</CardDescription>
                    </div>
                    {template.image && (
                        <div className="ml-3 flex-shrink-0">
                            <img
                                src={template.image}
                                alt={`${template.name} preview`}
                                className="h-12 w-12 rounded-md object-cover"
                                onError={(e) => {
                                    // Hide image on error
                                    e.currentTarget.style.display = "none";
                                }}
                            />
                        </div>
                    )}
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Tags */}
                {template.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {template.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                            </Badge>
                        ))}
                        {template.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                                +{template.tags.length - 3} more
                            </Badge>
                        )}
                    </div>
                )}

                {/* Repository URL */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <GitBranch className="h-4 w-4 flex-shrink-0" />
                    <a
                        href={getDisplayUrl(template.repoUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-foreground transition-colors min-w-0"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <span className="truncate">{getDisplayUrl(template.repoUrl)}</span>
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                </div>

                {/* Author and Date */}
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                            <AvatarImage src={profile?.image} alt={getDisplayName()} />
                            <AvatarFallback className="text-xs">
                                <User className="h-3 w-3" />
                            </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{getDisplayName()}</span>
                    </div>

                    <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(template.createdAt)}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

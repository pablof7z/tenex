import { memo } from "react";
import type { NDKProjectTemplate } from "@nostr-dev-kit/ndk-hooks";
import { Clock, ExternalLink, GitBranch } from "lucide-react";
import { StringUtils } from "@tenex/shared";
import { useTimeFormat } from "../../hooks/useTimeFormat";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Button } from "../ui/button";
import { SelectableCard } from "../common/SelectableCard";

interface TemplateCardProps {
    template: NDKProjectTemplate;
    isSelected?: boolean;
    onSelect?: (template: NDKProjectTemplate) => void;
    showSelect?: boolean;
}

export const TemplateCard = memo(function TemplateCard({
    template,
    isSelected = false,
    onSelect,
    showSelect = false,
}: TemplateCardProps) {
    const { formatAutoTime } = useTimeFormat({ includeTime: false });

    const getInitials = (name: string) => {
        return StringUtils.getInitials(name);
    };

    const getRepoUrl = () => {
        const repo = template.tagValue("repo");
        if (!repo) return null;
        return repo.startsWith("git+") ? repo.slice(4) : repo;
    };

    const renderIcon = () => {
        if (template.tagValue("image")) {
            return (
                <img
                    src={template.tagValue("image")}
                    alt={template.tagValue("title") || "Template"}
                    className="w-10 h-10 rounded-lg object-cover"
                />
            );
        }
        return (
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-semibold text-sm">
                    {getInitials(template.tagValue("title") || "Template")}
                </span>
            </div>
        );
    };

    const renderDescription = () => {
        const description = template.tagValue("description");
        if (!description) return null;

        return (
            <div>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{description}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Avatar className="w-4 h-4">
                        <AvatarFallback className="text-xs bg-muted">
                            {getInitials(
                                template.author?.profile?.name || template.author?.npub || "A"
                            )}
                        </AvatarFallback>
                    </Avatar>
                    <span className="truncate">
                        {template.author?.profile?.name ||
                            (template.author?.npub
                                ? StringUtils.truncate(template.author.npub, 12)
                                : null) ||
                            "Unknown"}
                    </span>
                </div>
            </div>
        );
    };

    const renderMeta = () => (
        <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{formatAutoTime(template.created_at!)}</span>
        </div>
    );

    const renderTags = () => {
        const tags = template.tags
            .filter((tag) => tag[0] === "t" && tag[1])
            .map((tag) => tag[1] as string);
        return tags.slice(0, 6);
    };

    const renderActions = () => {
        if (!getRepoUrl()) return null;

        return (
            <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                    e.stopPropagation();
                    window.open(getRepoUrl()!, "_blank");
                }}
            >
                <GitBranch className="w-3 h-3 mr-1" />
                Repo
                <ExternalLink className="w-3 h-3 ml-1" />
            </Button>
        );
    };

    if (!showSelect) {
        // Render non-selectable card with custom layout
        return (
            <div className="p-4 border rounded-lg hover:bg-accent transition-colors">
                <div className="flex items-start gap-3 mb-3">
                    {renderIcon()}
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate text-sm">
                            {template.tagValue("title") || "Untitled Template"}
                        </h3>
                        {renderMeta()}
                    </div>
                </div>
                {renderDescription()}
                <div className="flex justify-end">{renderActions()}</div>
            </div>
        );
    }

    return (
        <SelectableCard
            item={template}
            isSelected={isSelected}
            onSelect={onSelect || (() => {})}
            onDeselect={() => {}}
            renderIcon={renderIcon}
            renderTitle={(t) => t.tagValue("title") || "Untitled Template"}
            renderDescription={renderDescription}
            renderMeta={renderMeta}
            renderTags={renderTags}
            renderActions={renderActions}
            clickable={true}
            showSelectButton={true}
        />
    );
});

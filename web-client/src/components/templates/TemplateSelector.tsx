import type { NDKProjectTemplate } from "@nostr-dev-kit/ndk-hooks";
import { Search } from "lucide-react";
import { useTemplates } from "../../hooks/useTemplates";
import { ItemSelector } from "../common/ItemSelector";
import { TemplateCard } from "./TemplateCard";

interface TemplateSelectorProps {
    selectedTemplate?: NDKProjectTemplate;
    onTemplateSelect: (template: NDKProjectTemplate | undefined) => void;
}

export function TemplateSelector({ selectedTemplate, onTemplateSelect }: TemplateSelectorProps) {
    const { templates } = useTemplates({
        limit: 100,
    });

    const handleItemsChange = (items: NDKProjectTemplate[]) => {
        // For single selection, take the first item or undefined if empty
        onTemplateSelect(items.length > 0 ? items[0] : undefined);
    };

    const getItemTags = (template: NDKProjectTemplate): string[] => {
        return template.tags
            .filter((tag) => tag[0] === "t" && tag[1])
            .map((tag) => tag[1] as string);
    };

    const searchFilter = (template: NDKProjectTemplate, searchTerm: string): boolean => {
        const title = template.tagValue("title") || "";
        const description = template.tagValue("description") || "";
        const tags = getItemTags(template).join(" ");
        const searchableText = `${title} ${description} ${tags}`.toLowerCase();
        return searchableText.includes(searchTerm.toLowerCase());
    };

    const renderCard = (template: NDKProjectTemplate, isSelected: boolean) => (
        <TemplateCard
            template={template}
            isSelected={isSelected}
            onSelect={(selectedTemplate) => {
                // Toggle selection: if already selected, deselect; otherwise select
                onTemplateSelect(isSelected ? undefined : selectedTemplate);
            }}
            showSelect={true}
        />
    );

    return (
        <div className="space-y-4">
            <ItemSelector
                items={templates}
                selectedItems={selectedTemplate ? [selectedTemplate] : []}
                onItemsChange={handleItemsChange}
                searchPlaceholder="Search templates..."
                filterLabel="Filters"
                emptyStateIcon={<Search className="w-6 h-6 text-slate-400" />}
                emptyStateTitle="No templates found"
                emptyStateDescription="No templates are available yet"
                renderCard={renderCard}
                getItemId={(template) => template.tagId()}
                getItemTags={getItemTags}
                searchFilter={searchFilter}
                filterTagLabel="Filter by technology:"
            />
        </div>
    );
}

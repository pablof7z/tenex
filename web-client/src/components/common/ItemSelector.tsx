import { Filter } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { EmptyState } from "./EmptyState";
import { SearchBar } from "./SearchBar";

export interface ItemSelectorProps<T> {
    items: T[];
    selectedItems: T[];
    onItemsChange: (items: T[]) => void;
    searchPlaceholder: string;
    filterLabel: string;
    emptyStateIcon: ReactNode;
    emptyStateTitle: string;
    emptyStateDescription?: string;
    renderCard: (item: T, isSelected: boolean) => ReactNode;
    getItemId: (item: T) => string;
    getItemTags: (item: T) => string[];
    searchFilter: (item: T, searchTerm: string) => boolean;
    filterTagLabel?: string;
}

export function ItemSelector<T>({
    items,
    selectedItems,
    onItemsChange,
    searchPlaceholder,
    filterLabel,
    emptyStateIcon,
    emptyStateTitle,
    emptyStateDescription,
    renderCard,
    getItemId,
    getItemTags,
    searchFilter,
    filterTagLabel = "Filter by tag:",
}: ItemSelectorProps<T>) {
    const [search, setSearch] = useState("");
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [showFilters, setShowFilters] = useState(false);

    const filteredItems = useMemo(() => {
        let filtered = items;

        if (search.trim()) {
            filtered = filtered.filter((item) => searchFilter(item, search));
        }

        if (selectedTags.length > 0) {
            filtered = filtered.filter((item) => {
                const itemTags = getItemTags(item);
                return selectedTags.some((tag) => itemTags.includes(tag));
            });
        }

        return filtered;
    }, [items, search, selectedTags, searchFilter, getItemTags]);

    const allTags = useMemo(() => {
        const tagSet = new Set<string>();
        for (const item of items) {
            for (const tag of getItemTags(item)) {
                tagSet.add(tag);
            }
        }
        return Array.from(tagSet).sort();
    }, [items, getItemTags]);

    const handleTagToggle = (tag: string) => {
        setSelectedTags((prev) =>
            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
        );
    };

    const clearFilters = () => {
        setSearch("");
        setSelectedTags([]);
    };

    const clearAllSelections = () => {
        onItemsChange([]);
    };

    const hasActiveFilters = search.length > 0 || selectedTags.length > 0;

    const isItemSelected = (item: T) => {
        const itemId = getItemId(item);
        return selectedItems.some((selected) => getItemId(selected) === itemId);
    };

    return (
        <div className="space-y-4">
            {/* Search and Filter Controls */}
            <div className="space-y-3">
                {/* Search Bar */}
                <SearchBar value={search} onChange={setSearch} placeholder={searchPlaceholder} />

                {/* Filter Toggle */}
                <div className="flex items-center justify-between">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowFilters(!showFilters)}
                        className="h-8"
                    >
                        <Filter className="w-3 h-3 mr-2" />
                        {filterLabel}
                        {selectedTags.length > 0 && (
                            <Badge variant="secondary" className="ml-2 h-4 px-1.5 text-xs">
                                {selectedTags.length}
                            </Badge>
                        )}
                    </Button>
                    {hasActiveFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearFilters}
                            className="h-8 text-slate-600"
                        >
                            Clear filters
                        </Button>
                    )}
                </div>

                {/* Tag Filters */}
                {showFilters && allTags.length > 0 && (
                    <div className="p-3 bg-slate-50 rounded-lg border">
                        <h4 className="text-sm font-medium text-slate-700 mb-2">
                            {filterTagLabel}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {allTags.map((tag) => (
                                <Badge
                                    key={tag}
                                    variant={selectedTags.includes(tag) ? "default" : "outline"}
                                    className="cursor-pointer hover:bg-slate-200 text-xs h-6 px-2"
                                    onClick={() => handleTagToggle(tag)}
                                >
                                    {tag}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Selection Summary */}
            <div className="flex items-center justify-between text-sm text-slate-600">
                <span>
                    {filteredItems.length} {filteredItems.length === 1 ? "item" : "items"} available
                    {selectedItems.length > 0 && (
                        <span className="text-blue-600 font-medium ml-2">
                            • {selectedItems.length} selected
                        </span>
                    )}
                </span>
                {selectedItems.length > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAllSelections}
                        className="h-7 text-slate-600"
                    >
                        Clear all selections
                    </Button>
                )}
            </div>

            {/* Items List */}
            {filteredItems.length === 0 ? (
                <EmptyState
                    icon={emptyStateIcon}
                    title={emptyStateTitle}
                    description={
                        emptyStateDescription ||
                        (hasActiveFilters
                            ? "Try adjusting your search or filters"
                            : "No items are available yet")
                    }
                    action={
                        hasActiveFilters
                            ? { label: "Clear filters", onClick: clearFilters }
                            : undefined
                    }
                />
            ) : (
                <div className="space-y-3">
                    {filteredItems.map((item) => (
                        <div key={getItemId(item)}>{renderCard(item, isItemSelected(item))}</div>
                    ))}
                </div>
            )}
        </div>
    );
}

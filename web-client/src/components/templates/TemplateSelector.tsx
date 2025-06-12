import type { NDKProjectTemplate } from "@nostr-dev-kit/ndk-hooks";
import { Filter, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useTemplates } from "../../hooks/useTemplates";
import { SearchBar } from "../common/SearchBar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { TemplateCard } from "./TemplateCard";

interface TemplateSelectorProps {
	selectedTemplate?: NDKProjectTemplate;
	onTemplateSelect: (template: NDKProjectTemplate | undefined) => void;
}

export function TemplateSelector({
	selectedTemplate,
	onTemplateSelect,
}: TemplateSelectorProps) {
	const [search, setSearch] = useState("");
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [showFilters, setShowFilters] = useState(false);

	const { templates } = useTemplates({
		search,
		tags: selectedTags,
		limit: 100,
	});

	const allTags = useMemo(() => {
		const tagSet = new Set<string>();
		templates.forEach((template) => {
			if (template.tags) {
				template.tags
					.filter((tag) => tag[0] === "t")
					.forEach((tag) => tagSet.add(tag[1]));
			}
		});
		return Array.from(tagSet).sort();
	}, [templates]);

	const handleTagToggle = (tag: string) => {
		setSelectedTags((prev) =>
			prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
		);
	};

	const clearFilters = () => {
		setSearch("");
		setSelectedTags([]);
	};

	const hasActiveFilters = search.length > 0 || selectedTags.length > 0;

	return (
		<div className="space-y-4">
			{/* Search and Filter Controls */}
			<div className="space-y-3">
				{/* Search Bar */}
				<SearchBar
					value={search}
					onChange={setSearch}
					placeholder="Search templates..."
				/>

				{/* Filter Toggle */}
				<div className="flex items-center justify-between">
					<Button
						variant="outline"
						size="sm"
						onClick={() => setShowFilters(!showFilters)}
						className="h-8"
					>
						<Filter className="w-3 h-3 mr-2" />
						Filters
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
							Filter by technology:
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

			{/* Results Summary */}
			<div className="flex items-center justify-between text-sm text-slate-600">
				<span>
					{templates.length} template{templates.length !== 1 ? "s" : ""} found
				</span>
				{selectedTemplate && (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => onTemplateSelect(undefined)}
						className="h-7 text-slate-600"
					>
						Clear selection
					</Button>
				)}
			</div>

			{/* Templates Grid */}
			{templates.length === 0 ? (
				<div className="text-center py-12">
					<div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
						<Search className="w-6 h-6 text-slate-400" />
					</div>
					<h3 className="text-lg font-medium text-slate-900 mb-2">
						No templates found
					</h3>
					<p className="text-slate-600 mb-4">
						{hasActiveFilters
							? "Try adjusting your search or filters"
							: "No templates are available yet"}
					</p>
					{hasActiveFilters && (
						<Button variant="outline" onClick={clearFilters}>
							Clear filters
						</Button>
					)}
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{templates.map((template) => (
						<TemplateCard
							key={template.tagId()}
							template={template}
							isSelected={selectedTemplate?.tagId() === template.tagId()}
							onSelect={onTemplateSelect}
							showSelect={true}
						/>
					))}
				</div>
			)}
		</div>
	);
}

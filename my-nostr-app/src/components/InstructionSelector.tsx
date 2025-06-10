import { FileText, Filter, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { NDKAgent } from "../events/agent";
import { useInstructions } from "../hooks/useInstructions";
import type { NDKLLMRule } from "../types/template";
import { InstructionCard } from "./InstructionCard";
import { InstructionPreviewDialog } from "./InstructionPreviewDialog";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface InstructionWithAgents extends NDKLLMRule {
	assignedAgents?: string[];
}

interface InstructionSelectorProps {
	selectedInstructions: InstructionWithAgents[];
	selectedAgents: NDKAgent[];
	onInstructionsChange: (instructions: InstructionWithAgents[]) => void;
}

export function InstructionSelector({
	selectedInstructions,
	selectedAgents,
	onInstructionsChange,
}: InstructionSelectorProps) {
	const [search, setSearch] = useState("");
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [showFilters, setShowFilters] = useState(false);
	const [previewInstruction, setPreviewInstruction] =
		useState<NDKLLMRule | null>(null);

	const { instructions } = useInstructions({
		search,
		tags: selectedTags,
		limit: 100,
	});

	const allTags = useMemo(() => {
		const tagSet = new Set<string>();
		instructions.forEach((instruction) => {
			if (instruction.hashtags) {
				instruction.hashtags.forEach((tag) => tagSet.add(tag));
			}
		});
		return Array.from(tagSet).sort();
	}, [instructions]);

	const handleTagToggle = (tag: string) => {
		setSelectedTags((prev) =>
			prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
		);
	};

	const clearFilters = () => {
		setSearch("");
		setSelectedTags([]);
	};

	const handleInstructionSelect = (
		instruction: NDKLLMRule,
		agentNames: string[],
	) => {
		if (!selectedInstructions.find((i) => i.id === instruction.id)) {
			const instructionWithAgents = {
				...instruction,
				assignedAgents: agentNames,
			};
			onInstructionsChange([...selectedInstructions, instructionWithAgents]);
		}
	};

	const handleInstructionDeselect = (instruction: NDKLLMRule) => {
		onInstructionsChange(
			selectedInstructions.filter((i) => i.id !== instruction.id),
		);
	};

	const clearAllSelections = () => {
		onInstructionsChange([]);
	};

	const handlePreview = (instruction: NDKLLMRule) => {
		setPreviewInstruction(instruction);
	};

	const hasActiveFilters = search.length > 0 || selectedTags.length > 0;

	return (
		<div className="space-y-4">
			{/* Search and Filter Controls */}
			<div className="space-y-3">
				{/* Search Bar */}
				<div className="relative">
					<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
					<Input
						placeholder="Search instructions..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="pl-10 pr-10"
					/>
					{search && (
						<Button
							variant="ghost"
							size="icon"
							className="absolute right-1 top-1/2 transform -translate-y-1/2 w-6 h-6"
							onClick={() => setSearch("")}
						>
							<X className="w-3 h-3" />
						</Button>
					)}
				</div>

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
							Filter by category:
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
					{instructions.length} instruction
					{instructions.length !== 1 ? "s" : ""} available
					{selectedInstructions.length > 0 && (
						<span className="text-blue-600 font-medium ml-2">
							• {selectedInstructions.length} selected
						</span>
					)}
				</span>
				{selectedInstructions.length > 0 && (
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

			{/* Instructions List */}
			{instructions.length === 0 ? (
				<div className="text-center py-12">
					<div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
						<FileText className="w-6 h-6 text-slate-400" />
					</div>
					<h3 className="text-lg font-medium text-slate-900 mb-2">
						No instructions found
					</h3>
					<p className="text-slate-600 mb-4">
						{hasActiveFilters
							? "Try adjusting your search or filters"
							: "No instructions are available yet"}
					</p>
					{hasActiveFilters && (
						<Button variant="outline" onClick={clearFilters}>
							Clear filters
						</Button>
					)}
				</div>
			) : (
				<div className="space-y-3">
					{instructions.map((instruction) => (
						<InstructionCard
							key={instruction.id}
							instruction={instruction}
							isSelected={selectedInstructions.some(
								(i) => i.id === instruction.id,
							)}
							selectedAgents={selectedAgents}
							onSelect={handleInstructionSelect}
							onDeselect={handleInstructionDeselect}
							onPreview={handlePreview}
						/>
					))}
				</div>
			)}

			{/* Preview Dialog */}
			<InstructionPreviewDialog
				instruction={previewInstruction}
				open={!!previewInstruction}
				onOpenChange={(open) => !open && setPreviewInstruction(null)}
			/>
		</div>
	);
}

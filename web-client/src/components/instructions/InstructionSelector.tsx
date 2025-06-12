import { FileText } from "lucide-react";
import { useState } from "react";
import type { NDKAgent } from "../../events/agent";
import { useInstructions } from "../../hooks/useInstructions";
import type { NDKLLMRule } from "../../types/template";
import { ItemSelector } from "../common/ItemSelector";
import { InstructionCard } from "./InstructionCard";
import { InstructionPreviewDialog } from "./InstructionPreviewDialog";

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
	const [previewInstruction, setPreviewInstruction] =
		useState<NDKLLMRule | null>(null);

	// Get all instructions, filtering will be done by ItemSelector
	const { instructions } = useInstructions({
		limit: 100,
	});

	const handleInstructionSelect = (
		instruction: NDKLLMRule,
		agentNames: string[],
	) => {
		if (!selectedInstructions.find((i) => i.id === instruction.id)) {
			const instructionWithAgents = Object.assign(
				Object.create(Object.getPrototypeOf(instruction)),
				instruction,
				{ assignedAgents: agentNames },
			) as InstructionWithAgents;
			onInstructionsChange([...selectedInstructions, instructionWithAgents]);
		}
	};

	const handleInstructionDeselect = (instruction: NDKLLMRule) => {
		onInstructionsChange(
			selectedInstructions.filter((i) => i.id !== instruction.id),
		);
	};

	const handlePreview = (instruction: NDKLLMRule) => {
		setPreviewInstruction(instruction);
	};

	return (
		<>
			<ItemSelector
				items={instructions}
				selectedItems={selectedInstructions}
				onItemsChange={onInstructionsChange}
				searchPlaceholder="Search instructions..."
				filterLabel="Filters"
				filterTagLabel="Filter by category:"
				emptyStateIcon={<FileText className="w-6 h-6 text-slate-400" />}
				emptyStateTitle="No instructions found"
				renderCard={(instruction, isSelected) => (
					<InstructionCard
						instruction={instruction}
						isSelected={isSelected}
						selectedAgents={selectedAgents}
						onSelect={handleInstructionSelect}
						onDeselect={handleInstructionDeselect}
						onPreview={handlePreview}
					/>
				)}
				getItemId={(instruction) => instruction.id || ""}
				getItemTags={(instruction) => instruction.hashtags || []}
				searchFilter={(instruction, searchTerm) => {
					const searchLower = searchTerm.toLowerCase();
					return (
						instruction.title?.toLowerCase().includes(searchLower) ||
						instruction.description?.toLowerCase().includes(searchLower) ||
						false
					);
				}}
			/>

			{/* Preview Dialog */}
			<InstructionPreviewDialog
				instruction={previewInstruction}
				open={!!previewInstruction}
				onOpenChange={(open) => !open && setPreviewInstruction(null)}
			/>
		</>
	);
}

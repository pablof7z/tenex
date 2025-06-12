import type {
	InstructionWithAgents,
	ProjectFormData,
} from "../../types/template";
import { InstructionSelector } from "../instructions/InstructionSelector";

interface InstructionSelectionStepProps {
	formData: ProjectFormData;
	onFormDataChange: (data: Partial<ProjectFormData>) => void;
}

export function InstructionSelectionStep({
	formData,
	onFormDataChange,
}: InstructionSelectionStepProps) {
	return (
		<div className="space-y-4">
			<p className="text-sm text-slate-600">
				Select instruction sets to add to your project. Instructions help define
				coding standards, best practices, and project-specific guidelines.
			</p>
			<InstructionSelector
				selectedInstructions={formData.selectedInstructions || []}
				selectedAgents={formData.selectedAgents || []}
				onInstructionsChange={(instructions: InstructionWithAgents[]) =>
					onFormDataChange({ selectedInstructions: instructions })
				}
			/>
		</div>
	);
}

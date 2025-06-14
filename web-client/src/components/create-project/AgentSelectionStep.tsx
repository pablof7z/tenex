import type { NDKAgent } from "../../events/agent";
import type { ProjectFormData } from "../../types/template";
import { AgentSelector } from "../agents/AgentSelector";

interface AgentSelectionStepProps {
    formData: ProjectFormData;
    onFormDataChange: (data: Partial<ProjectFormData>) => void;
}

export function AgentSelectionStep({ formData, onFormDataChange }: AgentSelectionStepProps) {
    return (
        <div className="space-y-4">
            <p className="text-sm text-slate-600">
                Select AI agents that will work on your project. These agents will be available for
                task assignment and instruction targeting.
            </p>
            <AgentSelector
                selectedAgents={formData.selectedAgents || []}
                onAgentsChange={(agents: NDKAgent[]) =>
                    onFormDataChange({ selectedAgents: agents })
                }
            />
        </div>
    );
}

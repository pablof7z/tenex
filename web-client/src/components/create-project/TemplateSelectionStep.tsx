import type { NDKProjectTemplate } from "@nostr-dev-kit/ndk-hooks";
import type { ProjectFormData } from "../../types/template";
import { TemplateSelector } from "../templates/TemplateSelector";

interface TemplateSelectionStepProps {
    formData: ProjectFormData;
    onFormDataChange: (data: Partial<ProjectFormData>) => void;
}

export function TemplateSelectionStep({ formData, onFormDataChange }: TemplateSelectionStepProps) {
    return (
        <div className="space-y-4">
            <p className="text-sm text-slate-600">
                Choose a template to start your project, or skip to create an empty project.
            </p>
            <TemplateSelector
                selectedTemplate={formData.selectedTemplate}
                onTemplateSelect={(template: NDKProjectTemplate | undefined) =>
                    onFormDataChange({ selectedTemplate: template })
                }
            />
        </div>
    );
}

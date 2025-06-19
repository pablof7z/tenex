import { NDKProject, useNDK } from "@nostr-dev-kit/ndk-hooks";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";
import type {
    CreateProjectDialogProps,
    CreateProjectStep,
    ProjectFormData,
} from "../../types/template";
import { AgentSelectionStep } from "../create-project/AgentSelectionStep";
import { ConfirmationStep } from "../create-project/ConfirmationStep";
import { InstructionSelectionStep } from "../create-project/InstructionSelectionStep";
import { ProjectDetailsStep } from "../create-project/ProjectDetailsStep";
import { TemplateSelectionStep } from "../create-project/TemplateSelectionStep";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

export function CreateProjectDialog({
    open,
    onOpenChange,
    onProjectCreated,
}: CreateProjectDialogProps) {
    const { ndk } = useNDK();
    const [step, setStep] = useState<CreateProjectStep>("details");
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState<ProjectFormData>({
        name: "",
        description: "",
        hashtags: "",
        repoUrl: "",
        imageUrl: "",
        selectedTemplate: undefined,
        selectedInstructions: [],
    });

    const resetForm = () => {
        setStep("details");
        setFormData({
            name: "",
            description: "",
            hashtags: "",
            repoUrl: "",
            imageUrl: "",
            selectedTemplate: undefined,
            selectedAgents: [],
            selectedInstructions: [],
        });
        setIsCreating(false);
    };

    const handleClose = () => {
        if (!isCreating) {
            resetForm();
            onOpenChange(false);
        }
    };

    const handleNext = () => {
        if (step === "details") {
            if (!formData.repoUrl && !formData.selectedTemplate) {
                setStep("template");
            } else {
                setStep("agents");
            }
        } else if (step === "template") {
            setStep("agents");
        } else if (step === "agents") {
            setStep("instructions");
        } else if (step === "instructions") {
            setStep("confirm");
        }
    };

    const handleBack = () => {
        if (step === "template") {
            setStep("details");
        } else if (step === "agents") {
            if (!formData.repoUrl && !formData.selectedTemplate) {
                setStep("template");
            } else {
                setStep("details");
            }
        } else if (step === "instructions") {
            setStep("agents");
        } else if (step === "confirm") {
            setStep("instructions");
        }
    };

    const handleCreateProject = async () => {
        if (!ndk || !formData.name.trim()) return;

        setIsCreating(true);
        try {
            const project = new NDKProject(ndk);

            project.title = formData.name.trim();
            project.content =
                formData.description.trim() || `A new TENEX project: ${formData.name}`;

            if (formData.hashtags.trim()) {
                const hashtagArray = formData.hashtags
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter((tag) => tag.length > 0);
                project.hashtags = hashtagArray;
            }

            if (formData.repoUrl?.trim()) {
                project.repo = formData.repoUrl.trim();
            }

            if (formData.imageUrl?.trim()) {
                project.picture = formData.imageUrl.trim();
            }

            if (formData.selectedTemplate) {
                project.tags.push(["template", formData.selectedTemplate.tagId()]);
            }

            if (formData.selectedAgents && formData.selectedAgents.length > 0) {
                for (const agent of formData.selectedAgents) {
                    project.tags.push(["agent", agent.id]);
                }
            }

            if (formData.selectedInstructions && formData.selectedInstructions.length > 0) {
                for (const instruction of formData.selectedInstructions) {
                    if (instruction.assignedAgents && instruction.assignedAgents.length > 0) {
                        // Add rule tag with agent names
                        project.tags.push(["rule", instruction.id, ...instruction.assignedAgents]);
                    } else {
                        // Add rule tag for all agents
                        project.tags.push(["rule", instruction.id]);
                    }
                }
            }

            // No need to sign explicitly - publish() will sign with the current user's key
            project.publish();

            resetForm();
            onOpenChange(false);
            onProjectCreated?.();
        } catch (_error) {
        } finally {
            setIsCreating(false);
        }
    };

    const isStepValid = () => {
        if (step === "details") {
            return formData.name.trim().length > 0;
        }
        return true;
    };

    const getStepTitle = () => {
        switch (step) {
            case "details":
                return "Project Details";
            case "template":
                return "Choose Template";
            case "agents":
                return "Select Agents";
            case "instructions":
                return "Select Instructions";
            case "confirm":
                return "Confirm & Create";
            default:
                return "Create Project";
        }
    };

    const handleFormDataChange = (data: Partial<ProjectFormData>) => {
        setFormData((prev) => ({ ...prev, ...data }));
    };

    const renderStepContent = () => {
        switch (step) {
            case "details":
                return (
                    <ProjectDetailsStep
                        formData={formData}
                        onFormDataChange={handleFormDataChange}
                    />
                );

            case "template":
                return (
                    <TemplateSelectionStep
                        formData={formData}
                        onFormDataChange={handleFormDataChange}
                    />
                );

            case "agents":
                return (
                    <AgentSelectionStep
                        formData={formData}
                        onFormDataChange={handleFormDataChange}
                    />
                );

            case "instructions":
                return (
                    <InstructionSelectionStep
                        formData={formData}
                        onFormDataChange={handleFormDataChange}
                    />
                );

            case "confirm":
                return <ConfirmationStep formData={formData} />;

            default:
                return null;
        }
    };

    const getDialogMaxWidth = () => {
        return step === "template" || step === "agents" || step === "instructions"
            ? "max-w-4xl"
            : "max-w-lg";
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent
                className={`${getDialogMaxWidth()} max-h-[90vh] overflow-hidden flex flex-col`}
            >
                <DialogHeader>
                    <DialogTitle>{getStepTitle()}</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto">{renderStepContent()}</div>

                <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-2">
                        {step !== "details" && (
                            <Button variant="outline" onClick={handleBack} disabled={isCreating}>
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back
                            </Button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {step !== "confirm" ? (
                            <Button onClick={handleNext} disabled={!isStepValid() || isCreating}>
                                Next
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        ) : (
                            <Button
                                variant="primary"
                                onClick={handleCreateProject}
                                disabled={!isStepValid() || isCreating}
                            >
                                {isCreating ? "Creating..." : "Create Project"}
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

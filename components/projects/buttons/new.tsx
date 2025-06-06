"use client";

import { useNDK, useNDKCurrentUser } from "@nostr-dev-kit/ndk-hooks";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useState } from "react";
import { TemplateSelector } from "@/components/templates/TemplateSelector";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useConfig } from "@/hooks/useConfig";
import { NDKProject } from "@/lib/nostr/events/project";
import type { NostrTemplate } from "@/types/template";

interface NewProjectButtonProps {
    onProjectCreated?: () => void;
}

export function NewProjectButton({ onProjectCreated }: NewProjectButtonProps) {
    const { ndk } = useNDK();
    const currentUser = useNDKCurrentUser();
    const { toast } = useToast();
    const { getApiUrl, isLoading: isConfigLoading, isReady: isConfigReady, error: configError } = useConfig();

    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        hashtags: "",
        repoUrl: "",
        selectedTemplate: null as NostrTemplate | null,
    });
    const [formError, setFormError] = useState<string | null>(null);

    // Wizard state management
    const [currentStep, setCurrentStep] = useState(1);
    const [maxStep, setMaxStep] = useState(1);

    // Step navigation functions
    const goToStep = (step: number) => {
        if (step >= 1 && step <= maxStep) {
            setCurrentStep(step);
        }
    };

    const nextStep = () => {
        if (currentStep < 3) {
            const newStep = currentStep + 1;
            setCurrentStep(newStep);
            setMaxStep(Math.max(maxStep, newStep));
        }
    };

    const prevStep = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    // Template selection logic
    const handleTemplateSelect = (template: NostrTemplate) => {
        setFormData({ ...formData, selectedTemplate: template });
    };

    // Check if we should show template selection step
    const shouldShowTemplateStep = !formData.repoUrl;

    // Validation for current step
    const isStepValid = () => {
        if (currentStep === 1) {
            return formData.name && formData.description;
        }
        return true;
    };

    const handleCreateProject = async () => {
        setFormError(null);
        if (!formData.name || !formData.description) {
            setFormError("Project name and description are required.");
            return;
        }

        if (!ndk || !currentUser) {
            setFormError("You must be logged in to create a project.");
            return;
        }

        if (!isConfigReady) {
            toast({
                title: "Configuration Error",
                description: configError || "Configuration is not ready.",
                variant: "destructive",
            });
            return;
        }

        try {
            setIsCreating(true);

            const project = new NDKProject(ndk);
            project.ndk = ndk;
            project.content = formData.description;
            project.title = formData.name;

            if (formData.hashtags) {
                const hashtagArray = formData.hashtags
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter((tag) => tag.length > 0);
                project.hashtags = hashtagArray;
            }

            // Use template repo URL if available, otherwise use manual repo URL
            const repoUrl = formData.selectedTemplate?.repoUrl || formData.repoUrl;
            if (repoUrl) {
                project.repo = repoUrl;
            }

            const projectSigner = await project.getSigner();

            await project.sign();

            try {
                const apiUrl = getApiUrl(`/projects/${project.slug}`);
                const localCreateResponse = await fetch(apiUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        title: formData.name,
                        description: formData.description,
                        nsec: projectSigner.nsec,
                        pubkey: projectSigner.pubkey,
                        repo: repoUrl || undefined,
                        hashtags: formData.hashtags || undefined,
                        eventId: project.tagId(),
                    }),
                });

                if (!localCreateResponse.ok) {
                    const errorData = await localCreateResponse
                        .json()
                        .catch(() => ({ error: "Failed to parse error response" }));
                    throw new Error(
                        errorData.error ||
                            `Failed to create project backend structure: ${localCreateResponse.statusText}`,
                    );
                }

                project.publish();

                await localCreateResponse.json();
            } catch (backendError) {
                console.error("Error creating project backend structure:", backendError);
                toast({
                    title: "Backend Error",
                    description:
                        backendError instanceof Error
                            ? backendError.message
                            : "Failed to create project backend files.",
                    variant: "default",
                });
            }

            toast({
                title: "Project created",
                description: `${formData.name} has been created successfully.`,
                variant: "default",
            });

            setFormData({ name: "", description: "", hashtags: "", repoUrl: "", selectedTemplate: null });
            setIsCreatingProject(false);
            setCurrentStep(1);
            setMaxStep(1);
            if (onProjectCreated) onProjectCreated();
        } catch (err) {
            console.error("Error creating project:", err);
            const errorMessage = err instanceof Error ? err.message : "Failed to create project";
            setFormError(errorMessage);
            toast({
                title: "Error",
                description: errorMessage,
                variant: "destructive",
            });
        } finally {
            setIsCreating(false);
        }
    };

    const actionsDisabled = !isConfigReady || isConfigLoading;
    const configErrorTooltip = configError
        ? `Configuration Error: ${configError}`
        : !isConfigReady
          ? "Loading configuration..."
          : "";

    // Reset form when dialog closes
    const handleDialogChange = (open: boolean) => {
        setIsCreatingProject(open);
        if (!open) {
            setFormData({ name: "", description: "", hashtags: "", repoUrl: "", selectedTemplate: null });
            setFormError(null);
            setCurrentStep(1);
            setMaxStep(1);
        }
    };

    return (
        <Dialog open={isCreatingProject} onOpenChange={handleDialogChange}>
            <DialogTrigger asChild disabled={actionsDisabled}>
                <Button className="rounded-md" disabled={actionsDisabled} title={configErrorTooltip}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Project {isConfigLoading ? "(Loading Config...)" : ""}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px]">
                <DialogHeader>
                    <DialogTitle className="text-xl">Create new project</DialogTitle>
                    <DialogDescription>
                        {currentStep === 1 && "Add the details for your new project. You can edit these later."}
                        {currentStep === 2 && "Choose a template to get started quickly."}
                        {currentStep === 3 && "Review your project details before creating."}
                    </DialogDescription>
                </DialogHeader>

                {/* Step Indicator */}
                <div className="flex justify-center items-center space-x-4 py-4">
                    {[1, 2, 3].map((step) => (
                        <div key={step} className="flex items-center">
                            <button
                                type="button"
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium cursor-pointer transition-colors ${
                                    step === currentStep
                                        ? "bg-primary text-primary-foreground"
                                        : step <= maxStep
                                          ? "bg-primary/20 text-primary hover:bg-primary/30"
                                          : "bg-muted text-muted-foreground"
                                }`}
                                onClick={() => goToStep(step)}
                                disabled={step > maxStep}
                            >
                                {step}
                            </button>
                            {step < 3 && (
                                <div className={`w-12 h-0.5 mx-2 ${step < maxStep ? "bg-primary/20" : "bg-muted"}`} />
                            )}
                        </div>
                    ))}
                </div>

                <div className="grid gap-4 py-4">
                    {/* Step 1: Project Details */}
                    {currentStep === 1 && (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="name">Project name</Label>
                                <Input
                                    id="name"
                                    placeholder="My Awesome Project"
                                    className="rounded-md"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="spec">Description</Label>
                                <Textarea
                                    id="spec"
                                    placeholder="Describe what you're building..."
                                    className="rounded-md min-h-[100px]"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="hashtags">Related hashtags</Label>
                                <Input
                                    id="hashtags"
                                    placeholder="nostr, bitcoin, development (comma separated)"
                                    className="rounded-md"
                                    value={formData.hashtags}
                                    onChange={(e) => setFormData({ ...formData, hashtags: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="repoUrl">Git Repository (optional)</Label>
                                <Input
                                    id="repoUrl"
                                    placeholder="github.com/username/repository"
                                    className="rounded-md"
                                    value={formData.repoUrl}
                                    onChange={(e) => {
                                        const newRepoUrl = e.target.value;
                                        setFormData({ 
                                            ...formData, 
                                            repoUrl: newRepoUrl,
                                            selectedTemplate: newRepoUrl ? null : formData.selectedTemplate
                                        });
                                    }}
                                />
                                {!formData.repoUrl && (
                                    <p className="text-sm text-muted-foreground">
                                        Leave empty to choose from a template in the next step
                                    </p>
                                )}
                            </div>
                            {formData.selectedTemplate && (
                                <div className="bg-muted p-3 rounded-md flex justify-between items-center">
                                    <div>
                                        <p className="text-sm font-medium">
                                            Template selected: {formData.selectedTemplate.name}
                                        </p>
                                        <p className="text-sm text-muted-foreground">{formData.selectedTemplate.repoUrl}</p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setFormData({ ...formData, selectedTemplate: null })}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </>
                    )}

                    {/* Step 2: Template Selection */}
                    {currentStep === 2 && shouldShowTemplateStep && (
                        <div className="min-h-[400px]">
                            <TemplateSelector
                                onTemplateSelect={handleTemplateSelect}
                                selectedTemplate={formData.selectedTemplate}
                            />
                        </div>
                    )}

                    {/* Step 3: Confirmation */}
                    {currentStep === 3 && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-semibold mb-2">Project Details</h3>
                                <div className="space-y-2 text-sm">
                                    <div>
                                        <span className="font-medium">Name:</span> {formData.name}
                                    </div>
                                    <div>
                                        <span className="font-medium">Description:</span> {formData.description}
                                    </div>
                                    {formData.hashtags && (
                                        <div>
                                            <span className="font-medium">Hashtags:</span> {formData.hashtags}
                                        </div>
                                    )}
                                    <div>
                                        <span className="font-medium">Repository:</span>{" "}
                                        {formData.selectedTemplate?.repoUrl || formData.repoUrl || "None"}
                                    </div>
                                </div>
                            </div>
                            {formData.selectedTemplate && (
                                <div>
                                    <h3 className="font-semibold mb-2">Selected Template</h3>
                                    <div className="bg-muted p-3 rounded-md">
                                        <p className="font-medium">{formData.selectedTemplate.name}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {formData.selectedTemplate.description}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {formError && <div className="text-red-500 text-sm mt-2">{formError}</div>}
                    {configError && <div className="text-orange-600 text-sm mt-2">Note: {configError}</div>}
                </div>
                <DialogFooter>
                    <div className="flex w-full justify-between">
                        <div>
                            {currentStep > 1 && (
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        if (currentStep === 3 && formData.repoUrl && !formData.selectedTemplate) {
                                            setCurrentStep(1); // Go directly to step 1 if we skipped step 2
                                        } else {
                                            prevStep();
                                        }
                                    }}
                                    className="rounded-md"
                                    disabled={isCreating}
                                >
                                    <ChevronLeft className="mr-2 h-4 w-4" />
                                    Back
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => handleDialogChange(false)}
                                className="rounded-md"
                                disabled={isCreating}
                            >
                                Cancel
                            </Button>
                            {currentStep < 3 && (
                                <Button
                                    onClick={() => {
                                        if (currentStep === 1 && !isStepValid()) {
                                            setFormError("Please fill in all required fields.");
                                            return;
                                        }
                                        setFormError(null);

                                        // Skip step 2 if repo URL is provided
                                        if (currentStep === 1 && formData.repoUrl) {
                                            setCurrentStep(3);
                                            setMaxStep(3);
                                        } else {
                                            nextStep();
                                        }
                                    }}
                                    className="rounded-md"
                                    disabled={isCreating || actionsDisabled || (currentStep === 1 && !isStepValid())}
                                >
                                    {currentStep === 2 && !formData.selectedTemplate ? "Skip" : "Next"}
                                    <ChevronRight className="ml-2 h-4 w-4" />
                                </Button>
                            )}
                            {currentStep === 3 && (
                                <Button
                                    onClick={handleCreateProject}
                                    className="rounded-md"
                                    disabled={isCreating || actionsDisabled}
                                    title={configErrorTooltip}
                                >
                                    {isCreating ? "Creating..." : "Create project"}
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

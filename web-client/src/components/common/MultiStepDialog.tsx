import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";

export interface MultiStepDialogStep<T = any> {
    id: T;
    title: string;
    component: ReactNode;
    canProceed?: boolean;
    isOptional?: boolean;
}

export interface MultiStepDialogProps<T = any> {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    steps: MultiStepDialogStep<T>[];
    currentStep: T;
    onStepChange: (step: T) => void;
    isLoading?: boolean;
    canSubmit?: boolean;
    submitLabel?: string;
    onSubmit: () => void;
    onCancel?: () => void;
    showStepIndicator?: boolean;
    maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
}

export function MultiStepDialog<T = any>({
    open,
    onOpenChange,
    title,
    steps,
    currentStep,
    onStepChange,
    isLoading = false,
    canSubmit = true,
    submitLabel = "Create",
    onSubmit,
    onCancel,
    showStepIndicator = true,
    maxWidth = "lg",
}: MultiStepDialogProps<T>) {
    const currentStepIndex = steps.findIndex((step) => step.id === currentStep);
    const currentStepData = steps[currentStepIndex];
    const isFirstStep = currentStepIndex === 0;
    const isLastStep = currentStepIndex === steps.length - 1;

    const handleClose = () => {
        if (!isLoading) {
            onCancel?.();
            onOpenChange(false);
        }
    };

    const handleNext = () => {
        if (!isLastStep) {
            const nextStep = steps[currentStepIndex + 1];
            if (nextStep) {
                onStepChange(nextStep.id);
            }
        }
    };

    const handlePrevious = () => {
        if (!isFirstStep) {
            const previousStep = steps[currentStepIndex - 1];
            if (previousStep) {
                onStepChange(previousStep.id);
            }
        }
    };

    const handleSubmit = () => {
        if (!isLoading && canSubmit) {
            onSubmit();
        }
    };

    const canProceed = currentStepData?.canProceed !== false;

    const maxWidthClasses = {
        sm: "sm:max-w-sm",
        md: "sm:max-w-md",
        lg: "sm:max-w-lg",
        xl: "sm:max-w-xl",
        "2xl": "sm:max-w-2xl",
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className={`${maxWidthClasses[maxWidth]} max-h-[90vh] overflow-y-auto`}>
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span>{title}</span>
                        {showStepIndicator && (
                            <span className="text-sm font-normal text-muted-foreground">
                                Step {currentStepIndex + 1} of {steps.length}
                            </span>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Step Content */}
                    <div>
                        <h3 className="text-lg font-medium mb-4">{currentStepData?.title}</h3>
                        {currentStepData?.component}
                    </div>
                </div>

                <DialogFooter className="flex justify-between">
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        {!isFirstStep && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handlePrevious}
                                disabled={isLoading}
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Previous
                            </Button>
                        )}
                    </div>

                    <div className="flex gap-2">
                        {!isLastStep ? (
                            <Button
                                type="button"
                                onClick={handleNext}
                                disabled={!canProceed || isLoading}
                            >
                                Next
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                onClick={handleSubmit}
                                disabled={!canSubmit || isLoading}
                                className="min-w-[100px]"
                            >
                                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                {submitLabel}
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

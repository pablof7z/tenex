import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";

export interface FormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    children: ReactNode;
    isLoading?: boolean;
    canSubmit?: boolean;
    submitLabel?: string;
    cancelLabel?: string;
    onSubmit: () => void;
    onCancel?: () => void;
    maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
}

export function FormDialog({
    open,
    onOpenChange,
    title,
    children,
    isLoading = false,
    canSubmit = true,
    submitLabel = "Submit",
    cancelLabel = "Cancel",
    onSubmit,
    onCancel,
    maxWidth = "md",
}: FormDialogProps) {
    const handleClose = () => {
        if (!isLoading) {
            onCancel?.();
            onOpenChange(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoading && canSubmit) {
            onSubmit();
        }
    };

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
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {children}

                    <DialogFooter className="flex gap-2 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={isLoading}
                        >
                            {cancelLabel}
                        </Button>
                        <Button
                            type="submit"
                            disabled={!canSubmit || isLoading}
                            className="min-w-[100px]"
                        >
                            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {submitLabel}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

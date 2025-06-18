import { MessageSquare, Mic } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent } from "../ui/dialog";

interface TaskCreationOptionsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onOptionSelect: (option: "voice" | "thread") => void;
}

export function TaskCreationOptionsDialog({
    open,
    onOpenChange,
    onOptionSelect,
}: TaskCreationOptionsDialogProps) {
    const handleOptionClick = (option: "voice" | "thread") => {
        onOptionSelect(option);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-full max-w-sm p-6 space-y-4">
                <h2 className="text-lg font-semibold text-slate-900 text-center">Create New</h2>

                <div className="space-y-3">
                    <Button
                        variant="outline"
                        className="w-full justify-start gap-3 py-3 h-auto"
                        onClick={() => handleOptionClick("voice")}
                    >
                        <Mic className="w-5 h-5 text-green-600" />
                        <div className="text-left">
                            <div className="font-medium">Voice</div>
                            <div className="text-xs text-slate-500">
                                Record voice message
                            </div>
                        </div>
                    </Button>

                    <Button
                        variant="outline"
                        className="w-full justify-start gap-3 py-3 h-auto"
                        onClick={() => handleOptionClick("thread")}
                    >
                        <MessageSquare className="w-5 h-5 text-purple-600" />
                        <div className="text-left">
                            <div className="font-medium">Thread</div>
                            <div className="text-xs text-slate-500">Start a discussion thread</div>
                        </div>
                    </Button>
                </div>

                <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
                    Cancel
                </Button>
            </DialogContent>
        </Dialog>
    );
}

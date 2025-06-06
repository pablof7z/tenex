import { Copy, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { LoadedProject } from "@/hooks/useProjects";

interface NsecManagerProps {
    project: LoadedProject;
    isConfigReady: boolean;
    configError: string | null;
    getApiUrl: (path: string) => string;
}

export function NsecManager({ project, isConfigReady, configError, getApiUrl }: NsecManagerProps) {
    const [nsec, setNsec] = useState<string | null>(project.nsec);
    const [showNsec, setShowNsec] = useState(false);

    // Copy Nsec Handler
    const handleCopyNsec = () => {
        if (nsec) {
            navigator.clipboard
                .writeText(nsec)
                .then(() => toast({ title: "Nsec Copied", description: "Project nsec copied to clipboard." }))
                .catch((err: unknown) => {
                    console.error("Failed to copy nsec: ", err);
                    toast({
                        title: "Copy Failed",
                        description: "Could not copy nsec to clipboard.",
                        variant: "destructive",
                    });
                });
        }
    };

    // --- Render Logic ---
    const actionsDisabled = !isConfigReady; // Base disable state
    const configErrorTooltip = configError
        ? `Configuration Error: ${configError}`
        : !isConfigReady
          ? "Loading configuration..."
          : "";

    return (
        <div className="grid gap-2">
            <Label htmlFor="project-nsec">Project Nsec (Secret Key)</Label>
            {nsec ? (
                <div className="flex items-center space-x-2">
                    <Input
                        id="project-nsec"
                        type={showNsec ? "text" : "password"}
                        value={nsec}
                        readOnly
                        className="rounded-md flex-grow"
                        placeholder="nsec..."
                    />
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setShowNsec(!showNsec)}
                        title={showNsec ? "Hide Nsec" : "Show Nsec"}
                        disabled={actionsDisabled} // Disable if config not ready
                    >
                        {showNsec ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={handleCopyNsec}
                        title={configErrorTooltip || "Copy Nsec"}
                        disabled={actionsDisabled} // Disable if config not ready
                    >
                        <Copy className="h-4 w-4" />
                    </Button>
                </div>
            ) : (
                <div className="flex flex-col space-y-2">
                    <p className="text-sm text-muted-foreground">No nsec found for this project!</p>
                </div>
            )}
            <p className="text-xs text-muted-foreground pt-1">
                This key allows the project to publish updates and interact on Nostr. Keep it secret. It's also used to
                configure backend tools.
            </p>
        </div>
    );
}

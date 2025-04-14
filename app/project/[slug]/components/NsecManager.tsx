import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NDKProject } from "@/lib/nostr/events/project";
import { toast } from "@/components/ui/use-toast";
import { useConfig } from "@/hooks/useConfig";
import { Copy, Eye, EyeOff, Loader2 } from "lucide-react";

interface NsecManagerProps {
    project: NDKProject;
    isConfigReady: boolean;
    configError: string | null;
    getApiUrl: (path: string) => string;
}

export function NsecManager({ project, isConfigReady, configError, getApiUrl }: NsecManagerProps) {
    const [nsec, setNsec] = useState<string | null>(null);
    const [showNsec, setShowNsec] = useState(false);
    const [isLoadingNsec, setIsLoadingNsec] = useState(true);
    const [isGeneratingNsec, setIsGeneratingNsec] = useState(false);
    const [isConfiguringMcp, setIsConfiguringMcp] = useState(false);

    // Fetch initial Nsec
    useEffect(() => {
        const fetchNsec = async () => {
            setIsLoadingNsec(true);
            try {
                const encryptedKey = project.tagValue("key");
                if (encryptedKey) {
                    const fetchedNsec = await project.getNsec();
                    setNsec(fetchedNsec);
                } else {
                    setNsec(null);
                }
            } catch (error) {
                console.error("Failed to fetch or decrypt nsec:", error);
                setNsec(null);
                toast({
                    title: "Error fetching Nsec",
                    description: "Could not fetch or decrypt the project's nsec.",
                    variant: "destructive",
                });
            } finally {
                setIsLoadingNsec(false);
            }
        };
        fetchNsec();
    }, [project]);

    // Backend Configuration API Call
    const callConfigureApi = useCallback(
        async (nsecValue: string): Promise<boolean> => {
            if (!isConfigReady) {
                toast({ title: "Configuration Error", description: configError || "Configuration not ready.", variant: "destructive" });
                return false;
            }
            if (!project?.id) {
                toast({ title: "Error", description: "Project ID is missing.", variant: "destructive" });
                return false;
            }
            const apiUrl = getApiUrl(`/projects/${project.id}/configure`);
            setIsConfiguringMcp(true);
            try {
                const response = await fetch(apiUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ nsec: nsecValue }),
                });
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
                    throw new Error(errorData.error);
                }
                console.log("MCP configuration updated successfully via API.");
                return true;
            } catch (error: unknown) {
                console.error("Failed to configure MCP via API:", error);
                const errorMessage = error instanceof Error ? error.message : "Could not update backend MCP settings.";
                toast({ title: "MCP Configuration Failed", description: errorMessage, variant: "destructive" });
                return false;
            } finally {
                setIsConfiguringMcp(false);
            }
        },
        [isConfigReady, project, getApiUrl, configError],
    );

    // Nsec Generation Handler
    const handleGenerateNsec = async () => {
        setIsGeneratingNsec(true);
        try {
            await project.getSigner(); // Ensure signer is created if needed
            const newNsec = await project.getNsec();
            setNsec(newNsec);
            await project.publishReplaceable(); // Save the new encrypted key tag

            let configureSuccess = false;
            if (newNsec) {
                configureSuccess = await callConfigureApi(newNsec);
            }

            if (configureSuccess) {
                toast({ title: "Nsec Generated & Configured", description: "A new nsec has been generated, saved, and configured." });
            } else if (newNsec) {
                toast({ title: "Nsec Generated (Config Failed)", description: "Nsec generated and saved, but backend configuration failed. Check errors.", variant: "default" });
            } else {
                throw new Error("Failed to retrieve generated NSEC after generation.");
            }
        } catch (error) {
            console.error("Failed to generate nsec:", error);
            toast({ title: "Error Generating Nsec", description: error instanceof Error ? error.message : "Could not generate or save a new nsec.", variant: "destructive" });
        } finally {
            setIsGeneratingNsec(false);
        }
    };

    // Copy Nsec Handler
    const handleCopyNsec = () => {
        if (nsec) {
            navigator.clipboard.writeText(nsec)
                .then(() => toast({ title: "Nsec Copied", description: "Project nsec copied to clipboard." }))
                .catch((err: unknown) => {
                    console.error("Failed to copy nsec: ", err);
                    toast({ title: "Copy Failed", description: "Could not copy nsec to clipboard.", variant: "destructive" });
                });
        }
    };

    // --- Render Logic ---
    const actionsDisabled = !isConfigReady; // Base disable state
    const generateDisabled = actionsDisabled || isGeneratingNsec || isConfiguringMcp;
    const configErrorTooltip = configError ? `Configuration Error: ${configError}` : !isConfigReady ? "Loading configuration..." : "";

    return (
        <div className="grid gap-2">
            <Label htmlFor="project-nsec">Project Nsec (Secret Key)</Label>
            {isLoadingNsec ? (
                <p className="text-sm text-muted-foreground">Loading nsec...</p>
            ) : nsec ? (
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
                    <p className="text-sm text-muted-foreground">
                        No nsec found for this project. Generate one to allow the project to sign events and configure backend tools.
                    </p>
                    <Button
                        className="rounded-md w-fit"
                        onClick={handleGenerateNsec}
                        disabled={generateDisabled}
                        title={configErrorTooltip || ""}
                    >
                        {isGeneratingNsec || isConfiguringMcp ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        {isGeneratingNsec ? "Generating..." : isConfiguringMcp ? "Configuring..." : "Generate Nsec"}
                    </Button>
                </div>
            )}
            <p className="text-xs text-muted-foreground pt-1">
                This key allows the project to publish updates and interact on Nostr. Keep it secret. It's also used to configure backend tools.
            </p>
        </div>
    );
}
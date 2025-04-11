import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NDKProject } from "@/lib/nostr/events/project";
import { toast } from "@/components/ui/use-toast"; // Assuming you use shadcn/ui toast
import { Copy, Eye, EyeOff } from "lucide-react"; // Icons for buttons

interface ProjectSettingsProps {
    project: NDKProject;
}

export function ProjectSettings({ project }: ProjectSettingsProps) {
    const [name, setName] = useState(project.title || "");
    // const [tagline, setTagline] = useState(project.tagline || ""); // Removed tagline state
    const [hashtags, setHashtags] = useState(project.hashtags?.join(", ") || "");
    const [gitRepo, setGitRepo] = useState(project.repo || "");
    const [nsec, setNsec] = useState<string | null>(null);
    const [showNsec, setShowNsec] = useState(false);
    const [isLoadingNsec, setIsLoadingNsec] = useState(true);
    const [isGeneratingNsec, setIsGeneratingNsec] = useState(false);
    const [isConfiguringMcp, setIsConfiguringMcp] = useState(false); // State for configure API call

    useEffect(() => {
        const fetchNsec = async () => {
            setIsLoadingNsec(true);
            try {
                // Check if encrypted key exists first without forcing generation
                const encryptedKey = project.tagValue("key");
                if (encryptedKey) {
                    const fetchedNsec = await project.getNsec();
                    setNsec(fetchedNsec);
                } else {
                    setNsec(null); // Explicitly set to null if no key tag
                }
            } catch (error) {
                console.error("Failed to fetch or decrypt nsec:", error);
                setNsec(null); // Set to null on error
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
    }, [project]); // Re-fetch if project object changes

    const handleSave = async () => {
        project.title = name;
        // project.tagline = tagline; // Removed tagline update
        project.repo = gitRepo;
        project.hashtags = hashtags.split(",").map((tag) => tag.trim());
        try {
            await project.publishReplaceable();
            toast({
                title: "Project Saved",
                description: "Your project settings have been updated.",
            });
            // Note: Saving general settings doesn't reconfigure MCP unless NSEC changes.
            // If repo changes, we might want a separate button/logic to update origin? For now, no.
        } catch (error) {
            console.error("Failed to save project:", error);
            toast({
                title: "Error Saving Project",
                description: "Could not save project settings.",
                variant: "destructive",
            });
        }
    };

    // Helper function to call the configure API
    const callConfigureApi = async (nsecValue: string) => {
        if (!project?.id) {
            toast({ title: "Error", description: "Project ID is missing.", variant: "destructive" });
            return;
        }
        setIsConfiguringMcp(true);
        try {
            const response = await fetch(`/api/projects/${project.id}/configure`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nsec: nsecValue }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            console.log("MCP configuration updated successfully via API.");
            // Optional: Show success toast specifically for MCP config if needed
            // toast({ title: "MCP Configured", description: "Backend MCP settings updated." });
        } catch (error: unknown) {
            console.error("Failed to configure MCP via API:", error);
            const errorMessage = error instanceof Error ? error.message : "Could not update backend MCP settings.";
            toast({
                title: "MCP Configuration Failed",
                description: errorMessage,
                variant: "destructive",
            });
        } finally {
            setIsConfiguringMcp(false);
        }
    };

    const handleGenerateNsec = async () => {
        setIsGeneratingNsec(true); // Keep this for the overall generation process
        try {
            // This will generate if needed and encrypt/save
            await project.getSigner();
            const newNsec = await project.getNsec();
            setNsec(newNsec);
            // Publish the event with the new encrypted key tag
            await project.publishReplaceable();

            // After successfully generating and publishing, configure the backend
            if (newNsec) {
                await callConfigureApi(newNsec); // Call the configure API
            }

            toast({
                title: "Nsec Generated",
                description: "A new nsec has been generated, saved, and configured.",
            });
        } catch (error) {
            console.error("Failed to generate nsec:", error);
            toast({
                title: "Error Generating Nsec",
                description: "Could not generate or save a new nsec.",
                variant: "destructive",
            });
        } finally {
            setIsGeneratingNsec(false);
        }
    };

    const handleCopyNsec = () => {
        if (nsec) {
            navigator.clipboard
                .writeText(nsec)
                .then(() => {
                    toast({ title: "Nsec Copied", description: "Project nsec copied to clipboard." });
                })
                .catch((err) => {
                    console.error("Failed to copy nsec: ", err);
                    toast({
                        title: "Copy Failed",
                        description: "Could not copy nsec to clipboard.",
                        variant: "destructive",
                    });
                });
        }
    };

    // Make sure the component returns JSX
    return (
        <Card className="rounded-md border-border">
            <CardHeader>
                <CardTitle className="text-xl">Project Settings</CardTitle>
                <CardDescription>Manage your project configuration and signing key.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Existing Fields */}
                <div className="grid gap-2">
                    <Label htmlFor="project-name">Project name</Label>
                    <Input
                        id="project-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="rounded-md"
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="project-hashtags">Related hashtags</Label>
                    <Input
                        id="project-hashtags"
                        value={hashtags}
                        onChange={(e) => setHashtags(e.target.value)}
                        className="rounded-md"
                        placeholder="nostr, project, development"
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="project-repo">Git Repository</Label>
                    <Input
                        id="project-repo"
                        value={gitRepo}
                        onChange={(e) => setGitRepo(e.target.value)}
                        className="rounded-md"
                        placeholder="github.com/username/repo"
                    />
                </div>

                {/* Nsec Section */}
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
                            >
                                {showNsec ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                            <Button variant="outline" size="icon" onClick={handleCopyNsec} title="Copy Nsec">
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col space-y-2">
                            <p className="text-sm text-muted-foreground">
                                No nsec found for this project. Generate one to allow the project to sign events and
                                configure backend tools.
                            </p>
                            <Button
                                className="rounded-md w-fit"
                                onClick={handleGenerateNsec}
                                disabled={isGeneratingNsec || isConfiguringMcp} // Disable while generating or configuring
                            >
                                {isGeneratingNsec
                                    ? "Generating..."
                                    : isConfiguringMcp
                                      ? "Configuring..."
                                      : "Generate Nsec"}
                            </Button>
                        </div>
                    )}
                    <p className="text-xs text-muted-foreground pt-1">
                        This key allows the project to publish updates and interact on Nostr. Keep it secret. It's also
                        used to configure backend tools.
                    </p>
                </div>

                {/* Save Button */}
                <Button className="rounded-md mt-4" onClick={handleSave}>
                    Save Changes
                </Button>
            </CardContent>
        </Card>
    );
}

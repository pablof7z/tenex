import { useState, useEffect, use } from "react";
import { NDKProject } from "@/lib/nostr/events/project";
import { NDKEvent, NDKUserProfile, serializeProfile } from "@nostr-dev-kit/ndk"; // Assuming profile structure might align
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // For Bio
import { toast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { useNDK, useProfile } from "@nostr-dev-kit/ndk-hooks";
import { useProjectStore } from "@/lib/store/projects";

interface ProjectAgentProfileSettingsProps {
    project: NDKProject;
    projectSlug: string;
}

export function ProjectAgentProfileSettings({ project, projectSlug }: ProjectAgentProfileSettingsProps) {
    // get the pubkey
    const getPubkeyBySlug = useProjectStore((state) => state.getPubkeyBySlug);
    const getSignerBySlug = useProjectStore((state) => state.getSignerBySlug);
    const pubkey = getPubkeyBySlug(projectSlug);
    const profile = useProfile(pubkey, true); // Fetch the profile using the pubkey
    const signer = getSignerBySlug(projectSlug);
    const [name, setName] = useState(profile?.name || "");
    const [displayName, setDisplayName] = useState(profile?.displayName || "");
    const [bio, setBio] = useState(profile?.about || ""); // NDKUserProfile uses 'about' for bio
    const [image, setImage] = useState(profile?.image || "");
    const [isSaving, setIsSaving] = useState(false);
    const { ndk } = useNDK();


    const handleSaveProfile = async () => {
        if (!ndk) return;
        if (!signer) throw new Error("No signer available for the project.");

        setIsSaving(true);
        const updatedProfile: NDKUserProfile = {
            name: name || undefined, // Use undefined if empty to potentially remove field
            displayName: displayName || undefined,
            about: bio || undefined,
            picture: image || undefined,
        };

        // Remove undefined fields
        Object.keys(updatedProfile).forEach((key) => {
            if (updatedProfile[key as keyof NDKUserProfile] === undefined) {
                delete updatedProfile[key as keyof NDKUserProfile];
            }
        });

        const profileEvent = new NDKEvent(ndk, {
            kind: 0,
            content: serializeProfile(updatedProfile),
        });
        await profileEvent.sign(signer);
        profileEvent.publish();
        toast({
            title: "Agent Profile Saved",
            description: "The project's agent profile has been updated.",
        });
        setIsSaving(false);
    };

    return (
        <Card className="rounded-md border-border mt-6">
            <CardHeader>
                <CardTitle className="text-lg">Agent Profile Settings</CardTitle>
                <CardDescription>Configure the profile details for the project's agent identity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-2">
                    <Label htmlFor="agent-name">Name</Label>
                    <Input
                        id="agent-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="rounded-md"
                        placeholder="e.g., project-bot"
                        disabled={isSaving}
                    />
                    <p className="text-xs text-muted-foreground">Short, technical name (like a username).</p>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="agent-display-name">Display Name</Label>
                    <Input
                        id="agent-display-name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="rounded-md"
                        placeholder="e.g., Project Assistant Bot"
                        disabled={isSaving}
                    />
                    <p className="text-xs text-muted-foreground">Human-friendly name shown in interfaces.</p>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="agent-bio">Bio</Label>
                    <Textarea
                        id="agent-bio"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        className="rounded-md"
                        placeholder="Describe the agent's purpose or role."
                        disabled={isSaving}
                        rows={3}
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="agent-image">Image URL</Label>
                    <Input
                        id="agent-image"
                        value={image}
                        onChange={(e) => setImage(e.target.value)}
                        className="rounded-md"
                        placeholder="https://example.com/agent-avatar.png"
                        disabled={isSaving}
                        type="url"
                    />
                </div>

                <Button className="rounded-md mt-2" onClick={handleSaveProfile} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isSaving ? "Saving Profile..." : "Save Agent Profile"}
                </Button>
            </CardContent>
        </Card>
    );
}

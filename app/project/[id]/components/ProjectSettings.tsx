import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// Removed ProjectData import
import { NDKProject } from "@/lib/nostr/events/project";

interface ProjectSettingsProps {
    project: NDKProject;
    onSave: (updatedProject: Partial<NDKProject>) => void;
}

export function ProjectSettings({ project }: ProjectSettingsProps) {
    const [name, setName] = useState(project.title || "");
    const [tagline, setTagline] = useState(project.tagline || "");
    const [hashtags, setHashtags] = useState(project.hashtags?.join(", ") || "");
    const [gitRepo, setGitRepo] = useState(project.repo || "");

    const handleSave = () => {
        project.title = name;
        project.tagline = tagline;
        project.repo = gitRepo;
        project.hashtags = hashtags.split(",").map((tag) => tag.trim()),
        project.publishReplaceable();
    };

    return (
        <Card className="rounded-md border-border">
            <CardHeader>
                <CardTitle className="text-xl">Project Settings</CardTitle>
                <CardDescription>Manage your project configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                    <Label htmlFor="project-tagline">Tagline</Label>
                    <Input
                        id="project-tagline"
                        value={tagline}
                        onChange={(e) => setTagline(e.target.value)}
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
                <Button className="rounded-md mt-2" onClick={handleSave}>
                    Save Changes
                </Button>
            </CardContent>
        </Card>
    );
}

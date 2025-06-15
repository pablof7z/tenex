import type { NDKProject } from "@nostr-dev-kit/ndk-hooks";
import { Camera } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

interface MetadataSettingsProps {
    project: NDKProject;
    editedProject: NDKProject;
    onProjectChanged: () => void;
}

interface EditProjectFormData {
    name: string;
    description: string;
    hashtags: string;
    repoUrl: string;
    imageUrl: string;
}

export function MetadataSettings({
    project,
    editedProject,
    onProjectChanged,
}: MetadataSettingsProps) {
    const [formData, setFormData] = useState<EditProjectFormData>({
        name: "",
        description: "",
        hashtags: "",
        repoUrl: "",
        imageUrl: "",
    });

    const originalData = useMemo(
        () => ({
            name: project.title || "",
            description: project.content || "",
            hashtags: project.hashtags?.join(", ") || "",
            repoUrl: project.repo || "",
            imageUrl: project.picture || "",
        }),
        [project]
    );

    useEffect(() => {
        const data = {
            name: project.title || "",
            description: project.content || "",
            hashtags: project.hashtags?.join(", ") || "",
            repoUrl: project.repo || "",
            imageUrl: project.picture || "",
        };
        setFormData(data);
    }, [project]);

    // Update edited project when form data changes
    useEffect(() => {
        if (!editedProject) return;

        editedProject.title = formData.name.trim();
        editedProject.content = formData.description.trim() || `A TENEX project: ${formData.name}`;

        if (formData.hashtags.trim()) {
            const hashtagArray = formData.hashtags
                .split(",")
                .map((tag) => tag.trim())
                .filter((tag) => tag.length > 0);
            editedProject.hashtags = hashtagArray;
        } else {
            editedProject.hashtags = [];
        }

        if (formData.repoUrl?.trim()) {
            editedProject.repo = formData.repoUrl.trim();
        } else {
            editedProject.repo = undefined;
        }

        if (formData.imageUrl?.trim()) {
            editedProject.picture = formData.imageUrl.trim();
        } else {
            editedProject.picture = undefined;
        }

        // Check if there are changes
        const changed = Object.keys(formData).some(
            (key) =>
                formData[key as keyof EditProjectFormData] !==
                originalData[key as keyof EditProjectFormData]
        );

        if (changed) {
            onProjectChanged();
        }
    }, [formData, editedProject, originalData, onProjectChanged]);

    const getProjectAvatar = () => {
        if (formData.imageUrl) {
            return formData.imageUrl;
        }
        const seed = project.tagValue("d") || "default";
        return `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(seed)}`;
    };

    const getInitials = (title: string) => {
        return title
            .split(" ")
            .map((word) => word.charAt(0))
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <div className="p-4 space-y-6 max-w-2xl mx-auto">
            {/* Avatar Section */}
            <div className="bg-white rounded-lg p-6">
                <div className="flex flex-col items-center space-y-4">
                    <div className="relative">
                        <Avatar className="w-24 h-24">
                            <AvatarImage
                                src={getProjectAvatar()}
                                alt={formData.name || "Project"}
                            />
                            <AvatarFallback className="text-lg font-semibold bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                                {getInitials(formData.name || "Project")}
                            </AvatarFallback>
                        </Avatar>
                        <Button
                            size="icon"
                            className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg"
                            onClick={() => {
                                const url = prompt("Enter image URL:", formData.imageUrl);
                                if (url !== null) {
                                    setFormData((prev) => ({ ...prev, imageUrl: url }));
                                }
                            }}
                        >
                            <Camera className="w-4 h-4" />
                        </Button>
                    </div>
                    <div className="text-center">
                        <p className="text-sm text-slate-600">Project Avatar</p>
                        <p className="text-xs text-slate-500 mt-1">Click to change photo</p>
                    </div>
                </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
                <div className="bg-white rounded-lg p-4">
                    <label
                        htmlFor="project-name"
                        className="block text-sm font-medium text-slate-700 mb-2"
                    >
                        Project Name
                    </label>
                    <Input
                        id="project-name"
                        placeholder="Enter project name"
                        value={formData.name}
                        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    />
                </div>

                <div className="bg-white rounded-lg p-4">
                    <label
                        htmlFor="project-description"
                        className="block text-sm font-medium text-slate-700 mb-2"
                    >
                        Description
                    </label>
                    <Textarea
                        id="project-description"
                        placeholder="Describe your project..."
                        value={formData.description}
                        onChange={(e) =>
                            setFormData((prev) => ({
                                ...prev,
                                description: e.target.value,
                            }))
                        }
                        className="min-h-[100px]"
                    />
                </div>

                <div className="bg-white rounded-lg p-4">
                    <label
                        htmlFor="project-tags"
                        className="block text-sm font-medium text-slate-700 mb-2"
                    >
                        Tags
                    </label>
                    <Input
                        id="project-tags"
                        placeholder="react, typescript, web3 (comma separated)"
                        value={formData.hashtags}
                        onChange={(e) =>
                            setFormData((prev) => ({ ...prev, hashtags: e.target.value }))
                        }
                    />
                    <p className="text-xs text-slate-500 mt-2">Separate tags with commas</p>
                </div>

                <div className="bg-white rounded-lg p-4">
                    <label
                        htmlFor="repo-url"
                        className="block text-sm font-medium text-slate-700 mb-2"
                    >
                        Repository URL
                    </label>
                    <Input
                        id="repo-url"
                        placeholder="https://github.com/username/repo"
                        value={formData.repoUrl}
                        onChange={(e) =>
                            setFormData((prev) => ({ ...prev, repoUrl: e.target.value }))
                        }
                    />
                </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-white rounded-lg border border-red-200 p-4">
                <h3 className="text-sm font-medium text-red-800 mb-2">Danger Zone</h3>
                <p className="text-sm text-red-600 mb-4">These actions cannot be undone</p>
                <Button
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                    size="sm"
                >
                    Delete Project
                </Button>
            </div>
        </div>
    );
}

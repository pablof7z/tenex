"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useNDK, useNDKCurrentUser, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { NDKProject } from "@/lib/nostr/events/project";
import { ProjectCard } from "@/components/events/project/card";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
import { AppLayout } from "@/components/app-layout";

export default function DashboardPage() {
    const { ndk } = useNDK();
    const currentUser = useNDKCurrentUser();
    // Subscribe to projects created by the current user
    const { events: projects, eose } = useSubscribe(currentUser ? [
        { kinds: [NDKProject.kind], authors: [currentUser?.pubkey] },
    ] : false);
    const { toast } = useToast();
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        tagline: "",
        description: "",
        hashtags: "",
        gitRepo: ""
    });
    const [error, setError] = useState<string | null>(null);
    
    console.log("Fetched projects:", projects);
    
    const handleCreateProject = async () => {
        if (!formData.name || !formData.description) {
            setError("Project name and description are required");
            return;
        }
        
        if (!ndk || !currentUser) {
            setError("You must be logged in to create a project");
            return;
        }
        
        try {
            setIsCreating(true);
            setError(null);
            
            // Create a new NDK Project with the NDK instance
            const project = new NDKProject(ndk);
            project.ndk = ndk;
            project.content = formData.description;
            
            // Set project properties
            project.title = formData.name;
            project.tagline = formData.tagline;
            
            // Process hashtags (convert comma-separated string to array)
            if (formData.hashtags) {
                const hashtagArray = formData.hashtags
                    .split(',')
                    .map(tag => tag.trim())
                    .filter(tag => tag.length > 0);
                project.hashtags = hashtagArray;
            }
            
            // Set git repository if provided
            if (formData.gitRepo) {
                project.repo = formData.gitRepo;
            }
            
            // Publish the project event
            await project.publish();
            
            console.log("Project published successfully:", project);
            
            // Show success toast
            toast({
                title: "Project created",
                description: `${formData.name} has been created successfully.`,
                variant: "default",
            });
            
            // Reset form and close dialog
            setFormData({
                name: "",
                tagline: "",
                description: "",
                hashtags: "",
                gitRepo: ""
            });
            setIsCreatingProject(false);
            
            // You might want to add a success notification here
            console.log("Project created successfully:", project);
            
        } catch (err) {
            console.error("Error creating project:", err);
            const errorMessage = err instanceof Error ? err.message : "Failed to create project";
            setError(errorMessage);
            
            // Show error toast
            toast({
                title: "Error",
                description: errorMessage,
                variant: "destructive",
            });
        } finally {
            setIsCreating(false);
        }
    };


    return (
        <AppLayout>
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-medium tracking-tight">Projects</h1>
                <Dialog open={isCreatingProject} onOpenChange={setIsCreatingProject}>
                    <DialogTrigger asChild>
                        <Button className="rounded-md">
                            <Plus className="mr-2 h-4 w-4" />
                            New Project
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[525px]">
                        <DialogHeader>
                            <DialogTitle className="text-xl">Create new project</DialogTitle>
                            <DialogDescription>
                                Add the details for your new project. You can edit these later.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Project name</Label>
                                <Input
                                    id="name"
                                    placeholder="My Awesome Project"
                                    className="rounded-md"
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="tagline">Tagline</Label>
                                <Input
                                    id="tagline"
                                    placeholder="A short description of your project"
                                    className="rounded-md"
                                    value={formData.tagline}
                                    onChange={(e) => setFormData({...formData, tagline: e.target.value})}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="spec">Initial product spec</Label>
                                <Textarea
                                    id="spec"
                                    placeholder="Describe what you're building..."
                                    className="rounded-md min-h-[100px]"
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
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
                                    onChange={(e) => setFormData({...formData, hashtags: e.target.value})}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="gitRepo">Git Repository</Label>
                                <Input
                                    id="gitRepo"
                                    placeholder="github.com/username/repository"
                                    className="rounded-md"
                                    value={formData.gitRepo}
                                    onChange={(e) => setFormData({...formData, gitRepo: e.target.value})}
                                />
                            </div>
                            {error && (
                                <div className="text-red-500 text-sm mt-2">
                                    {error}
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsCreatingProject(false);
                                    setFormData({
                                        name: "",
                                        tagline: "",
                                        description: "",
                                        hashtags: "",
                                        gitRepo: ""
                                    });
                                    setError(null);
                                }}
                                className="rounded-md"
                                disabled={isCreating}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCreateProject}
                                className="rounded-md"
                                disabled={isCreating}
                            >
                                {isCreating ? "Creating..." : "Create project"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {!eose ? (
                    <div className="col-span-3 text-center py-10 text-muted-foreground">
                        <p>Loading projects...</p>
                    </div>
                ) : projects && projects.length > 0 ? (
                    projects.map((project) => (
                        <ProjectCard key={project.id} project={project} />
                    ))
                ) : (
                    <div className="col-span-3 text-center py-10 text-muted-foreground">
                        {currentUser ? (
                            <p>No projects found. Create your first project to get started!</p>
                        ) : (
                            <p>Please log in to view your projects.</p>
                        )}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

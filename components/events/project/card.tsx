"use client";

import Link from "next/link";
import { Clock, FileText, GitBranch, MessageSquare, Settings, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
import { LoadedProject } from "@/hooks/useProjects";
import React from "react"; // Import React for Label

// Define props for ProjectCard
interface ProjectCardProps {
    project: LoadedProject;
    isSelected: boolean;
    onSelectProject: (projectSlug: string, isSelected: boolean) => void;
}

export function ProjectCard({ project, isSelected, onSelectProject }: ProjectCardProps) {
    const { slug, title, repoUrl } = project; // Removed description, hashtags
    // Attempt to get description from event, then split hashtags
    const description = project.event?.content || project.event?.summary || "No description available.";
    console.log('proejct hashtags', project.hashtags);

    const peopleTalking = "?";
    const pendingTasks = "?";
    const checkboxId = `select-project-${slug}`; // Unique ID for checkbox and label

    return (
        <Card className="card-hover overflow-hidden rounded-md border-border flex flex-col">
            <CardHeader className="pb-2">
                {/* Use slug for the link */}
                <Link href={`/project/${slug}`} className="hover:text-foreground/70 transition-colors">
                    <CardTitle className="text-xl">{title}</CardTitle>
                </Link>
                <CardDescription className="text-sm line-clamp-2">{description}</CardDescription>
            </CardHeader>

            <CardContent className="pb-0 flex-grow">
                <div className="flex flex-wrap gap-1.5 mb-3">
                    {project.hashtags.map((tag: string) => ( // Use project.hashtags and type tag
                        <span key={tag} className="hashtag">
                            #{tag}
                        </span>
                    ))}
                </div>

                <div className="flex items-center text-xs mb-4">
                    <GitBranch className="h-3.5 w-3.5 mr-1.5" />
                    {/* Use repoUrl directly */}
                    {repoUrl ? (
                        <a
                            href={repoUrl.startsWith("http") ? repoUrl : `https://${repoUrl}`}
                            className="text-foreground hover:underline truncate"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {/* Display the repoUrl URL */}
                            {repoUrl}
                        </a>
                    ) : (
                        <span className="text-muted-foreground">No repository linked</span>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-2">
                    <div className="stat-card p-3">
                        <div className="flex items-center justify-between mb-1">
                            <Users className="h-4 w-4" />
                            <span className="text-xs text-muted-foreground">Community</span>
                        </div>
                        <div className="text-2xl font-medium text-center">{peopleTalking}</div>
                        <div className="text-xs text-center text-muted-foreground">People Talking</div>
                    </div>
                    <div className="stat-card p-3">
                        <div className="flex items-center justify-between mb-1">
                            <MessageSquare className="h-4 w-4" />
                            <span className="text-xs text-muted-foreground">Tasks</span>
                        </div>
                        <div className="text-2xl font-medium text-center">{pendingTasks}</div>
                        <div className="text-xs text-center text-muted-foreground">Pending</div>
                    </div>
                </div>
            </CardContent>

            <CardFooter className="border-t pt-3 text-xs text-muted-foreground mt-auto flex items-center justify-between">
                <div className="flex items-center space-x-2"> {/* Added space-x-2 for spacing */}
                    <Checkbox
                        id={checkboxId}
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                            onSelectProject(slug, !!checked); // Ensure checked is boolean
                        }}
                    />
                    <label
                        htmlFor={checkboxId}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                        Select
                    </label>
                </div>
                <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-secondary">
                        <FileText className="h-4 w-4" />
                        <span className="sr-only">View spec</span>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-secondary">
                        <Settings className="h-4 w-4" />
                        <span className="sr-only">Settings</span>
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
}

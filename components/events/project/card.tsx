"use client";

import Link from "next/link";
import { Clock, FileText, GitBranch, MessageSquare, Settings, Users } from "lucide-react";
// Removed NDKEvent and NDKProject imports as we'll use a simpler prop type

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

// Define a simpler interface for the props needed by the card
interface ProjectCardDisplayProps {
    id: string; // Unique identifier for the key
    slug: string; // The 'd' tag value or project name for the link
    title: string;
    description: string;
    hashtags: string[];
    repo?: string; // Optional repository URL string (e.g., "github.com/user/repo")
    updatedAt?: number; // Optional timestamp (seconds)
}

export function ProjectCard({ project }: { project: ProjectCardDisplayProps }) {
    // Use props directly
    const { id, slug, title, description, hashtags, repo, updatedAt: updatedAtTimestamp } = project;

    // Format timestamp if available
    const updatedAt = updatedAtTimestamp
        ? new Date(updatedAtTimestamp * 1000).toLocaleDateString() + ' ' + new Date(updatedAtTimestamp * 1000).toLocaleTimeString()
        : "?";

    const peopleTalking = "?";
    const pendingTasks = "?";

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
                    {hashtags.map((tag) => (
                        <span key={tag} className="hashtag">
                            #{tag}
                        </span>
                    ))}
                </div>

                <div className="flex items-center text-xs mb-4">
                    <GitBranch className="h-3.5 w-3.5 mr-1.5" />
                    {/* Use repo directly */}
                    {repo ? (
                        <a
                            href={repo.startsWith('http') ? repo : `https://${repo}`}
                            className="text-foreground hover:underline truncate"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {/* Display the repo URL */}
                            {repo}
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
                <div className="flex items-center">
                    <Clock className="mr-1 h-3 w-3" />
                    {/* Display formatted updatedAt */}
                    <span>{updatedAt !== "?" ? `Updated ${updatedAt}` : "Update time unknown"}</span>
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

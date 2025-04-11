"use client";

import Link from "next/link";
import { Clock, FileText, GitBranch, MessageSquare, Settings, Users } from "lucide-react";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import { NDKProject } from "@/lib/nostr/events/project";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface ProjectCardProps {
  project: NDKEvent;
}

export function ProjectCard({ project }: ProjectCardProps) {
  // Convert NDKEvent to NDKProject to access helper methods
  const projectObj = NDKProject.from(project);
  
  // Extract data from the project
  const id = project.id;
  const name = projectObj.title || "?";
  const tagline = projectObj.tagline || "?";
  const hashtags = projectObj.hashtags || [];
  const gitRepo = projectObj.repo || "?";
  const description = projectObj.content || "?";
  
  // Calculate created/updated time
  const createdAt = project.created_at ? new Date(project.created_at * 1000) : null;
  const updatedAt = createdAt ?
    `${createdAt.toLocaleDateString()} ${createdAt.toLocaleTimeString()}` :
    "?";
  
  // These fields might not be available in the actual event
  // Using placeholders as requested
  const activity = description;
  const peopleTalking = "?";
  const pendingTasks = "?";

  return (
    <Card
      className="card-hover overflow-hidden rounded-md border-border flex flex-col"
    >
      <CardHeader className="pb-2">
        <Link
          href={`/project/${project.dTag}`}
          className="hover:text-foreground/70 transition-colors"
        >
          <CardTitle className="text-xl">{name}</CardTitle>
        </Link>
        <CardDescription className="text-sm">{tagline}</CardDescription>
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
          {gitRepo !== "?" ? (
            <a
              href={`https://${gitRepo}`}
              className="text-foreground hover:underline truncate"
              target="_blank"
              rel="noopener noreferrer"
            >
              {gitRepo}
            </a>
          ) : (
            <span className="text-muted-foreground">No repository linked</span>
          )}
        </div>

        <div className="text-sm text-muted-foreground mb-4">
          <p className="line-clamp-2">{activity}</p>
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
          <span>Updated {updatedAt}</span>
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
"use client";

import React, { useMemo, useState } from "react";
import { useNDKCurrentUser, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { AppLayout } from "@/components/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NDKProject } from "@/lib/nostr/events/project";
import { Task } from "./components/types";
import { QuoteData } from "@/components/events/note/card"; // Import QuoteData from NoteCard

// Import all our components
import { ProjectHeader } from "./components/ProjectHeader";
import { ProjectStatCards } from "./components/ProjectStatCards";
import { ActivityFeed } from "./components/ActivityFeed";
import { ProductSpec } from "./components/ProductSpec";
import { RelatedTweets } from "./components/RelatedTweets";
import { TasksList } from "./components/TasksList";
import { ProjectSettings } from "./components/ProjectSettings";
import { TaskDetailDialog } from "./components/TaskDetailDialog";
import { CreatePostDialog } from "./components/CreatePostDialog";
import { QuotePostDialog } from "./components/QuotePostDialog";

// Update the type definition to reflect params is a Promise
export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap the params Promise using React.use()
  const unwrappedParams = React.use(params);
  const projectId = unwrappedParams.id;
  const currentUser = useNDKCurrentUser();
  
  // Fetch project using useSubscribe with correct filtering
  const { events: projects } = useSubscribe(currentUser && projectId ? [
    { kinds: [NDKProject.kind], authors: [currentUser?.pubkey], "#d": [projectId] },
  ] : false);
  
  // Get the project from the events
  const projectEvent = useMemo(() => projects[0], [projects[0]?.id]);
  
  // State management for UI interactions
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isCreatingTweet, setIsCreatingTweet] = useState(false);
  const [isQuoting, setIsQuoting] = useState<QuoteData | null>(null);

    const project = useMemo(() => projectEvent ? NDKProject.from(projectEvent) : null, [projectEvent]);
    
  const handleSettingsClick = () => {
    setActiveTab("settings");
  };

  const handleEditorLaunch = () => {
    // Implement editor launch logic
    console.log("Launch editor for project:", project?.id); // Added optional chaining
  };

  const handleCreatePost = () => {
    setIsCreatingTweet(true);
  };

  const handlePostSubmit = (content: string) => {
    // Implement post creation logic
    console.log("Creating post:", content);
    setIsCreatingTweet(false);
  };

  const handleReply = (itemId: string, content: string) => {
    // Implement reply logic
    console.log("Replying to:", itemId, "with content:", content);
  };

  const handleRepost = (itemId: string) => {
    // Implement repost logic
    console.log("Reposting:", itemId);
  };

  const handleQuote = (quoteData: QuoteData) => {
    setIsQuoting(quoteData);
  };

  const handleQuoteSubmit = (quoteData: QuoteData, comment: string) => {
    // Implement quote logic
    console.log("Quoting:", quoteData, "with comment:", comment);
    setIsQuoting(null);
  };

  const handleZap = (itemId: string) => {
    // Implement zap logic
    console.log("Zapping:", itemId);
  };

  const handleSaveSpec = (content: string) => {
    // Implement save spec logic
    console.log("Saving spec:", content);
  };

  const handleSaveSettings = (updatedProject: Partial<NDKProject>) => {
    // Implement save settings logic
    console.log("Saving settings:", updatedProject);
  };

  const handleAddTask = () => {
    // Implement add task logic
    console.log("Adding task");
  };

  const handleDeleteTask = (taskId: string) => {
    // Implement delete task logic
    console.log("Deleting task:", taskId);
  };

  const handleAddComment = (taskId: string, comment: string) => {
    // Implement add comment logic
    console.log("Adding comment to task:", taskId, "comment:", comment);
  };

  const handleLaunchEditor = (taskId: string) => {
    // Implement launch editor logic
    console.log("Launching editor for task:", taskId);
  };

  // Function to format sats amount
  const formatSats = (sats: number) => {
    if (sats >= 1000) {
      return `${(sats / 1000).toFixed(1)}k`;
    }
    return sats.toString();
  };

  if (!project) return null;

  return (
    <AppLayout>
      <ProjectHeader 
        project={project} 
        onSettingsClick={handleSettingsClick} 
        onEditorLaunch={handleEditorLaunch} 
      />

      <ProjectStatCards project={project} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-auto md:grid-cols-3 rounded-md p-1 bg-muted">
          <TabsTrigger
            value="overview"
            className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-950"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="tasks"
            className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-950"
          >
            Tasks
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="hidden md:block rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-950"
          >
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ActivityFeed 
              // activities={project.activityFeed} // TODO: Fetch activity feed separately
              activities={[]} // Temporary fix
              onCreatePost={handleCreatePost}
              onReply={handleReply}
              onRepost={handleRepost}
              onQuote={handleQuote}
              onZap={handleZap}
            />
            
            <ProductSpec 
              project={project} 
              onSave={handleSaveSpec} 
            />
            
            <RelatedTweets 
              project={project} 
              onReply={handleReply}
              onRepost={handleRepost}
              onQuote={handleQuote}
              onZap={handleZap}
            />
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="mt-6">
          <TasksList 
            // tasks={project.tasks} // TODO: Fetch tasks separately
            tasks={[]} // Temporary fix
            onTaskSelect={setSelectedTask}
            onAddTask={handleAddTask}
            onDeleteTask={handleDeleteTask}
          />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <ProjectSettings 
            project={project} 
            onSave={handleSaveSettings} 
          />
        </TabsContent>

        {/* Dialogs */}
        <TaskDetailDialog 
          task={selectedTask} 
          onClose={() => setSelectedTask(null)}
          onAddComment={handleAddComment}
          onLaunchEditor={handleLaunchEditor}
        />
        
        <CreatePostDialog 
          open={isCreatingTweet} 
          onClose={() => setIsCreatingTweet(false)}
          onPost={handlePostSubmit}
        />
        
        <QuotePostDialog 
          quoting={isQuoting} 
          onClose={() => setIsQuoting(null)}
          onQuote={handleQuoteSubmit}
        />
      </Tabs>
    </AppLayout>
  );
}

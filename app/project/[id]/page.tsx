"use client";

import React, { useMemo, useState, useEffect } from "react";
import { NDKPrivateKeySigner, useNDKCurrentUser, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { AppLayout } from "@/components/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NDKProject } from "@/lib/nostr/events/project";
import { toast } from "@/components/ui/use-toast";
import { Task } from "./components/types";
import { QuoteData } from "@/components/events/note/card";

// Import common components
import { ProjectHeader } from "./components/ProjectHeader";
import { ProjectStatCards } from "./components/ProjectStatCards";
import { TaskDetailDialog } from "./components/TaskDetailDialog";
import { QuotePostDialog } from "./components/QuotePostDialog";

// Import the new Tab components
import { ProjectOverviewTab } from "./components/ProjectOverviewTab";
import { ProjectTasksTab } from "./components/ProjectTasksTab";
import { ProjectSettingsTab } from "./components/ProjectSettingsTab";
import { ProjectSpecsTab } from "./components/ProjectSpecsTab";


export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(params);
  const projectId = unwrappedParams.id;
  const currentUser = useNDKCurrentUser();

  // Fetch project using useSubscribe with correct filtering
  const { events: projects } = useSubscribe(currentUser && projectId ? [
    { kinds: [NDKProject.kind], authors: [currentUser?.pubkey], "#d": [projectId] },
  ] : false);

  // Get the project from the events
  const projectEvent = useMemo(() => projects[0], [projects[0]?.id]);
  const project = useMemo(() => projectEvent ? NDKProject.from(projectEvent) : null, [projectEvent]);

  // State management for UI interactions
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [projectExistsLocally, setProjectExistsLocally] = useState<boolean | null>(null);
  const [projectConfigured, setProjectConfigured] = useState<boolean | null>(null);
  const [isConfiguringMcp, setIsConfiguringMcp] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isQuoting, setIsQuoting] = useState<QuoteData | null>(null);
  const [projectSigner, setProjectSigner] = useState<NDKPrivateKeySigner | null>(null);

  // --- Event Handlers ---
  const handleSettingsClick = () => setActiveTab("settings");
  const handleEditorLaunch = async () => {
    if (!projectId) {
      toast({ title: "Error", description: "Project ID is missing.", variant: "destructive" });
      return;
    }
    console.log("Requesting to launch editor for project:", projectId);
    try {
      const response = await fetch(`/api/projects/${projectId}/open-editor`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      // The backend responds with 202 Accepted immediately.
      // The script runs asynchronously. We can provide feedback that the request was sent.
      toast({ title: "Editor Launch Requested", description: "Attempting to open the project in your editor..." });
      console.log("Editor launch request successful:", data.message);
    } catch (error: any) {
      console.error("Failed to request editor launch:", error);
      toast({ title: "Editor Launch Failed", description: error.message || "Could not request editor launch.", variant: "destructive" });
    }
  };
  const handleReply = (itemId: string, content: string) => console.log("Replying to:", itemId, "with content:", content);
  const handleRepost = (itemId: string) => console.log("Reposting:", itemId);
  const handleQuote = (quoteData: QuoteData) => setIsQuoting(quoteData);
  const handleQuoteSubmit = (quoteData: QuoteData, comment: string) => { console.log("Quoting:", quoteData, "with comment:", comment); setIsQuoting(null); };
  const handleZap = (itemId: string) => console.log("Zapping:", itemId);
  // const handleSaveSpec = (content: string) => console.log("Saving spec:", content); // Now handled within ProjectSpecsTab
  const handleAddTask = () => console.log("Adding task");
  const handleDeleteTask = (taskId: string) => console.log("Deleting task:", taskId);
  const handleAddComment = (taskId: string, comment: string) => console.log("Adding comment to task:", taskId, "comment:", comment);
  const handleLaunchEditor = (taskId: string) => console.log("Launching editor for task:", taskId);
  // --- End Event Handlers ---


  // Fetch project existence and configuration status
  useEffect(() => {
    if (!projectId) return;
    setProjectExistsLocally(null);
    setProjectConfigured(null);
    fetch(`/api/projects/${projectId}`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setProjectExistsLocally(data.exists);
          setProjectConfigured(data.configured);
        } else if (res.status === 404) {
          setProjectExistsLocally(false);
          setProjectConfigured(false);
        } else {
          console.error("Failed to check project status:", res.status, await res.text());
          setProjectExistsLocally(false); setProjectConfigured(false);
        }
      })
      .catch((error) => {
        console.error("Error fetching project status:", error);
        setProjectExistsLocally(false); setProjectConfigured(false);
      });
  }, [projectId]);

  // Helper function to call the configure API
  const callConfigureApi = async (nsecValue: string) => {
      if (!projectId || isConfiguringMcp) return;
      setIsConfiguringMcp(true);
      console.log("Attempting to auto-configure MCP via API...");
      try {
          const response = await fetch(`/api/projects/${projectId}/configure`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nsec: nsecValue }),
          });
          if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
          }
          console.log("MCP auto-configuration successful.");
          setProjectConfigured(true);
          toast({ title: "Project Configured", description: "Backend MCP settings updated automatically." });
      } catch (error: any) {
          console.error("Failed to auto-configure MCP via API:", error);
          toast({ title: "MCP Auto-Configuration Failed", description: `Could not update backend MCP settings: ${error.message}`, variant: "destructive" });
      } finally {
          setIsConfiguringMcp(false);
      }
  };

  // Effect to trigger auto-configuration if needed
  useEffect(() => {
    if (projectExistsLocally === true && projectConfigured === false && project && !isConfiguringMcp) {
      const attemptAutoConfigure = async () => {
        console.log("Project exists but not configured, attempting to get NSEC...");
        try {
          const nsec = await project.getNsec();
          if (nsec) {
            console.log("NSEC retrieved, calling configure API...");
            await callConfigureApi(nsec);
          } else {
            console.warn("Could not retrieve NSEC automatically. Manual configuration might be needed in settings.");
          }
        } catch (error) {
          console.error("Error trying to get NSEC for auto-configuration:", error);
          toast({ title: "Nsec Retrieval Failed", description: "Could not get NSEC for auto-configuration. Please check settings.", variant: "destructive" });
        }
      };
      attemptAutoConfigure();
    }
  }, [projectExistsLocally, projectConfigured, project, isConfiguringMcp, projectId]);

  // Handle project creation
   const handleCreateProject = async () => {
     if (!projectId || isCreatingProject || !project) return; // Ensure project exists
     setIsCreatingProject(true);
     console.log("Attempting to create project directory for:", projectId);
     const repoUrl = project?.repo;
     try {
       const response = await fetch(`/api/projects/${projectId}`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ repoUrl }),
       });
       if (response.ok) {
         console.log("Project directory created or already exists.");
         setProjectExistsLocally(true);
         setProjectConfigured(false); // Assume not configured initially
       } else {
         const errorData = await response.json();
         console.error("Failed to create project directory:", response.status, errorData.error || 'Unknown error');
         toast({ title: "Project Creation Failed", description: errorData.error || 'Unknown error', variant: "destructive" });
       }
     } catch (error: any) {
       console.error("Error calling create project API:", error);
       toast({ title: "Project Creation Error", description: error.message, variant: "destructive" });
     } finally {
       setIsCreatingProject(false);
     }
   };

  // Get project signer
  useEffect(() => {
    if (!projectSigner && project) {
      project.getSigner().then(setProjectSigner).catch((error) => {
        console.error("Error getting project signer:", error);
      });
    }
  }, [project, projectSigner]);

  if (!project) return null; // Render loading or placeholder?

  return (
    <AppLayout>
      <ProjectHeader
        project={project}
        onSettingsClick={handleSettingsClick}
        onEditorLaunch={handleEditorLaunch}
        onProjectCreate={handleCreateProject}
        projectExists={projectExistsLocally}
        isCreatingProject={isCreatingProject}
      />

      <ProjectStatCards project={project} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-6">
        <TabsList className="grid w-full grid-cols-3 md:w-auto md:grid-cols-4 rounded-md p-1 bg-muted">
          <TabsTrigger value="overview" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-950">
            Overview
          </TabsTrigger>
          <TabsTrigger value="tasks" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-950">
            Tasks
          </TabsTrigger>
          <TabsTrigger value="specs" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-950">
            Specs
          </TabsTrigger>
          <TabsTrigger value="settings" className="hidden md:block rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-950">
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <ProjectOverviewTab
            project={project}
            projectSigner={projectSigner}
            onReply={handleReply}
            onRepost={handleRepost}
            onQuote={handleQuote}
            onZap={handleZap}
          />
        </TabsContent>

        <TabsContent value="tasks" className="mt-6">
          <ProjectTasksTab
            tasks={[]} // Replace with actual tasks data source later
            onTaskSelect={setSelectedTask}
            onAddTask={handleAddTask}
            onDeleteTask={handleDeleteTask}
          />
        </TabsContent>

        <TabsContent value="specs" className="mt-6">
          <ProjectSpecsTab project={project} projectId={projectId} />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <ProjectSettingsTab project={project} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <TaskDetailDialog
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onAddComment={handleAddComment}
        onLaunchEditor={handleLaunchEditor}
      />
      <QuotePostDialog
        quoting={isQuoting}
        onClose={() => setIsQuoting(null)}
        onQuote={handleQuoteSubmit}
      />
      {/* CreatePostDialog is handled within ActivityFeed */}

    </AppLayout>
  );
}

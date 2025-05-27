"use client";

import { useSearchParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '../../components/ui/button';
import { useProjects, LoadedProject } from '../../hooks/useProjects';
import { RecentTasksList } from '../../components/tasks/RecentTasksList';
import { ActivityFeed } from '../../components/ActivityFeed'; // Re-added ActivityFeed
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';

export default function MultiColumnViewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { projects: allProjects, isLoading: isLoadingProjects, isError: projectsError } = useProjects();
  const [isCreateTaskDialogOpen, setIsCreateTaskDialogOpen] = useState(false);
  const [selectedProjectForNewTask, setSelectedProjectForNewTask] = useState<LoadedProject | null>(null);

  const handleOpenCreateTaskDialog = (project: LoadedProject) => {
    setSelectedProjectForNewTask(project);
    setIsCreateTaskDialogOpen(true);
  };

  const displayedProjects = useMemo(() => {
    const slugsQueryParam = searchParams.get('projectIds');
    if (!slugsQueryParam || !allProjects) {
      return [];
    }
    const slugs = slugsQueryParam.split(',').filter(slug => slug.trim() !== '');
    return allProjects.filter((project: LoadedProject) => slugs.includes(project.slug));
  }, [searchParams, allProjects]);

  if (isLoadingProjects) {
    return <div className="p-4 text-center">Loading project details...</div>;
  }

  if (projectsError) {
    return <div className="p-4 text-center text-red-500">Error loading projects. Please try again later.</div>;
  }

  if (displayedProjects.length === 0) {
    const slugsQueryParam = searchParams.get('projectIds');
    if (!slugsQueryParam || slugsQueryParam.trim() === '') {
      return <div className="p-4">No project slugs provided in the URL. Please add ?projectIds=slug1,slug2 to the URL.</div>;
    }
    return <div className="p-4">No projects found for the provided slugs or no projects selected. Please check the slugs or select projects from the dashboard.</div>;
  }

  return (
    <>
      <div className="flex absolute top-0 left-0 bottom-0 right-0 h-screen w-full p-4 space-x-4 overflow-x-auto bg-background overflow-y-clip">
        {displayedProjects.map((project: LoadedProject) => (
          <div key={project.slug} className="h-screen flex-1 flex-shrink-0" style={{ minWidth: '390px', flexGrow: 1, flexBasis: '0' }}>
            <div className="h-screen flex flex-col flex-1">
              <div className="bg-card border rounded-lg shadow-sm p-4">
                <div className="flex justify-between items-center">
                  <Link href={`/project/${project.slug}`} passHref legacyBehavior>
                    <span className="text-lg font-semibold hover:underline">{(project.title || project.slug)}</span>
                  </Link>
                  <Button size="sm" onClick={() => handleOpenCreateTaskDialog(project)}>
                    + New Task
                  </Button>
                </div>
                <div className="flex-grow pt-4 overflow-y-auto">
                  <RecentTasksList project={project} />
                </div>
              </div>
              <div className="flex-grow overflow-y-auto mt-4">

                {project.pubkey ? (
                  <ActivityFeed
                    pubkeys={[project.pubkey]}
                    signer={project.signer} // Pass signer if available and ActivityFeed uses it
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Cannot load activity feed: Project pubkey not found.</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {selectedProjectForNewTask && (
        <CreateTaskDialog
          project={selectedProjectForNewTask}
          open={isCreateTaskDialogOpen}
          onOpenChange={setIsCreateTaskDialogOpen}
          onTaskCreated={() => {
            // Optionally, refresh tasks or give feedback
            setIsCreateTaskDialogOpen(false); // Close dialog on task creation
          }}
        />
      )}
    </>
  );
}
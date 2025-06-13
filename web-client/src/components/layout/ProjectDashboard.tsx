import { NDKEvent, NDKProject, NDKTask } from "@nostr-dev-kit/ndk-hooks";
import { Plus } from "lucide-react";
import { ProjectColumn } from "../projects/ProjectColumn";
import { Button } from "../ui/button";

interface ProjectDashboardProps {
	projects: NDKProject[];
	filteredProjects: NDKProject[];
	tasks: NDKTask[];
	statusUpdates: NDKEvent[];
	threads: NDKEvent[];
	onProjectClick: (project: NDKProject) => void;
	onTaskCreate: (project: NDKProject) => void;
	onThreadClick: (thread: NDKEvent) => void;
	onCreateProject: () => void;
}

export function ProjectDashboard({
	projects,
	filteredProjects,
	tasks,
	statusUpdates,
	threads,
	onProjectClick,
	onTaskCreate,
	onThreadClick,
	onCreateProject,
}: ProjectDashboardProps) {
	return (
		<div className="flex-1 flex flex-col">
			{/* Top Bar */}
			<div className="bg-card border-b border-border px-6 py-4">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-xl font-semibold text-foreground">
							Projects Dashboard
						</h1>
						<p className="text-sm text-muted-foreground">
							{filteredProjects.length} active projects • {projects.length} total
						</p>
					</div>
				</div>
			</div>

			{/* Main Content - Projects Area */}
			<div className="flex-1 overflow-hidden">
				{filteredProjects.length === 0 ? (
					<div className="h-full flex items-center justify-center">
						<div className="text-center max-w-md">
							{projects.length === 0 ? (
								<>
									<div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mb-4 mx-auto">
										<Plus className="w-8 h-8 text-muted-foreground" />
									</div>
									<h3 className="text-lg font-semibold text-foreground mb-2">
										No projects yet
									</h3>
									<p className="text-muted-foreground mb-4">
										Create your first project to get started.
									</p>
									<Button onClick={onCreateProject}>
										<Plus className="w-4 h-4 mr-2" />
										Create Project
									</Button>
								</>
							) : (
								<>
									<h3 className="text-lg font-semibold text-foreground mb-2">
										No active projects
									</h3>
									<p className="text-muted-foreground mb-4">
										Click on project icons in the sidebar to activate them, or
										create a new project.
									</p>
									<Button onClick={onCreateProject}>
										<Plus className="w-4 h-4 mr-2" />
										Create Project
									</Button>
								</>
							)}
						</div>
					</div>
				) : (
					<div className="h-full overflow-x-auto">
						<div className="flex h-full min-w-max">
							{filteredProjects.map((project) => (
								<ProjectColumn
									key={project.tagId()}
									project={project}
									tasks={tasks}
									statusUpdates={statusUpdates}
									threads={threads}
									onProjectClick={onProjectClick}
									onTaskCreate={onTaskCreate}
									onThreadClick={onThreadClick}
								/>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
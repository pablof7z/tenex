import {
	NDKProject,
	NDKTask,
	useNDKCurrentUser,
	useSubscribe,
} from "@nostr-dev-kit/ndk-hooks";
import { useAtom } from "jotai";
import { Bot, Eye, Plus, Search, Settings } from "lucide-react";
import { useMemo, useState } from "react";
import { selectedTaskAtom } from "../lib/store";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { ProjectColumn } from "./ProjectColumn";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface DesktopLayoutProps {
	onSettings: () => void;
	onAgents: () => void;
	onProjectSelect?: (project: NDKProject) => void;
	onEditProject?: (project: NDKProject) => void;
}

export function DesktopLayout({ onSettings, onAgents, onProjectSelect, onEditProject }: DesktopLayoutProps) {
	const currentUser = useNDKCurrentUser();
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const [activatedProjects, setActivatedProjects] = useState<Set<string>>(
		new Set(),
	);
	const [selectedTask] = useAtom(selectedTaskAtom);

	const { events: projects } = useSubscribe<NDKProject>(
		currentUser
			? [
					{
						kinds: [NDKProject.kind],
						authors: [currentUser.pubkey],
						limit: 50,
					},
				]
			: false,
		{ wrap: true },
		[currentUser?.pubkey],
	);

	const { events: tasks } = useSubscribe<NDKTask>(
		projects.length > 0
			? [
					{
						kinds: [NDKTask.kind],
						"#a": projects.map(
							(p) => `${NDKProject.kind}:${p.pubkey}:${p.tagValue("d")}`,
						),
					},
				]
			: false,
		{ wrap: true },
		[projects.length],
	);

	const { events: statusUpdates } = useSubscribe(
		tasks.length > 0
			? [
					{
						kinds: [1],
						"#e": tasks.map((t) => t.id),
					},
				]
			: false,
		{},
		[tasks.length],
	);

	// Filter projects with activity in last 72 hours OR created in last 24 hours OR manually activated
	const filteredProjects = useMemo(() => {
		const now = Date.now() / 1000;
		const seventyTwoHoursAgo = now - 72 * 60 * 60;
		const twentyFourHoursAgo = now - 24 * 60 * 60;

		return projects.filter((project) => {
			const projectId = project.tagId();

			// Always show if manually activated
			if (activatedProjects.has(projectId)) {
				return true;
			}

			// Check if project was created in last 24 hours
			const projectCreatedAt = project.created_at || 0;
			if (projectCreatedAt > twentyFourHoursAgo) {
				return true;
			}

			// Check if project has activity in last 72 hours
			const projectTasks = tasks.filter((task) => {
				const projectReference = task.tags?.find((tag) => tag[0] === "a")?.[1];
				if (projectReference) {
					const parts = projectReference.split(":");
					if (parts.length >= 3) {
						const projectTagId = parts[2];
						return project.tagValue("d") === projectTagId;
					}
				}
				return false;
			});

			// Check for recent status updates
			const hasRecentActivity = statusUpdates.some((update) => {
				const taskId = update.tags?.find(
					(tag) => tag[0] === "e" && tag[3] === "task",
				)?.[1];
				const isRecentUpdate = (update.created_at || 0) > seventyTwoHoursAgo;
				return (
					isRecentUpdate && projectTasks.some((task) => task.id === taskId)
				);
			});

			return hasRecentActivity;
		});
	}, [projects, tasks, statusUpdates, activatedProjects]);

	const getProjectAvatar = (project: NDKProject) => {
		if (project.picture) {
			return project.picture;
		}
		const seed = project.tagValue("d") || project.title || "default";
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

	const getAvatarColors = (title: string) => {
		const colors = [
			"bg-gradient-to-br from-blue-500 to-blue-600",
			"bg-gradient-to-br from-emerald-500 to-emerald-600",
			"bg-gradient-to-br from-purple-500 to-purple-600",
			"bg-gradient-to-br from-amber-500 to-amber-600",
			"bg-gradient-to-br from-rose-500 to-rose-600",
			"bg-gradient-to-br from-indigo-500 to-indigo-600",
			"bg-gradient-to-br from-teal-500 to-teal-600",
			"bg-gradient-to-br from-orange-500 to-orange-600",
		];
		const index =
			title.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) %
			colors.length;
		return colors[index];
	};

	const toggleProjectActivation = (projectId: string) => {
		setActivatedProjects((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(projectId)) {
				newSet.delete(projectId);
			} else {
				newSet.add(projectId);
			}
			return newSet;
		});
	};

	if (!currentUser) {
		return (
			<div className="h-screen bg-slate-50 flex items-center justify-center">
				<div className="text-center">
					<p className="text-slate-600">No user logged in</p>
				</div>
			</div>
		);
	}

	return (
		<div className="h-screen bg-slate-50 flex">
			{/* Left Sidebar */}
			<div className="w-20 bg-white border-r border-slate-200 flex flex-col">
				{/* Header */}
				<div className="p-4 border-b border-slate-200">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								className="w-8 h-8 p-0 bg-blue-600 rounded-lg hover:bg-blue-700"
							>
								<span className="text-white font-bold text-sm">T</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-48">
							<DropdownMenuItem onClick={onAgents}>
								<Bot className="w-4 h-4 mr-2" />
								Agents
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{/* Project Icons */}
				<div className="flex-1 overflow-y-auto py-4">
					<div className="space-y-2 px-2">
						{projects.map((project) => {
							const title =
								project.title ||
								project.tagValue("title") ||
								"Untitled Project";
							const projectId = project.tagId();
							const isActive = activatedProjects.has(projectId);
							const isInFilteredList = filteredProjects.some(
								(p) => p.tagId() === projectId,
							);

							return (
								<div key={projectId} className="relative">
									<Button
										variant="ghost"
										size="icon"
										className={`w-12 h-12 rounded-xl group relative ${
											isActive
												? "bg-blue-100 text-blue-600"
												: "hover:bg-slate-100"
										}`}
										onClick={() => toggleProjectActivation(projectId)}
										title={title}
									>
										<Avatar className="w-8 h-8">
											<AvatarImage
												src={getProjectAvatar(project)}
												alt={title}
											/>
											<AvatarFallback
												className={`text-white font-semibold text-xs ${getAvatarColors(title)}`}
											>
												{getInitials(title)}
											</AvatarFallback>
										</Avatar>
										{isActive && (
											<Eye className="w-3 h-3 absolute -top-1 -right-1 text-blue-600" />
										)}
									</Button>
									{isInFilteredList && !isActive && (
										<div
											className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"
											title="Has recent activity"
										/>
									)}
								</div>
							);
						})}
					</div>
				</div>

				{/* Bottom Actions */}
				<div className="p-2 border-t border-slate-200 space-y-2">
					<Button
						variant="ghost"
						size="icon"
						className="w-12 h-12 rounded-xl hover:bg-slate-100"
						onClick={() => setShowCreateDialog(true)}
						title="Create Project"
					>
						<Plus className="w-5 h-5" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="w-12 h-12 rounded-xl hover:bg-slate-100"
						title="Search"
					>
						<Search className="w-5 h-5" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="w-12 h-12 rounded-xl hover:bg-slate-100"
						onClick={onSettings}
						title="Settings"
					>
						<Settings className="w-5 h-5" />
					</Button>
				</div>
			</div>

			{/* Main Content Area */}
			<div className="flex-1 flex flex-col">
				{/* Top Bar */}
				<div className="bg-white border-b border-slate-200 px-6 py-4">
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-xl font-semibold text-slate-900">
								Projects Dashboard
							</h1>
							<p className="text-sm text-slate-500">
								{filteredProjects.length} active projects • {projects.length} total
							</p>
						</div>
					</div>
				</div>

				{/* Main Content - Split Screen Layout */}
				<div className="flex-1 overflow-hidden flex">
					{/* Projects Area */}
					<div
						className={`flex-1 overflow-hidden ${selectedTask ? "min-w-0" : ""}`}
						style={{ width: selectedTask ? "50%" : "100%" }}
					>
						{filteredProjects.length === 0 ? (
							<div className="h-full flex items-center justify-center">
								<div className="text-center max-w-md">
									{projects.length === 0 ? (
										<>
											<div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 mx-auto">
												<Plus className="w-8 h-8 text-slate-400" />
											</div>
											<h3 className="text-lg font-semibold text-slate-900 mb-2">
												No projects yet
											</h3>
											<p className="text-slate-600 mb-4">
												Create your first project to get started.
											</p>
											<Button onClick={() => setShowCreateDialog(true)}>
												<Plus className="w-4 h-4 mr-2" />
												Create Project
											</Button>
										</>
									) : (
										<>
											<h3 className="text-lg font-semibold text-slate-900 mb-2">
												No active projects
											</h3>
											<p className="text-slate-600 mb-4">
												Click on project icons in the sidebar to activate them, or create a new project.
											</p>
											<Button onClick={() => setShowCreateDialog(true)}>
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
											onProjectClick={onProjectSelect}
										/>
									))}
								</div>
							</div>
						)}
					</div>

					{/* Task Detail Panel */}
					{selectedTask && (
						<div className="w-1/2 flex-shrink-0">
							<TaskDetailPanel
								task={selectedTask}
								statusUpdates={statusUpdates}
							/>
						</div>
					)}
				</div>
			</div>

			{/* Create Project Dialog */}
			<CreateProjectDialog
				open={showCreateDialog}
				onOpenChange={setShowCreateDialog}
				onProjectCreated={() => {
					// Projects will automatically refresh via the useSubscribe hook
				}}
			/>
		</div>
	);
}

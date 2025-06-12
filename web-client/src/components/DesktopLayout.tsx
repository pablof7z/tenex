import {
	NDKEvent,
	NDKProject,
	NDKTask,
	useNDK,
	useNDKCurrentUser,
	useSubscribe,
} from "@nostr-dev-kit/ndk-hooks";
import { useAtom, useAtomValue } from "jotai";
import {
	Bot,
	Circle,
	FileText,
	Moon,
	Plus,
	Settings,
	Sun,
	Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePendingAgentRequests } from "../hooks/useAppSubscriptions";
import type { ProjectAgent } from "../hooks/useProjectAgents";
import {
	onlineBackendsAtom,
	onlineProjectsAtom,
	selectedProjectAtom,
	selectedTaskAtom,
	selectedThreadAtom,
	themeAtom,
} from "../lib/store";
import { ChatInterface } from "./ChatInterface";
import { SearchIconButton } from "./common/SearchBar";
import { CreateProjectDialog } from "./dialogs/CreateProjectDialog";
import { CreateTaskDialog } from "./dialogs/CreateTaskDialog";
import { GlobalSearchDialog } from "./dialogs/GlobalSearchDialog";
import { TaskCreationOptionsDialog } from "./dialogs/TaskCreationOptionsDialog";
import { ThreadDialog } from "./dialogs/ThreadDialog";
import { VoiceTaskDialog } from "./dialogs/VoiceTaskDialog";
import { ProjectColumn } from "./projects/ProjectColumn";
import { ProjectDetail } from "./projects/ProjectDetail";
import { TaskUpdates } from "./tasks/TaskUpdates";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Sheet, SheetContent } from "./ui/sheet";

interface DesktopLayoutProps {
	onEditProject?: (project: NDKProject) => void;
}

export function DesktopLayout({ onEditProject }: DesktopLayoutProps) {
	const navigate = useNavigate();
	const { ndk } = useNDK();
	const currentUser = useNDKCurrentUser();
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const [showSearchDialog, setShowSearchDialog] = useState(false);
	const [showTaskOptionsDialog, setShowTaskOptionsDialog] = useState(false);
	const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
	const [showVoiceTaskDialog, setShowVoiceTaskDialog] = useState(false);
	const [showThreadDialog, setShowThreadDialog] = useState(false);
	const [selectedProjectForTask, setSelectedProjectForTask] =
		useState<NDKProject | null>(null);
	const [manuallyToggled, setManuallyToggled] = useState<Map<string, boolean>>(
		new Map(),
	);
	const [selectedTask, setSelectedTask] = useAtom(selectedTaskAtom);
	const [selectedThread, setSelectedThread] = useAtom(selectedThreadAtom);
	const [selectedProject, setSelectedProject] = useAtom(selectedProjectAtom);
	const onlineProjects = useAtomValue(onlineProjectsAtom);
	const onlineBackends = useAtomValue(onlineBackendsAtom);
	const [theme, setTheme] = useAtom(themeAtom);
	const pendingAgentRequests = usePendingAgentRequests();

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

	const { events: threads } = useSubscribe(
		projects.length > 0
			? [
					{
						kinds: [11], // Kind 11 for threads
						"#a": projects.map(
							(p) => `${NDKProject.kind}:${p.pubkey}:${p.tagValue("d")}`,
						),
					},
				]
			: false,
		{},
		[projects.length],
	);

	// Filter projects with activity in last 72 hours OR created in last 24 hours OR manually activated
	const filteredProjects = useMemo(() => {
		const now = Date.now() / 1000;
		const seventyTwoHoursAgo = now - 72 * 60 * 60;
		const twentyFourHoursAgo = now - 24 * 60 * 60;

		return projects.filter((project) => {
			const projectId = project.tagId();

			// Check if manually toggled
			if (manuallyToggled.has(projectId)) {
				// User has explicitly set visibility
				return manuallyToggled.get(projectId);
			}

			// Default behavior: show if created in last 24 hours
			const projectCreatedAt = project.created_at || 0;
			if (projectCreatedAt > twentyFourHoursAgo) {
				return true;
			}

			// Default behavior: show if has activity in last 72 hours
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
	}, [projects, tasks, statusUpdates, manuallyToggled]);

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
		setManuallyToggled((prev) => {
			const newMap = new Map(prev);
			const isCurrentlyShown = filteredProjects.some(
				(p) => p.tagId() === projectId,
			);

			// Toggle the visibility
			newMap.set(projectId, !isCurrentlyShown);

			return newMap;
		});
	};

	const handleTaskCreate = (project: NDKProject) => {
		setSelectedProjectForTask(project);
		setShowTaskOptionsDialog(true);
	};

	const handleThreadClick = (thread: NDKEvent) => {
		// Set the selected thread to open in drawer
		setSelectedThread(thread);
	};

	const handleTaskOptionSelect = (option: "task" | "voice" | "thread") => {
		setShowTaskOptionsDialog(false);

		switch (option) {
			case "task":
				setShowCreateTaskDialog(true);
				break;
			case "voice":
				setShowVoiceTaskDialog(true);
				break;
			case "thread":
				setShowThreadDialog(true);
				break;
		}
	};

	if (!currentUser) {
		return (
			<div className="h-screen bg-background flex items-center justify-center">
				<div className="text-center">
					<p className="text-muted-foreground">No user logged in</p>
				</div>
			</div>
		);
	}

	return (
		<div className="h-screen bg-background flex">
			{/* Left Sidebar */}
			<div className="w-16 bg-card border-r border-border flex flex-col">
				{/* Header */}
				<div className="flex items-center justify-center p-2 border-b border-border">
					<Button
						variant="ghost"
						className="w-12 h-12 p-0 bg-primary rounded-lg hover:bg-primary/90"
						disabled
					>
						<span className="text-primary-foreground font-bold text-lg">T</span>
					</Button>
				</div>

				{/* Project Icons */}
				<div className="flex-1 overflow-y-auto py-4">
					<div className="flex flex-col items-center space-y-2">
						{projects.map((project) => {
							const title =
								project.title ||
								project.tagValue("title") ||
								"Untitled Project";
							const projectId = project.tagId();
							const isInFilteredList = filteredProjects.some(
								(p) => p.tagId() === projectId,
							);
							const projectDir = project.tagValue("d") || "";
							const isOnline = onlineProjects.has(projectDir);

							return (
								<div key={projectId} className="relative">
									<Button
										variant="ghost"
										size="icon"
										className={`w-12 h-12 rounded-xl group relative ${
											isInFilteredList
												? "bg-primary/10 text-primary"
												: "hover:bg-accent"
										}`}
										onClick={() => toggleProjectActivation(projectId)}
									>
										<Avatar className="w-8 h-8">
											<AvatarImage
												src={getProjectAvatar(project)}
												alt={title}
											/>
											<AvatarFallback
												className={`text-primary-foreground font-semibold text-xs ${getAvatarColors(title)}`}
											>
												{getInitials(title)}
											</AvatarFallback>
										</Avatar>
									</Button>
									<div
										className="absolute bottom-1 right-1"
										title={
											isOnline
												? "Project is online in a backend"
												: "Click to start project"
										}
									>
										{isOnline ? (
											<Circle className="w-2 h-2 text-green-500 fill-green-500" />
										) : (
											<button
												onClick={(e) => {
													e.stopPropagation();
													if (!ndk) return;
													const event = new NDKEvent(ndk);
													event.kind = 24020;
													event.tag(project);
													event.publish();
												}}
												className="hover:opacity-80 transition-opacity"
											>
												<Circle className="w-2 h-2 text-gray-400 fill-gray-400" />
											</button>
										)}
									</div>
								</div>
							);
						})}
					</div>
				</div>

				{/* Bottom Actions */}
				<div className="flex flex-col items-center p-2 border-t border-border space-y-2">
					<Button
						variant="ghost"
						size="icon"
						className="w-12 h-12 rounded-xl hover:bg-accent"
						onClick={() => setShowCreateDialog(true)}
					>
						<Plus className="w-5 h-5" />
					</Button>
					<SearchIconButton
						onClick={() => setShowSearchDialog(true)}
						size="lg"
						className="rounded-xl hover:bg-accent"
					/>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="w-12 h-12 rounded-xl hover:bg-accent relative"
							>
								<Settings className="w-5 h-5" />
								{pendingAgentRequests > 0 && (
									<span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs font-medium flex items-center justify-center">
										{pendingAgentRequests}
									</span>
								)}
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-48">
							<DropdownMenuItem
								onClick={() => navigate("/agent-requests")}
								className="cursor-pointer"
							>
								<Users className="w-4 h-4 mr-2" />
								<span className="flex-1">Your agents</span>
								{pendingAgentRequests > 0 && (
									<Badge variant="destructive" className="ml-2">
										{pendingAgentRequests}
									</Badge>
								)}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => navigate("/agents")}>
								<Bot className="w-4 h-4 mr-2" />
								Agents
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => navigate("/instructions")}>
								<FileText className="w-4 h-4 mr-2" />
								Instructions
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
							>
								{theme === "dark" ? (
									<Sun className="w-4 h-4 mr-2" />
								) : (
									<Moon className="w-4 h-4 mr-2" />
								)}
								{theme === "dark" ? "Light Mode" : "Dark Mode"}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => navigate("/settings")}>
								<Settings className="w-4 h-4 mr-2" />
								Settings
							</DropdownMenuItem>
							{onlineBackends.size > 0 && (
								<>
									<DropdownMenuSeparator />
									<DropdownMenuLabel className="text-xs">
										Online Backends
									</DropdownMenuLabel>
									{Array.from(onlineBackends.values()).map((backend) => (
										<DropdownMenuItem
											key={backend.hostname}
											className="text-xs"
											disabled
										>
											<Circle className="w-2 h-2 text-green-500 fill-green-500 mr-2" />
											{backend.hostname}
											<span className="ml-auto text-muted-foreground">
												{backend.projects.length} projects
											</span>
										</DropdownMenuItem>
									))}
								</>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			{/* Main Content Area */}
			<div className="flex-1 flex flex-col">
				{/* Top Bar */}
				<div className="bg-card border-b border-border px-6 py-4">
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-xl font-semibold text-foreground">
								Projects Dashboard
							</h1>
							<p className="text-sm text-muted-foreground">
								{filteredProjects.length} active projects • {projects.length}{" "}
								total
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
										<Button onClick={() => setShowCreateDialog(true)}>
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
										threads={threads}
										onProjectClick={(project) => setSelectedProject(project)}
										onTaskCreate={handleTaskCreate}
										onThreadClick={handleThreadClick}
									/>
								))}
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Task Detail Drawer */}
			<Sheet
				open={!!selectedTask}
				onOpenChange={(open) => !open && setSelectedTask(null)}
			>
				<SheetContent side="right" className="w-full sm:max-w-2xl p-0">
					{selectedTask &&
						(() => {
							// Find the project for this task
							const project = projects.find((p) => {
								const projectReference = selectedTask.tags?.find(
									(tag) => tag[0] === "a",
								)?.[1];
								if (projectReference) {
									const parts = projectReference.split(":");
									if (parts.length >= 3) {
										const projectTagId = parts[2];
										return p.tagValue("d") === projectTagId;
									}
								}
								return false;
							});

							if (!project) return null;

							return (
								<TaskUpdates
									project={project}
									taskId={selectedTask.id}
									onBack={() => setSelectedTask(null)}
									embedded={true}
								/>
							);
						})()}
				</SheetContent>
			</Sheet>

			{/* Thread Detail Drawer */}
			<Sheet
				open={!!selectedThread}
				onOpenChange={(open) => !open && setSelectedThread(null)}
			>
				<SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col overflow-hidden">
					{selectedThread &&
						(() => {
							// Find the project for this thread
							const project = projects.find((p) => {
								const projectRef = selectedThread.tags?.find(
									(tag) => tag[0] === "a",
								)?.[1];
								if (projectRef) {
									const parts = projectRef.split(":");
									if (parts.length >= 3) {
										const projectTagId = parts[2];
										return p.tagValue("d") === projectTagId;
									}
								}
								return false;
							});

							if (!project) return null;

							const threadTitle =
								selectedThread.tags?.find(
									(tag: string[]) => tag[0] === "title",
								)?.[1] ||
								selectedThread.content?.split("\n")[0] ||
								"Thread";

							// Extract selected agents from temporary thread object
							const tempThread = selectedThread as NDKEvent & {
								selectedAgents?: ProjectAgent[];
							};
							const initialAgentPubkeys =
								tempThread.selectedAgents?.map((a) => a.pubkey) || [];

							return (
								<ChatInterface
									project={project}
									threadId={selectedThread.id}
									threadTitle={threadTitle}
									initialAgentPubkeys={initialAgentPubkeys}
									onBack={() => setSelectedThread(null)}
									className="h-full overflow-hidden"
								/>
							);
						})()}
				</SheetContent>
			</Sheet>

			{/* Create Project Dialog */}
			<CreateProjectDialog
				open={showCreateDialog}
				onOpenChange={setShowCreateDialog}
				onProjectCreated={() => {
					// Projects will automatically refresh via the useSubscribe hook
				}}
			/>

			{/* Global Search Dialog */}
			<GlobalSearchDialog
				open={showSearchDialog}
				onOpenChange={setShowSearchDialog}
			/>

			{/* Task Creation Options Dialog */}
			<TaskCreationOptionsDialog
				open={showTaskOptionsDialog}
				onOpenChange={setShowTaskOptionsDialog}
				onOptionSelect={handleTaskOptionSelect}
			/>

			{/* Create Task Dialog */}
			{selectedProjectForTask && (
				<CreateTaskDialog
					open={showCreateTaskDialog}
					onOpenChange={setShowCreateTaskDialog}
					project={selectedProjectForTask}
					onTaskCreated={() => {
						setShowCreateTaskDialog(false);
						setSelectedProjectForTask(null);
					}}
				/>
			)}

			{/* Voice Task Dialog */}
			{selectedProjectForTask && (
				<VoiceTaskDialog
					open={showVoiceTaskDialog}
					onOpenChange={setShowVoiceTaskDialog}
					project={selectedProjectForTask}
					onTaskCreated={() => {
						setShowVoiceTaskDialog(false);
						setSelectedProjectForTask(null);
					}}
				/>
			)}

			{/* Thread Dialog */}
			{selectedProjectForTask && (
				<ThreadDialog
					open={showThreadDialog}
					onOpenChange={setShowThreadDialog}
					project={selectedProjectForTask}
					onThreadStart={(title, selectedAgents) => {
						setShowThreadDialog(false);

						// Create a temporary thread object to open the chat interface
						// No event is published yet - that happens when the first message is sent
						const tempThread = {
							id: "new",
							content: "",
							tags: [
								["title", title],
								["a", selectedProjectForTask.tagId()],
							],
							selectedAgents, // Store agents temporarily on the object
						} as NDKEvent & { selectedAgents?: ProjectAgent[] };

						// Set the thread as selected to open in drawer
						setSelectedThread(tempThread);
						setSelectedProjectForTask(null);
					}}
				/>
			)}

			{/* Project Detail Drawer */}
			<Sheet
				open={!!selectedProject}
				onOpenChange={(open) => !open && setSelectedProject(null)}
			>
				<SheetContent side="right" className="w-full sm:max-w-2xl p-0">
					{selectedProject && (
						<ProjectDetail
							project={selectedProject}
							onBack={() => setSelectedProject(null)}
							onTaskSelect={(_, taskId) => {
								// Find the task by its ID
								const task = tasks.find((t) => t.encode() === taskId);
								if (task) {
									setSelectedTask(task);
								}
							}}
							onEditProject={onEditProject || (() => {})}
							onThreadStart={(project, threadTitle, selectedAgents) => {
								// Create a temporary thread object to open the chat interface
								// No event is published yet - that happens when the first message is sent
								const tempThread = {
									id: "new",
									content: "",
									tags: [
										["title", threadTitle],
										["a", project.tagId()],
									],
									selectedAgents, // Store agents temporarily on the object
								} as NDKEvent & { selectedAgents?: ProjectAgent[] };

								// Set the thread as selected to open in drawer
								setSelectedThread(tempThread);
							}}
							onThreadSelect={(_, threadId) => {
								// Find the thread by its ID
								const thread = threads.find((t) => t.encode() === threadId);
								if (thread) {
									setSelectedThread(thread);
								}
							}}
						/>
					)}
				</SheetContent>
			</Sheet>
		</div>
	);
}

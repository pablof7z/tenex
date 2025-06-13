import { type NDKEvent, NDKProject, NDKTask } from "@nostr-dev-kit/ndk-hooks";
import { useNDKCurrentUser, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { Menu, MoreVertical, Plus, Settings, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { usePendingAgentRequests } from "../../hooks/useAppSubscriptions";
import { useNavigation } from "../../contexts/NavigationContext";
import { SearchIconButton } from "../common/SearchBar";
import { CreateProjectDialog } from "../dialogs/CreateProjectDialog";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface ProjectListProps {}

// Remove props - navigation is handled by context

// Helper function to mark all status updates for a project as seen
const markProjectStatusUpdatesSeen = (
	_projectId: string,
	projectStatusUpdates: NDKEvent[],
) => {
	const seenUpdates = JSON.parse(
		localStorage.getItem("seenStatusUpdates") || "{}",
	);
	projectStatusUpdates.forEach((update) => {
		seenUpdates[update.id] = true;
	});
	localStorage.setItem("seenStatusUpdates", JSON.stringify(seenUpdates));
};

export function ProjectList({}: ProjectListProps) {
	const currentUser = useNDKCurrentUser();
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const { goToProject, goToSettings, goToAgentRequests } = useNavigation();
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

	// Get all tasks for these projects to subscribe to their status updates
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

	// Get status updates for all tasks (NIP-22 replies - kind 1111 events with 'e' tag referencing any task)
	const { events: statusUpdates } = useSubscribe(
		tasks.length > 0
			? [
					{
						kinds: [1111],
						"#e": tasks.map((t) => t.id),
					},
				]
			: false,
		{},
		[tasks.length],
	);

	// Create maps for project activity and status updates
	const { projectActivityMap, mostRecentStatusMap, unreadCountMap } =
		useMemo(() => {
			const activityMap = new Map<string, number>();
			const statusMap = new Map<string, string>();
			const unreadMap = new Map<string, number>();

			// Initialize with project creation dates
			projects.forEach((project) => {
				const projectId = project.tagId();
				activityMap.set(projectId, project.created_at || 0);
			});

			// Get seen status updates from localStorage
			const seenUpdates = JSON.parse(
				localStorage.getItem("seenStatusUpdates") || "{}",
			);

			// Map status updates to projects and track unseen ones
			statusUpdates.forEach((update) => {
				// Find which task this update belongs to
				const taskId = update.tags?.find(
					(tag) => tag[0] === "e" && tag[3] === "task",
				)?.[1];
				if (taskId) {
					// Find which project this task belongs to
					const task = tasks.find((t) => t.id === taskId);
					if (task) {
						const projectReference = task.tags?.find(
							(tag) => tag[0] === "a",
						)?.[1];
						if (projectReference) {
							// Extract project tagId from the 'a' tag reference
							const parts = projectReference.split(":");
							if (parts.length >= 3) {
								const projectTagId = parts[2];
								const project = projects.find(
									(p) => p.tagValue("d") === projectTagId,
								);
								if (project) {
									const projectId = project.tagId();
									const currentActivity = activityMap.get(projectId) || 0;
									const updateTime = update.created_at || 0;

									if (updateTime > currentActivity) {
										activityMap.set(projectId, updateTime);
										statusMap.set(projectId, update.content);
									}

									// Count unseen updates
									if (!seenUpdates[update.id]) {
										const currentUnread = unreadMap.get(projectId) || 0;
										unreadMap.set(projectId, currentUnread + 1);
									}
								}
							}
						}
					}
				}
			});

			return {
				projectActivityMap: activityMap,
				mostRecentStatusMap: statusMap,
				unreadCountMap: unreadMap,
			};
		}, [projects, tasks, statusUpdates]);

	// Sort projects by most recent activity
	const sortedProjects = useMemo(() => {
		return [...projects].sort((a, b) => {
			const activityA = projectActivityMap.get(a.tagId()) || 0;
			const activityB = projectActivityMap.get(b.tagId()) || 0;
			return activityB - activityA; // Most recent first
		});
	}, [projects, projectActivityMap]);

	if (!currentUser) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<div className="text-center">
					<p className="text-muted-foreground">No user logged in</p>
				</div>
			</div>
		);
	}

	const formatRelativeTime = (timestamp: number) => {
		const date = new Date(timestamp * 1000);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return "now";
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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

	const getProjectAvatar = (project: NDKProject) => {
		if (project.picture) {
			return project.picture;
		}
		// Use dicebear with project's d tag as seed
		const seed = project.tagValue("d") || project.title || "default";
		return `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(seed)}`;
	};

	return (
		<div className="min-h-screen bg-background">
			{/* Header */}
			<div className="bg-card border-b border-border/60 backdrop-blur-xl bg-card/95 sticky top-0 z-50">
				<div className="flex items-center justify-between px-3 sm:px-4 py-3 sm:py-4">
					<div className="flex items-center gap-2 sm:gap-3">
						<Button
							variant="ghost"
							size="icon"
							className="w-8 h-8 sm:w-9 sm:h-9 text-primary hover:bg-accent"
						>
							<Menu className="w-4 h-4 sm:w-5 sm:h-5" />
						</Button>
						<div>
							<h1 className="text-lg sm:text-xl font-semibold text-foreground">
								Projects
							</h1>
							<p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
								{projects.length} projects
							</p>
						</div>
					</div>
					<div className="flex items-center gap-1">
						<SearchIconButton
							onClick={() => {
								// TODO: Implement search functionality
							}}
							size="sm"
							className="sm:w-9 sm:h-9"
						/>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="w-8 h-8 sm:w-9 sm:h-9 text-primary hover:bg-accent relative"
								>
									<Settings className="w-4 h-4 sm:w-5 sm:h-5" />
									{pendingAgentRequests > 0 && (
										<span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs font-medium flex items-center justify-center">
											{pendingAgentRequests}
										</span>
									)}
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-56">
								<DropdownMenuItem
									onClick={goToAgentRequests}
									className="cursor-pointer"
								>
									<Users className="mr-2 h-4 w-4" />
									<span className="flex-1">Your agents</span>
									{pendingAgentRequests > 0 && (
										<Badge variant="destructive" className="ml-2">
											{pendingAgentRequests}
										</Badge>
									)}
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={goToSettings}
									className="cursor-pointer"
								>
									<Settings className="mr-2 h-4 w-4" />
									Settings
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			</div>

			{/* Project List */}
			<div
				className="pb-safe-or-6"
				style={{
					paddingBottom:
						"max(6rem, calc(env(safe-area-inset-bottom) + 1.5rem))",
				}}
			>
				{projects.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-20 sm:py-32 px-4 sm:px-6 text-center">
						<div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-muted to-accent rounded-full flex items-center justify-center mb-4 sm:mb-6 shadow-sm">
							<Plus className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" />
						</div>
						<h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2 sm:mb-3">
							No projects yet
						</h3>
						<p className="text-muted-foreground mb-6 sm:mb-8 max-w-sm leading-relaxed text-sm sm:text-base">
							Create your first project to start collaborating and managing your
							work efficiently.
						</p>
						<Button
							variant="primary"
							size="default"
							rounded="full"
							onClick={() => setShowCreateDialog(true)}
						>
							<Plus className="w-4 h-4 mr-2" />
							Create Project
						</Button>
					</div>
				) : (
					<div className="space-y-0.5 sm:space-y-1 px-1 sm:px-2 pt-1 sm:pt-2">
						{sortedProjects.map((project) => {
							const title =
								project.title ||
								project.tagValue("title") ||
								"Untitled Project";
							const lastActivityTime =
								projectActivityMap.get(project.tagId()) ||
								project.created_at ||
								0;
							const mostRecentStatus = mostRecentStatusMap.get(project.tagId());
							const unreadCount = unreadCountMap.get(project.tagId()) || 0;

							const handleProjectClick = () => {
								// Get all status updates for this project to mark them as seen
								const projectTasks = tasks.filter((task) => {
									const projectReference = task.tags?.find(
										(tag) => tag[0] === "a",
									)?.[1];
									if (projectReference) {
										const parts = projectReference.split(":");
										if (parts.length >= 3) {
											const projectTagId = parts[2];
											return project.tagValue("d") === projectTagId;
										}
									}
									return false;
								});

								const projectStatusUpdates = statusUpdates.filter((update) => {
									const taskId = update.tags?.find(
										(tag) => tag[0] === "e" && tag[3] === "task",
									)?.[1];
									return projectTasks.some((task) => task.id === taskId);
								});

								markProjectStatusUpdatesSeen(
									project.tagId(),
									projectStatusUpdates,
								);
								goToProject(project);
							};

							return (
								<div
									key={project.tagId()}
									className="group flex items-center p-2.5 sm:p-3 mx-0.5 sm:mx-1 rounded-lg sm:rounded-xl bg-card/50 hover:bg-card/80 cursor-pointer transition-all duration-200 ease-out hover:shadow-sm active:scale-[0.98] border border-border/40 hover:border-border"
									onClick={handleProjectClick}
								>
									{/* Avatar */}
									<div className="relative">
										<Avatar className="w-12 h-12 sm:w-14 sm:h-14 shadow-sm flex-shrink-0">
											<AvatarImage
												src={getProjectAvatar(project)}
												alt={project.title || "Project"}
											/>
											<AvatarFallback
												className={`text-white font-semibold text-base sm:text-lg ${getAvatarColors(project.title || "Project")}`}
											>
												{getInitials(project.title || "Project")}
											</AvatarFallback>
										</Avatar>
									</div>

									{/* Content */}
									<div className="flex-1 min-w-0 ml-3 sm:ml-4">
										<div className="flex items-start justify-between mb-0.5 sm:mb-1">
											<div className="flex-1 min-w-0">
												<h3 className="font-semibold text-foreground truncate text-sm sm:text-[15px] leading-tight">
													{title}
												</h3>
												<div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1">
													<span className="text-xs text-muted-foreground hidden sm:inline">
														•
													</span>
													<span className="text-xs text-muted-foreground hidden sm:inline">
														{formatRelativeTime(lastActivityTime)}
													</span>
												</div>
											</div>
											<div className="flex items-center gap-1.5">
												{unreadCount > 0 && (
													<Badge
														variant="destructive"
														className="h-5 px-1.5 text-xs font-medium"
													>
														{unreadCount}
													</Badge>
												)}
												<div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
													<Button
														variant="ghost"
														size="icon"
														className="w-7 h-7 sm:w-8 sm:h-8 text-muted-foreground hover:text-primary hover:bg-accent"
													>
														<MoreVertical className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
													</Button>
												</div>
											</div>
										</div>
										<p className="text-xs sm:text-sm text-muted-foreground truncate leading-relaxed">
											{mostRecentStatus ||
												project.tagValue("summary") ||
												`${project.content?.slice(0, 60)}...` ||
												"No recent activity"}
										</p>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Floating Action Button */}
			<div
				className="fixed right-4 sm:right-6 z-40 bottom-tab-safe"
				style={{
					bottom: "max(5rem, calc(env(safe-area-inset-bottom) + 1rem))",
				}}
			>
				<Button
					variant="primary"
					size="icon-lg"
					rounded="full"
					className="shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95"
					onClick={() => setShowCreateDialog(true)}
				>
					<Plus className="w-6 h-6" />
				</Button>
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

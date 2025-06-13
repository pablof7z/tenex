import { NDKEvent, NDKProject, useNDK } from "@nostr-dev-kit/ndk-hooks";
import { useAtomValue } from "jotai";
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
import { useNavigate } from "react-router-dom";
import { usePendingAgentRequests } from "../../hooks/useAppSubscriptions";
import { onlineBackendsAtom } from "../../lib/store";
import { SearchIconButton } from "../common/SearchBar";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface ProjectSidebarProps {
	projects: NDKProject[];
	filteredProjects: NDKProject[];
	onlineProjects: Set<string>;
	theme: string;
	onThemeChange: (theme: string) => void;
	onProjectToggle: (projectId: string) => void;
	onCreateProject: () => void;
	onSearch: () => void;
}

export function ProjectSidebar({
	projects,
	filteredProjects,
	onlineProjects,
	theme,
	onThemeChange,
	onProjectToggle,
	onCreateProject,
	onSearch,
}: ProjectSidebarProps) {
	const navigate = useNavigate();
	const { ndk } = useNDK();
	const onlineBackends = useAtomValue(onlineBackendsAtom);
	const pendingAgentRequests = usePendingAgentRequests();

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

	return (
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
									onClick={() => onProjectToggle(projectId)}
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
					onClick={onCreateProject}
				>
					<Plus className="w-5 h-5" />
				</Button>
				<SearchIconButton
					onClick={onSearch}
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
							onClick={() => onThemeChange(theme === "dark" ? "light" : "dark")}
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
	);
}
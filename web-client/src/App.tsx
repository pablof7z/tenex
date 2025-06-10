import {
	NDKHeadless,
	type NDKProject,
	NDKSessionLocalStorage,
	useNDKCurrentPubkey,
} from "@nostr-dev-kit/ndk-hooks";
import { useEffect, useRef, useState } from "react";
import { AgentsPage } from "./components/AgentsPage";
import { BottomTabBar } from "./components/BottomTabBar";
import { ChatInterface } from "./components/ChatInterface";
import { ChatsPage } from "./components/ChatsPage";
import { DesktopLayout } from "./components/DesktopLayout";
import { ProjectSettings } from "./components/ProjectSettings";
import { LoginScreen } from "./components/LoginScreen";
import { ProjectDetail } from "./components/ProjectDetail";
import { ProjectList } from "./components/ProjectList";
import { SettingsPage } from "./components/SettingsPage";
import { TaskUpdates } from "./components/TaskUpdates";
import { useBackendStatus } from "./hooks/useBackendStatus";

type AppState =
	| { view: "login" }
	| { view: "projects" }
	| { view: "chats" }
	| { view: "settings" }
	| { view: "agents" }
	| { view: "project-detail"; project: NDKProject }
	| { view: "task-updates"; project: NDKProject; taskId: string }
	| { view: "edit-project"; project: NDKProject }
	| {
			view: "thread-chat";
			project: NDKProject;
			threadId: string;
			threadTitle: string;
	  };

function App() {
	const sessionStorage = useRef(new NDKSessionLocalStorage());
	const currentPubkey = useNDKCurrentPubkey();
	const [appState, setAppState] = useState<AppState>({ view: "projects" });
	const [isDesktop, setIsDesktop] = useState(false);

	// Initialize backend status tracking
	useBackendStatus();

	// Check if we're on desktop
	useEffect(() => {
		const checkIsDesktop = () => {
			setIsDesktop(window.innerWidth >= 1024);
		};

		checkIsDesktop();
		window.addEventListener("resize", checkIsDesktop);

		return () => window.removeEventListener("resize", checkIsDesktop);
	}, []);

	const handleProjectSelect = (project: NDKProject) => {
		setAppState({ view: "project-detail", project });
	};

	const handleTaskSelect = (project: NDKProject, taskId: string) => {
		setAppState({ view: "task-updates", project, taskId });
	};

	const handleEditProject = (project: NDKProject) => {
		setAppState({ view: "edit-project", project });
	};

	const handleBackToProjects = () => {
		setAppState({ view: "projects" });
	};

	const handleSettings = () => {
		setAppState({ view: "settings" });
	};

	const handleAgents = () => {
		setAppState({ view: "agents" });
	};

	const handleBackToProject = () => {
		if (appState.view === "task-updates") {
			setAppState({ view: "project-detail", project: appState.project });
		} else if (appState.view === "edit-project") {
			setAppState({ view: "project-detail", project: appState.project });
		} else if (appState.view === "thread-chat") {
			setAppState({ view: "project-detail", project: appState.project });
		}
	};

	const handleThreadStart = (project: NDKProject, threadTitle: string) => {
		setAppState({ view: "thread-chat", project, threadId: "", threadTitle });
	};

	const handleThreadSelect = (
		project: NDKProject,
		threadId: string,
		threadTitle: string,
	) => {
		setAppState({ view: "thread-chat", project, threadId, threadTitle });
	};

	const handleTabChange = (tab: "projects" | "chats") => {
		setAppState({ view: tab });
	};

	const renderCurrentView = () => {
		if (!currentPubkey) {
			return <LoginScreen />;
		}

		// Use desktop layout for projects view on desktop
		if (isDesktop) {
			// In desktop mode, show DesktopLayout for the main view
			// and overlay the detail views when needed
			if (appState.view === "projects") {
				return (
					<DesktopLayout 
						onSettings={handleSettings} 
						onAgents={handleAgents}
						onProjectSelect={handleProjectSelect}
						onEditProject={handleEditProject}
					/>
				);
			} else if (appState.view === "project-detail") {
				return (
					<ProjectDetail
						project={appState.project}
						onBack={handleBackToProjects}
						onTaskSelect={handleTaskSelect}
						onEditProject={handleEditProject}
						onThreadStart={handleThreadStart}
						onThreadSelect={handleThreadSelect}
					/>
				);
			} else if (appState.view === "edit-project") {
				return (
					<ProjectSettings
						project={appState.project}
						onBack={handleBackToProject}
						onProjectUpdated={() => {
							// Projects will automatically refresh via useSubscribe
						}}
					/>
				);
			} else if (appState.view === "settings") {
				return <SettingsPage onBack={handleBackToProjects} />;
			} else if (appState.view === "agents") {
				return <AgentsPage onBack={handleBackToProjects} />;
			} else if (appState.view === "task-updates") {
				return (
					<TaskUpdates
						project={appState.project}
						taskId={appState.taskId}
						onBack={handleBackToProject}
					/>
				);
			} else if (appState.view === "thread-chat") {
				return (
					<ChatInterface
						project={appState.project}
						threadId={appState.threadId}
						threadTitle={appState.threadTitle}
						onBack={handleBackToProject}
					/>
				);
			}
		}

		switch (appState.view) {
			case "projects":
				return (
					<ProjectList
						onProjectSelect={handleProjectSelect}
						onSettings={handleSettings}
					/>
				);
			case "chats":
				return <ChatsPage onTaskSelect={handleTaskSelect} />;
			case "settings":
				return <SettingsPage onBack={handleBackToProjects} />;
			case "agents":
				return <AgentsPage onBack={handleBackToProjects} />;
			case "project-detail":
				return (
					<ProjectDetail
						project={appState.project}
						onBack={handleBackToProjects}
						onTaskSelect={handleTaskSelect}
						onEditProject={handleEditProject}
						onThreadStart={handleThreadStart}
						onThreadSelect={handleThreadSelect}
					/>
				);
			case "task-updates":
				return (
					<TaskUpdates
						project={appState.project}
						taskId={appState.taskId}
						onBack={handleBackToProject}
					/>
				);
			case "edit-project":
				return (
					<ProjectSettings
						project={appState.project}
						onBack={handleBackToProject}
						onProjectUpdated={() => {
							// Projects will automatically refresh via useSubscribe
						}}
					/>
				);
			case "thread-chat":
				return (
					<ChatInterface
						project={appState.project}
						threadId={appState.threadId}
						threadTitle={appState.threadTitle}
						onBack={handleBackToProject}
					/>
				);
			default:
				return (
					<ProjectList
						onProjectSelect={handleProjectSelect}
						onSettings={handleSettings}
					/>
				);
		}
	};

	const showTabBar =
		currentPubkey &&
		(appState.view === "projects" || appState.view === "chats") &&
		!isDesktop;
	const currentTab = appState.view === "chats" ? "chats" : "projects";

	return (
		<>
			<NDKHeadless
				ndk={{
					explicitRelayUrls: [
						"wss://relay.primal.net",
						"wss://purplepag.es",
						"wss://relay.damus.io",
						"wss://nos.lol",
					],
				}}
				session={{
					storage: sessionStorage.current,
					opts: { follows: true, profile: true },
				}}
			/>
			{renderCurrentView()}
			{showTabBar && (
				<BottomTabBar activeTab={currentTab} onTabChange={handleTabChange} />
			)}
		</>
	);
}

export default App;

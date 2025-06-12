import NDKCacheSQLiteWASM from "@nostr-dev-kit/ndk-cache-sqlite-wasm";
import {
	NDKHeadless,
	NDKSessionLocalStorage,
	useNDKCurrentPubkey,
} from "@nostr-dev-kit/ndk-hooks";
import { useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import {
	BrowserRouter,
	Navigate,
	Outlet,
	Route,
	Routes,
	useLocation,
	useNavigate,
	useParams,
} from "react-router-dom";
import { AgentsPage } from "./components/AgentsPage";
import { AgentRequestsPage } from "./components/AgentRequestsPage";
import { ChatInterface } from "./components/ChatInterface";
import { ChatsPage } from "./components/ChatsPage";
import { DesktopLayout } from "./components/DesktopLayout";
import { InstructionsPage } from "./components/InstructionsPage";
import { ProjectSettings } from "./components/ProjectSettings";
import { SettingsPage } from "./components/SettingsPage";
import { LoginScreen } from "./components/auth/LoginScreen";
import { BottomTabBar } from "./components/navigation/BottomTabBar";
import { ProjectDetail } from "./components/projects/ProjectDetail";
import { ProjectList } from "./components/projects/ProjectList";
import { TaskUpdates } from "./components/tasks/TaskUpdates";
import { useBackendStatus } from "./hooks/useBackendStatus";
import { useProject } from "./hooks/useProject";
import { useProjectStatus } from "./hooks/useProjectStatus";
import { useAppSubscriptions } from "./hooks/useAppSubscriptions";
import { themeAtom } from "./lib/store";

// Layout component that wraps authenticated routes
function AuthLayout() {
	const currentPubkey = useNDKCurrentPubkey();
	const theme = useAtomValue(themeAtom);
	const [isDesktop, setIsDesktop] = useState(false);
	const navigate = useNavigate();
	const location = useLocation();

	// Initialize backend status tracking
	useBackendStatus();

	// Initialize project status tracking for online badges
	useProjectStatus();
	
	// Initialize app-level subscriptions
	useAppSubscriptions();

	// Apply theme class to document element
	useEffect(() => {
		if (theme === "dark") {
			document.documentElement.classList.add("dark");
		} else {
			document.documentElement.classList.remove("dark");
		}
	}, [theme]);

	// Check if we're on desktop
	useEffect(() => {
		const checkIsDesktop = () => {
			setIsDesktop(window.innerWidth >= 1024);
		};

		checkIsDesktop();
		window.addEventListener("resize", checkIsDesktop);

		return () => window.removeEventListener("resize", checkIsDesktop);
	}, []);

	// Redirect to login if not authenticated
	if (!currentPubkey) {
		return <Navigate to="/login" replace />;
	}

	// Determine if we should show the tab bar
	const showTabBar =
		!isDesktop &&
		(location.pathname === "/" ||
			location.pathname === "/projects" ||
			location.pathname === "/chats");
	const currentTab = location.pathname === "/chats" ? "chats" : "projects";

	return (
		<>
			<Outlet />
			{showTabBar && (
				<BottomTabBar
					activeTab={currentTab}
					onTabChange={(tab) => navigate(tab === "chats" ? "/chats" : "/")}
				/>
			)}
		</>
	);
}

// Wrapper components for passing navigation functions
function ProjectListWrapper() {
	const navigate = useNavigate();
	return (
		<ProjectList
			onProjectSelect={(project) => navigate(`/project/${project.encode()}`)}
			onSettings={() => navigate("/settings")}
		/>
	);
}

function ProjectDetailWrapper() {
	const { projectId } = useParams();
	const navigate = useNavigate();
	const project = useProject(projectId);

	if (!project) {
		return (
			<div className="flex items-center justify-center h-screen">
				Loading...
			</div>
		);
	}

	return (
		<ProjectDetail
			project={project}
			onBack={() => navigate("/")}
			onTaskSelect={(project, taskId) =>
				navigate(`/project/${project.encode()}/task/${taskId}`)
			}
			onEditProject={(project) => navigate(`/project/${project.encode()}/edit`)}
			onThreadStart={(project, threadTitle, selectedAgents) => {
				const searchParams = new URLSearchParams();
				searchParams.set("title", threadTitle);
				if (selectedAgents && selectedAgents.length > 0) {
					searchParams.set(
						"agents",
						selectedAgents.map((a) => a.pubkey).join(","),
					);
				}
				navigate(
					`/project/${project.encode()}/thread/new?${searchParams.toString()}`,
				);
			}}
			onThreadSelect={(project, threadId) =>
				navigate(`/project/${project.encode()}/thread/${threadId}`)
			}
		/>
	);
}

function DesktopLayoutWrapper() {
	const navigate = useNavigate();
	return (
		<DesktopLayout
			onEditProject={(project) => navigate(`/project/${project.encode()}/edit`)}
		/>
	);
}

// Responsive wrapper for root path
function ResponsiveRootWrapper() {
	const [isDesktop, setIsDesktop] = useState(false);

	useEffect(() => {
		const checkIsDesktop = () => {
			setIsDesktop(window.innerWidth >= 1024);
		};

		checkIsDesktop();
		window.addEventListener("resize", checkIsDesktop);

		return () => window.removeEventListener("resize", checkIsDesktop);
	}, []);

	// Show desktop layout on desktop, project list on mobile
	return isDesktop ? <DesktopLayoutWrapper /> : <ProjectListWrapper />;
}

function SettingsPageWrapper() {
	const navigate = useNavigate();
	return <SettingsPage onBack={() => navigate(-1)} />;
}

function AgentsPageWrapper() {
	const navigate = useNavigate();
	return <AgentsPage onBack={() => navigate(-1)} />;
}

function InstructionsPageWrapper() {
	const navigate = useNavigate();
	return <InstructionsPage onBack={() => navigate(-1)} />;
}

function AgentRequestsPageWrapper() {
	return <AgentRequestsPage />;
}

function ChatsPageWrapper() {
	const navigate = useNavigate();
	return (
		<ChatsPage
			onTaskSelect={(project, taskId) =>
				navigate(`/project/${project.encode()}/task/${taskId}`)
			}
		/>
	);
}

function TaskUpdatesWrapper() {
	const { projectId, taskId } = useParams();
	const navigate = useNavigate();
	const project = useProject(projectId);

	if (!project) {
		return (
			<div className="flex items-center justify-center h-screen">
				Loading...
			</div>
		);
	}

	return (
		<TaskUpdates
			project={project}
			taskId={taskId || ""}
			onBack={() => navigate(-1)}
		/>
	);
}

function ProjectSettingsWrapper() {
	const { projectId } = useParams();
	const navigate = useNavigate();
	const project = useProject(projectId);

	if (!project) {
		return (
			<div className="flex items-center justify-center h-screen">
				Loading...
			</div>
		);
	}

	return (
		<ProjectSettings
			project={project}
			onBack={() => navigate(-1)}
			onProjectUpdated={() => {
				// Projects will automatically refresh via useSubscribe
			}}
		/>
	);
}

function ChatInterfaceWrapper() {
	const { projectId, threadId } = useParams();
	const navigate = useNavigate();
	const location = useLocation();
	const project = useProject(projectId);

	// Get thread title and agents from query params
	const searchParams = new URLSearchParams(location.search);
	const threadTitle = searchParams.get("title") || "";
	const agentPubkeys =
		searchParams.get("agents")?.split(",").filter(Boolean) || [];

	if (!project) {
		return (
			<div className="flex items-center justify-center h-screen">
				Loading...
			</div>
		);
	}

	return (
		<ChatInterface
			project={project}
			threadId={threadId || ""}
			threadTitle={threadTitle}
			initialAgentPubkeys={agentPubkeys}
			onBack={() => navigate(-1)}
			className="h-screen"
		/>
	);
}

function AppContent() {
	const sessionStorage = useRef(new NDKSessionLocalStorage());
	const cache = useRef<NDKCacheSQLiteWASM | null>(null);

	// Initialize SQLite cache
	useEffect(() => {
		if (!cache.current) {
			cache.current = new NDKCacheSQLiteWASM({
				dbName: "tenex-cache",
				wasmUrl: "/sql-wasm.wasm",
				workerUrl: "/worker.js",
			});
		}
	}, []);

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
					cacheAdapter: cache.current || undefined,
				}}
				session={{
					storage: sessionStorage.current,
					opts: { follows: true, profile: true },
				}}
			/>
			<Routes>
				<Route path="/login" element={<LoginScreen />} />
				<Route element={<AuthLayout />}>
					{/* Root path - show desktop layout on desktop, project list on mobile */}
					<Route path="/" element={<ResponsiveRootWrapper />} />
					<Route path="/projects" element={<ProjectListWrapper />} />
					<Route path="/chats" element={<ChatsPageWrapper />} />
					<Route path="/settings" element={<SettingsPageWrapper />} />
					<Route path="/agents" element={<AgentsPageWrapper />} />
					<Route path="/instructions" element={<InstructionsPageWrapper />} />
					<Route path="/agent-requests" element={<AgentRequestsPageWrapper />} />
					<Route
						path="/project/:projectId"
						element={<ProjectDetailWrapper />}
					/>
					<Route
						path="/project/:projectId/edit"
						element={<ProjectSettingsWrapper />}
					/>
					<Route
						path="/project/:projectId/task/:taskId"
						element={<TaskUpdatesWrapper />}
					/>
					<Route
						path="/project/:projectId/thread/:threadId"
						element={<ChatInterfaceWrapper />}
					/>
					<Route
						path="/project/:projectId/thread/new"
						element={<ChatInterfaceWrapper />}
					/>
				</Route>
			</Routes>
		</>
	);
}

function App() {
	return (
		<BrowserRouter>
			<AppContent />
		</BrowserRouter>
	);
}

export default App;

import NDKCacheSQLiteWASM from "@nostr-dev-kit/ndk-cache-sqlite-wasm";
import { NDKHeadless, NDKSessionLocalStorage } from "@nostr-dev-kit/ndk-hooks";
import { useAtomValue } from "jotai";
import { useEffect, useRef } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
const DEFAULT_RELAYS = ["wss://tenex.chat"];
import { Toaster } from "sonner";
import { LoginScreen } from "./components/auth/LoginScreen";
import { AuthLayout } from "./components/layout/AuthLayout";
import {
    AgentRequestsPageWrapper,
    AgentsPageWrapper,
    ChatInterfacePage,
    ChatsPageWrapper,
    DocsPageWrapper,
    DocumentationViewPage,
    InstructionsPageWrapper,
    MCPToolsPageWrapper,
    ProjectDetailPage,
    ProjectListPage,
    ProjectProfilePage,
    RootPage,
    SettingsPageWrapper,
    TaskUpdatesPage,
} from "./components/routes/RouteComponents";
import { NavigationProvider } from "./contexts/NavigationContext";
import { themeAtom } from "./lib/store";
import type { NDKCacheAdapter } from "@nostr-dev-kit/ndk-hooks";

function AppContent() {
    const sessionStorage = useRef(new NDKSessionLocalStorage());
    const cache = useRef<NDKCacheAdapter | null>(null);
    const theme = useAtomValue(themeAtom);

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
                    explicitRelayUrls: [...DEFAULT_RELAYS, "wss://purplepag.es"],
                    cacheAdapter: cache.current || undefined,
                    enableOutboxModel: false,
                    autoConnectUserRelays: false,
                }}
                session={{
                    storage: sessionStorage.current,
                    opts: { follows: true, profile: true },
                }}
            />
            <Toaster
                position="top-right"
                toastOptions={{
                    style: {
                        background: theme === "dark" ? "#1a1a1a" : "#ffffff",
                        color: theme === "dark" ? "#ffffff" : "#000000",
                        border: theme === "dark" ? "1px solid #333" : "1px solid #e5e5e5",
                    },
                }}
            />
            <NavigationProvider>
                <Routes>
                    <Route path="/login" element={<LoginScreen />} />
                    {/* <Route path="/blossom-test" element={<BlossomTestPageWrapper />} /> */}
                    <Route element={<AuthLayout />}>
                        {/* Root path - show desktop layout on desktop, project list on mobile */}
                        <Route path="/" element={<RootPage />} />
                        <Route path="/projects" element={<ProjectListPage />} />
                        <Route path="/chats" element={<ChatsPageWrapper />} />
                        <Route path="/settings" element={<SettingsPageWrapper />} />
                        <Route path="/agents" element={<AgentsPageWrapper />} />
                        <Route path="/mcp-tools" element={<MCPToolsPageWrapper />} />
                        <Route path="/instructions" element={<InstructionsPageWrapper />} />
                        <Route path="/agent-requests" element={<AgentRequestsPageWrapper />} />
                        <Route path="/project/:projectId" element={<ProjectDetailPage />} />
                        <Route path="/project/:projectId/profile" element={<ProjectProfilePage />} />
                        <Route
                            path="/project/:projectId/task/:taskId"
                            element={<TaskUpdatesPage />}
                        />
                        <Route
                            path="/project/:projectId/thread/:threadId"
                            element={<ChatInterfacePage />}
                        />
                        <Route
                            path="/project/:projectId/thread/new"
                            element={<ChatInterfacePage />}
                        />
                        <Route path="/project/:projectId/docs" element={<DocsPageWrapper />} />
                        <Route
                            path="/project/:projectId/article/:articleId"
                            element={<DocumentationViewPage />}
                        />
                    </Route>
                </Routes>
            </NavigationProvider>
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

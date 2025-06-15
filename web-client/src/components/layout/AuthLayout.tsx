import { useNDKCurrentPubkey } from "@nostr-dev-kit/ndk-hooks";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useNavigation } from "../../contexts/NavigationContext";
import { useAgentLessons } from "../../hooks/useAgentLessons";
import { useAppSubscriptions } from "../../hooks/useAppSubscriptions";
import { useBackendStatus } from "../../hooks/useBackendStatus";
import { useProjectStatus } from "../../hooks/useProjectStatus";
import { themeAtom } from "../../lib/store";
import { BottomTabBar } from "../navigation/BottomTabBar";

export function AuthLayout() {
    const currentPubkey = useNDKCurrentPubkey();
    const theme = useAtomValue(themeAtom);
    const [isDesktop, setIsDesktop] = useState(false);
    const { navigate, location } = useNavigation();

    // Initialize backend status tracking
    useBackendStatus();

    // Initialize project status tracking for online badges
    useProjectStatus();

    // Initialize agent lessons monitoring
    useAgentLessons();

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

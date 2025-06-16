import { useNDKCurrentPubkey } from "@nostr-dev-kit/ndk-hooks";
import { useAtomValue } from "jotai";
import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAgentLessons } from "../../hooks/useAgentLessons";
import { useAppSubscriptions } from "../../hooks/useAppSubscriptions";
import { useBackendStatus } from "../../hooks/useBackendStatus";
import { useProjectStatus } from "../../hooks/useProjectStatus";
import { themeAtom } from "../../lib/store";

export function AuthLayout() {
    const currentPubkey = useNDKCurrentPubkey();
    const theme = useAtomValue(themeAtom);

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

    // Redirect to login if not authenticated
    if (!currentPubkey) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}

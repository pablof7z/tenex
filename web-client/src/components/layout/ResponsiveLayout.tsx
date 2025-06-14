import { useEffect, useState } from "react";
import { DesktopLayout } from "../DesktopLayout";
import { ProjectList } from "../projects/ProjectList";
import { BottomTabBar } from "../navigation/BottomTabBar";
import { useNavigation } from "../../contexts/NavigationContext";

export function ResponsiveLayout() {
    const [isDesktop, setIsDesktop] = useState(false);
    const { location, navigate } = useNavigation();

    useEffect(() => {
        const checkIsDesktop = () => {
            setIsDesktop(window.innerWidth >= 1024);
        };

        checkIsDesktop();
        window.addEventListener("resize", checkIsDesktop);
        return () => window.removeEventListener("resize", checkIsDesktop);
    }, []);

    // Determine if we should show the tab bar
    const showTabBar =
        !isDesktop &&
        (location.pathname === "/" ||
            location.pathname === "/projects" ||
            location.pathname === "/chats");

    const currentTab = location.pathname === "/chats" ? "chats" : "projects";

    if (isDesktop) {
        return <DesktopLayout />;
    }

    return (
        <>
            <ProjectList />
            {showTabBar && (
                <BottomTabBar
                    activeTab={currentTab}
                    onTabChange={(tab) => navigate(tab === "chats" ? "/chats" : "/")}
                />
            )}
        </>
    );
}

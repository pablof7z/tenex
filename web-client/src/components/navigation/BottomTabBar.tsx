import { Folder, MessageCircle } from "lucide-react";

interface BottomTabBarProps {
    activeTab: "projects" | "chats";
    onTabChange: (tab: "projects" | "chats") => void;
}

export function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
    const tabs = [
        {
            id: "projects" as const,
            label: "Projects",
            icon: Folder,
        },
        {
            id: "chats" as const,
            label: "Chats",
            icon: MessageCircle,
        },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 pb-safe">
            <div className="flex">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`flex-1 flex flex-col items-center justify-center py-3 px-1 transition-colors ${
                                isActive
                                    ? "text-primary bg-primary/10"
                                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                            }`}
                        >
                            <Icon className={`w-5 h-5 mb-1 ${isActive ? "text-primary" : ""}`} />
                            <span
                                className={`text-xs font-medium ${isActive ? "text-primary" : ""}`}
                            >
                                {tab.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

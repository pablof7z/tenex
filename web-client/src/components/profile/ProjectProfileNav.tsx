import { Home, Users, BookOpen } from "lucide-react";
import { cn } from "../../lib/utils";
import type { ProjectProfileTab } from "./ProjectProfile";

interface ProjectProfileNavProps {
    activeTab: ProjectProfileTab;
    onTabChange: (tab: ProjectProfileTab) => void;
}

const navItems = [
    { id: "home" as const, label: "Home", icon: Home },
    { id: "agents" as const, label: "Agents", icon: Users },
    { id: "docs" as const, label: "Docs", icon: BookOpen },
];

export function ProjectProfileNav({ activeTab, onTabChange }: ProjectProfileNavProps) {
    return (
        <nav className="w-64 flex-shrink-0 px-4 py-6">
            <div className="space-y-1">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    
                    return (
                        <button
                            key={item.id}
                            onClick={() => onTabChange(item.id)}
                            className={cn(
                                "flex items-center space-x-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            )}
                        >
                            <Icon className="w-5 h-5" />
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
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
		<div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 pb-safe">
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
									? "text-blue-600 bg-blue-50/50"
									: "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
							}`}
						>
							<Icon
								className={`w-5 h-5 mb-1 ${isActive ? "text-blue-600" : ""}`}
							/>
							<span
								className={`text-xs font-medium ${isActive ? "text-blue-600" : ""}`}
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

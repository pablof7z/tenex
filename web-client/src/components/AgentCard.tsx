import { Bot, Check } from "lucide-react";
import type { NDKAgent } from "../events/agent";
import { ProfileDisplay } from "./ProfileDisplay";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

interface AgentCardProps {
	agent: NDKAgent;
	isSelected: boolean;
	onSelect: (agent: NDKAgent) => void;
	onDeselect: (agent: NDKAgent) => void;
}

export function AgentCard({
	agent,
	isSelected,
	onSelect,
	onDeselect,
}: AgentCardProps) {
	const handleToggle = () => {
		if (isSelected) {
			onDeselect(agent);
		} else {
			onSelect(agent);
		}
	};

	const agentTags = agent.tags
		.filter((tag) => tag[0] === "t")
		.map((tag) => tag[1]);

	return (
		<div
			className={`p-4 border rounded-lg transition-all duration-200 hover:bg-slate-50 ${
				isSelected ? "border-blue-500 bg-blue-50/30" : "border-slate-200"
			}`}
		>
			<div className="flex items-start justify-between">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-2">
						<Bot className="w-4 h-4 text-slate-500 flex-shrink-0" />
						<h3 className="font-medium text-slate-900 truncate">
							{agent.name || "Unnamed Agent"}
						</h3>
						{isSelected && (
							<Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
						)}
					</div>

					{agent.description && (
						<p className="text-sm text-slate-600 mb-3 leading-relaxed">
							{agent.description}
						</p>
					)}

					{agent.role && (
						<p className="text-sm text-blue-600 mb-2 font-medium">
							Role: {agent.role}
						</p>
					)}

					<div className="flex items-center gap-4 text-xs text-slate-500 mb-2">
						<ProfileDisplay
							pubkey={agent.pubkey || ""}
							size="sm"
							nameClassName="text-slate-600"
						/>
						{agent.version && <span>v{agent.version}</span>}
					</div>

					{agentTags.length > 0 && (
						<div className="flex flex-wrap gap-1">
							{agentTags.map((tag, index) => (
								<Badge
									key={index}
									variant="outline"
									className="text-xs h-5 px-2"
								>
									{tag}
								</Badge>
							))}
						</div>
					)}
				</div>

				<div className="flex items-center gap-2 ml-4">
					<Button
						variant={isSelected ? "default" : "outline"}
						size="sm"
						onClick={handleToggle}
						className={`h-8 min-w-[80px] ${isSelected ? "bg-blue-600 hover:bg-blue-700" : ""}`}
					>
						{isSelected ? "Selected" : "Select"}
					</Button>
				</div>
			</div>
		</div>
	);
}

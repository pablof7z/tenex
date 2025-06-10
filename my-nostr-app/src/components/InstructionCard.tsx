import { useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { Bot, Check, ChevronDown, Eye, Users } from "lucide-react";
import { NDKAgent } from "../events/agent";
import type { NDKLLMRule } from "../types/template";
import { ProfileDisplay } from "./ProfileDisplay";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface InstructionCardProps {
	instruction: NDKLLMRule;
	isSelected: boolean;
	selectedAgents: NDKAgent[];
	onSelect: (instruction: NDKLLMRule, agentNames: string[]) => void;
	onDeselect: (instruction: NDKLLMRule) => void;
	onPreview: (instruction: NDKLLMRule) => void;
}

export function InstructionCard({
	instruction,
	isSelected,
	selectedAgents,
	onSelect,
	onDeselect,
	onPreview,
}: InstructionCardProps) {
	const { events: agentEvents } = useSubscribe<NDKAgent>(
		[{ kinds: [NDKAgent.kind], limit: 100 }],
		{ wrap: true },
		[],
	);

	const handleToggle = () => {
		if (isSelected) {
			onDeselect(instruction);
		}
	};

	const handleAgentSelect = (agentNames: string[]) => {
		onSelect(instruction, agentNames);
	};

	const handlePreview = (e: React.MouseEvent) => {
		e.stopPropagation();
		onPreview(instruction);
	};

	return (
		<div
			className={`p-4 border rounded-lg transition-all duration-200 hover:bg-slate-50 ${
				isSelected ? "border-blue-500 bg-blue-50/30" : "border-slate-200"
			}`}
		>
			<div className="flex items-start justify-between">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-2">
						<h3 className="font-medium text-slate-900 truncate">
							{instruction.title || "Untitled Instruction"}
						</h3>
						{isSelected && (
							<Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
						)}
					</div>

					{instruction.description && (
						<p className="text-sm text-slate-600 mb-3 leading-relaxed">
							{instruction.description}
						</p>
					)}

					<div className="flex items-center gap-4 text-xs text-slate-500 mb-2">
						<ProfileDisplay
							pubkey={instruction.pubkey || ""}
							size="sm"
							nameClassName="text-slate-600"
						/>
						{instruction.version && <span>v{instruction.version}</span>}
					</div>

					{instruction.hashtags && instruction.hashtags.length > 0 && (
						<div className="flex flex-wrap gap-1">
							{instruction.hashtags.map((tag, index) => (
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
						variant="outline"
						size="sm"
						onClick={handlePreview}
						className="h-8"
					>
						<Eye className="w-3 h-3 mr-1" />
						Preview
					</Button>
					{isSelected ? (
						<Button
							variant="default"
							size="sm"
							onClick={handleToggle}
							className="h-8 min-w-[80px] bg-blue-600 hover:bg-blue-700"
						>
							<Check className="w-3 h-3 mr-1" />
							Selected
						</Button>
					) : (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									className="h-8 min-w-[80px]"
								>
									Select
									<ChevronDown className="w-3 h-3 ml-1" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-56">
								<DropdownMenuLabel>Assign to agents</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={() => handleAgentSelect([])}>
									<Users className="w-4 h-4 mr-2" />
									All agents
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								{selectedAgents.map((agent) => (
									<DropdownMenuItem
										key={agent.id}
										onClick={() => handleAgentSelect([agent.name || "unnamed"])}
									>
										<Bot className="w-4 h-4 mr-2" />
										{agent.name || "Unnamed Agent"}
									</DropdownMenuItem>
								))}
								{selectedAgents.length === 0 && (
									<DropdownMenuItem disabled>
										<Bot className="w-4 h-4 mr-2" />
										No agents selected in project
									</DropdownMenuItem>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					)}
				</div>
			</div>
		</div>
	);
}

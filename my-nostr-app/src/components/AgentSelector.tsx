import { useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { Bot, Filter, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { NDKAgent } from "../events/agent";
import { AgentCard } from "./AgentCard";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface AgentSelectorProps {
	selectedAgents: NDKAgent[];
	onAgentsChange: (agents: NDKAgent[]) => void;
}

export function AgentSelector({
	selectedAgents,
	onAgentsChange,
}: AgentSelectorProps) {
	const [search, setSearch] = useState("");
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [showFilters, setShowFilters] = useState(false);

	const { events: agentEvents } = useSubscribe<NDKAgent>(
		[{ kinds: [NDKAgent.kind], limit: 100 }],
		{ wrap: true },
		[],
	);

	const agents = useMemo(() => {
		let filtered = agentEvents;

		if (search.trim()) {
			const searchLower = search.toLowerCase();
			filtered = filtered.filter(
				(agent) =>
					agent.name?.toLowerCase().includes(searchLower) ||
					agent.description?.toLowerCase().includes(searchLower) ||
					agent.role?.toLowerCase().includes(searchLower),
			);
		}

		if (selectedTags.length > 0) {
			filtered = filtered.filter((agent) => {
				const agentTags = agent.tags
					.filter((tag) => tag[0] === "t")
					.map((tag) => tag[1]);
				return selectedTags.some((tag) => agentTags.includes(tag));
			});
		}

		return filtered;
	}, [agentEvents, search, selectedTags]);

	const allTags = useMemo(() => {
		const tagSet = new Set<string>();
		agentEvents.forEach((agent) => {
			agent.tags
				.filter((tag) => tag[0] === "t")
				.forEach((tag) => tagSet.add(tag[1]));
		});
		return Array.from(tagSet).sort();
	}, [agentEvents]);

	const handleTagToggle = (tag: string) => {
		setSelectedTags((prev) =>
			prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
		);
	};

	const clearFilters = () => {
		setSearch("");
		setSelectedTags([]);
	};

	const handleAgentSelect = (agent: NDKAgent) => {
		if (!selectedAgents.find((a) => a.id === agent.id)) {
			onAgentsChange([...selectedAgents, agent]);
		}
	};

	const handleAgentDeselect = (agent: NDKAgent) => {
		onAgentsChange(selectedAgents.filter((a) => a.id !== agent.id));
	};

	const clearAllSelections = () => {
		onAgentsChange([]);
	};

	const hasActiveFilters = search.length > 0 || selectedTags.length > 0;

	return (
		<div className="space-y-4">
			{/* Search and Filter Controls */}
			<div className="space-y-3">
				{/* Search Bar */}
				<div className="relative">
					<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
					<Input
						placeholder="Search agents..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="pl-10 pr-10"
					/>
					{search && (
						<Button
							variant="ghost"
							size="icon"
							className="absolute right-1 top-1/2 transform -translate-y-1/2 w-6 h-6"
							onClick={() => setSearch("")}
						>
							<X className="w-3 h-3" />
						</Button>
					)}
				</div>

				{/* Filter Toggle */}
				<div className="flex items-center justify-between">
					<Button
						variant="outline"
						size="sm"
						onClick={() => setShowFilters(!showFilters)}
						className="h-8"
					>
						<Filter className="w-3 h-3 mr-2" />
						Filters
						{selectedTags.length > 0 && (
							<Badge variant="secondary" className="ml-2 h-4 px-1.5 text-xs">
								{selectedTags.length}
							</Badge>
						)}
					</Button>
					{hasActiveFilters && (
						<Button
							variant="ghost"
							size="sm"
							onClick={clearFilters}
							className="h-8 text-slate-600"
						>
							Clear filters
						</Button>
					)}
				</div>

				{/* Tag Filters */}
				{showFilters && allTags.length > 0 && (
					<div className="p-3 bg-slate-50 rounded-lg border">
						<h4 className="text-sm font-medium text-slate-700 mb-2">
							Filter by tag:
						</h4>
						<div className="flex flex-wrap gap-2">
							{allTags.map((tag) => (
								<Badge
									key={tag}
									variant={selectedTags.includes(tag) ? "default" : "outline"}
									className="cursor-pointer hover:bg-slate-200 text-xs h-6 px-2"
									onClick={() => handleTagToggle(tag)}
								>
									{tag}
								</Badge>
							))}
						</div>
					</div>
				)}
			</div>

			{/* Selection Summary */}
			<div className="flex items-center justify-between text-sm text-slate-600">
				<span>
					{agents.length} agent{agents.length !== 1 ? "s" : ""} available
					{selectedAgents.length > 0 && (
						<span className="text-blue-600 font-medium ml-2">
							• {selectedAgents.length} selected
						</span>
					)}
				</span>
				{selectedAgents.length > 0 && (
					<Button
						variant="ghost"
						size="sm"
						onClick={clearAllSelections}
						className="h-7 text-slate-600"
					>
						Clear all selections
					</Button>
				)}
			</div>

			{/* Agents List */}
			{agents.length === 0 ? (
				<div className="text-center py-12">
					<div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
						<Bot className="w-6 h-6 text-slate-400" />
					</div>
					<h3 className="text-lg font-medium text-slate-900 mb-2">
						No agents found
					</h3>
					<p className="text-slate-600 mb-4">
						{hasActiveFilters
							? "Try adjusting your search or filters"
							: "No agents are available yet"}
					</p>
					{hasActiveFilters && (
						<Button variant="outline" onClick={clearFilters}>
							Clear filters
						</Button>
					)}
				</div>
			) : (
				<div className="space-y-3">
					{agents.map((agent) => (
						<AgentCard
							key={agent.id}
							agent={agent}
							isSelected={selectedAgents.some((a) => a.id === agent.id)}
							onSelect={handleAgentSelect}
							onDeselect={handleAgentDeselect}
						/>
					))}
				</div>
			)}
		</div>
	);
}

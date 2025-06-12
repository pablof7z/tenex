import type { NDKProject } from "@nostr-dev-kit/ndk-hooks";
import { ArrowRight, AtSign, Bot } from "lucide-react";
import { useState } from "react";
import {
	type ProjectAgent,
	useProjectAgents,
} from "../../hooks/useProjectAgents";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";

interface ThreadDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	project: NDKProject;
	onThreadStart?: (title: string, selectedAgents: ProjectAgent[]) => void;
}

export function ThreadDialog({
	open,
	onOpenChange,
	project,
	onThreadStart,
}: ThreadDialogProps) {
	const [title, setTitle] = useState("");
	const [selectedAgents, setSelectedAgents] = useState<ProjectAgent[]>([]);

	// Get available agents from project status events
	const projectAgents = useProjectAgents(project?.tagId());

	const handleStart = () => {
		if (!title.trim()) {
			alert("Please enter a thread title");
			return;
		}

		onThreadStart?.(title.trim(), selectedAgents);
		setTitle("");
		setSelectedAgents([]);
		onOpenChange(false);
	};

	const toggleAgent = (agent: ProjectAgent) => {
		setSelectedAgents((prev) => {
			const isSelected = prev.some((a) => a.pubkey === agent.pubkey);
			if (isSelected) {
				return prev.filter((a) => a.pubkey !== agent.pubkey);
			} else {
				return [...prev, agent];
			}
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-full max-w-md">
				<DialogHeader>
					<DialogTitle>New Thread</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<Input
							id="thread-title"
							placeholder="Enter thread title..."
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && title.trim()) {
									handleStart();
								}
							}}
						/>
						<p className="text-xs text-slate-500">
							You'll be taken to the chat interface to start the conversation.
						</p>
					</div>

					{/* Agent Selection */}
					<div className="space-y-2">
						<label className="text-sm font-medium text-foreground">
							Tag Agents (Optional)
						</label>
						<p className="text-xs text-muted-foreground mb-2">
							Select agents to be notified of this thread
						</p>

						{projectAgents.length > 0 ? (
							<div className="flex flex-wrap gap-2">
								{projectAgents.map((agent) => {
									const isSelected = selectedAgents.some(
										(a) => a.pubkey === agent.pubkey,
									);
									return (
										<Badge
											key={agent.pubkey}
											variant={isSelected ? "default" : "outline"}
											className="cursor-pointer select-none"
											onClick={() => toggleAgent(agent)}
										>
											<AtSign className="w-3 h-3 mr-1" />
											{agent.name}
										</Badge>
									);
								})}
							</div>
						) : (
							<div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
								<Bot className="w-4 h-4" />
								<span>No agents online in this project</span>
							</div>
						)}
					</div>
				</div>

				<DialogFooter>
					<Button onClick={handleStart} disabled={!title.trim()}>
						Continue
						<ArrowRight className="w-4 h-4 mr-2" />
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

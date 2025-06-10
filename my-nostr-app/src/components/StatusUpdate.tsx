import { type NDKEvent, NDKUser } from "@nostr-dev-kit/ndk";
import { useNDKCurrentPubkey, useProfileValue } from "@nostr-dev-kit/ndk-hooks";
import { Brain, GitCommit, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";

interface StatusUpdateProps {
	event: NDKEvent;
}

export function StatusUpdate({ event }: StatusUpdateProps) {
	const profile = useProfileValue(event.pubkey);
	const currentPubkey = useNDKCurrentPubkey();

	const formatTimestamp = (timestamp: number) => {
		const date = new Date(timestamp * 1000);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return "just now";
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString();
	};

	const getDisplayName = () => {
		if (event.pubkey === currentPubkey) return "You";
		return (
			profile?.displayName ||
			profile?.name ||
			`user_${event.pubkey.slice(0, 8)}`
		);
	};

	const getConfidenceLevel = () => {
		return event.tagValue("confidence");
	};

	const getCommitHash = () => {
		return event.tagValue("commit");
	};

	const getAgentName = () => {
		return profile?.name || event.tagValue("agent") || "Agent";
	};

	const isUserMessage = () => {
		return (
			event.tagValue("t") === "task-comment" || event.pubkey === currentPubkey
		);
	};

	const isAgentUpdate = () => {
		return !!event.tagValue("agent") || !!event.tagValue("confidence");
	};

	if (isUserMessage()) {
		// User message - align right, different styling
		return (
			<div className="flex justify-end p-3">
				<div className="max-w-[80%]">
					<div className="bg-blue-600 text-white rounded-lg px-3 py-2">
						<div className="text-sm whitespace-pre-wrap leading-relaxed">
							{event.content}
						</div>
					</div>
					<div className="text-xs text-slate-500 mt-1 text-right">
						{formatTimestamp(event.created_at!)}
					</div>
				</div>
			</div>
		);
	}

	// Agent update - align left, original styling
	return (
		<div className="flex gap-3 p-3 hover:bg-slate-50/50 rounded-lg transition-colors">
			{/* Avatar */}
			<div className="flex-shrink-0">
				<Avatar className="w-8 h-8">
					<AvatarImage src={profile?.image} alt={profile?.name || "Agent"} />
					<AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs">
						{isAgentUpdate() ? (
							<Brain className="w-4 h-4" />
						) : (
							profile?.name?.charAt(0).toUpperCase() ||
							event.pubkey.slice(0, 2).toUpperCase()
						)}
					</AvatarFallback>
				</Avatar>
			</div>

			{/* Content */}
			<div className="flex-1 min-w-0">
				{/* Header */}
				<div className="flex items-center gap-2 mb-1">
					<span className="font-semibold text-sm text-slate-900">
						{isAgentUpdate() ? getAgentName() : getDisplayName()}
					</span>
					<span className="text-xs text-slate-500">
						{formatTimestamp(event.created_at!)}
					</span>
					{getConfidenceLevel() && (
						<Badge variant="secondary" className="text-xs h-5 px-2">
							{getConfidenceLevel()}/10
						</Badge>
					)}
				</div>

				{/* Message content */}
				<div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed mb-2">
					{event.content}
				</div>

				{/* Footer with commit info */}
				{getCommitHash() && (
					<div className="flex items-center gap-2 text-xs text-slate-500">
						<GitCommit className="w-3 h-3" />
						<span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
							{getCommitHash()?.slice(0, 7)}
						</span>
					</div>
				)}
			</div>
		</div>
	);
}

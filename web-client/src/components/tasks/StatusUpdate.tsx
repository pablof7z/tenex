import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { useNDKCurrentPubkey, useProfileValue } from "@nostr-dev-kit/ndk-hooks";
import {
	Brain,
	Cpu,
	DollarSign,
	GitCommit,
} from "lucide-react";
import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import { useTimeFormat } from "../../hooks/useTimeFormat";
import { LLMMetadataDialog } from "../dialogs/LLMMetadataDialog";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Badge } from "../ui/badge";

interface StatusUpdateProps {
	event: NDKEvent;
}

export const StatusUpdate = memo(function StatusUpdate({ event }: StatusUpdateProps) {
	const profile = useProfileValue(event.pubkey);
	const currentPubkey = useNDKCurrentPubkey();
	const { formatRelativeTime } = useTimeFormat();
	const [showMetadataDialog, setShowMetadataDialog] = useState(false);

	// Custom components for ReactMarkdown
	const markdownComponents = {
		code({ node, inline, className, children, ...props }: any) {
			const match = /language-(\w+)/.exec(className || "");
			return !inline && match ? (
				<SyntaxHighlighter
					style={oneDark}
					language={match[1]}
					PreTag="div"
					className="rounded-md text-xs font-mono"
					customStyle={{ fontSize: "0.75rem" }}
					{...props}
				>
					{String(children).replace(/\n$/, "")}
				</SyntaxHighlighter>
			) : (
				<code
					className="bg-muted px-1 py-0.5 rounded text-xs font-mono"
					{...props}
				>
					{children}
				</code>
			);
		},
		pre({ children }: any) {
			return <div className="my-2 overflow-x-auto font-mono">{children}</div>;
		},
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

	const getLLMMetadata = () => {
		const metadata: Record<string, string> = {};

		// Extract all LLM-related tags
		const llmTags = [
			"llm-model",
			"llm-provider",
			"llm-prompt-tokens",
			"llm-completion-tokens",
			"llm-total-tokens",
			"llm-cache-creation-tokens",
			"llm-cache-read-tokens",
			"llm-confidence",
			"llm-cost",
			"llm-cost-usd",
			"llm-system-prompt",
			"llm-user-prompt",
		];

		for (const tag of llmTags) {
			const value = event.tagValue(tag);
			if (value) {
				metadata[tag] = value;
			}
		}

		return Object.keys(metadata).length > 0 ? metadata : null;
	};


	if (isUserMessage()) {
		// User message - align right, different styling
		return (
			<div className="flex justify-end p-3">
				<div className="max-w-[80%]">
					<div className="bg-primary text-primary-foreground rounded-lg px-3 py-2">
						<div className="text-sm leading-relaxed prose prose-sm prose-invert max-w-none prose-p:my-1 prose-headings:text-primary-foreground prose-a:text-primary-foreground prose-a:underline prose-strong:text-primary-foreground prose-blockquote:text-primary-foreground/80 prose-blockquote:border-l-primary-foreground prose-ul:list-disc prose-ul:list-inside prose-ol:list-decimal prose-ol:list-inside prose-li:my-0.5 prose-ul:my-1 prose-ol:my-1">
							<ReactMarkdown
								remarkPlugins={[remarkGfm]}
								components={markdownComponents}
							>
								{event.content}
							</ReactMarkdown>
						</div>
					</div>
					<div className="text-xs text-muted-foreground mt-1 text-right">
						{formatRelativeTime(event.created_at!)}
					</div>
				</div>
			</div>
		);
	}

	// Agent update - align left, original styling
	return (
		<>
			<div className="flex gap-3 p-3 hover:bg-accent/50 rounded-lg transition-colors">
				{/* Avatar */}
				<div className="flex-shrink-0">
					<Avatar className="w-8 h-8">
						<AvatarImage src={profile?.image} alt={profile?.name || "Agent"} />
						<AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-primary-foreground text-xs">
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
						<span className="font-semibold text-sm text-foreground">
							{isAgentUpdate() ? getAgentName() : getDisplayName()}
						</span>
						<span className="text-xs text-muted-foreground">
							{formatRelativeTime(event.created_at!)}
						</span>
						{/* LLM Metadata Icon - shown when metadata exists */}
						{getLLMMetadata() && (
							<button
								onClick={() => setShowMetadataDialog(true)}
								className="text-muted-foreground hover:text-foreground transition-colors"
								title="View LLM metadata"
							>
								<Cpu className="w-3.5 h-3.5" />
							</button>
						)}
						{getConfidenceLevel() && (
							<Badge variant="secondary" className="text-xs h-5 px-2">
								{getConfidenceLevel()}/10
							</Badge>
						)}
						{(getLLMMetadata()?.["llm-cost-usd"] ||
							getLLMMetadata()?.["llm-cost"]) && (
							<Badge
								variant="outline"
								className="text-xs h-5 px-2 text-green-600 border-green-600"
							>
								<DollarSign className="w-3 h-3 mr-0.5" />
								{getLLMMetadata()?.["llm-cost-usd"] ||
									getLLMMetadata()?.["llm-cost"]}
							</Badge>
						)}
					</div>

					{/* Message content */}
					<div className="text-sm text-foreground/90 leading-relaxed mb-2 prose prose-sm max-w-none prose-p:my-1 prose-headings:text-foreground prose-a:text-primary prose-strong:text-foreground prose-blockquote:text-muted-foreground prose-blockquote:border-l-primary prose-ul:list-disc prose-ul:list-inside prose-ol:list-decimal prose-ol:list-inside prose-li:my-0.5 prose-ul:my-1 prose-ol:my-1">
						<ReactMarkdown
							remarkPlugins={[remarkGfm]}
							components={markdownComponents}
						>
							{event.content}
						</ReactMarkdown>
					</div>

					{/* Footer with commit info and LLM metadata */}
					<div className="flex flex-col gap-2">
						{getCommitHash() && (
							<div className="flex items-center gap-2 text-xs text-muted-foreground">
								<GitCommit className="w-3 h-3" />
								<span className="font-mono bg-muted px-1.5 py-0.5 rounded">
									{getCommitHash()?.slice(0, 7)}
								</span>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* LLM Metadata Dialog */}
			{getLLMMetadata() && (
				<LLMMetadataDialog
					open={showMetadataDialog}
					onOpenChange={setShowMetadataDialog}
					metadata={getLLMMetadata()!}
				/>
			)}
		</>
	);
});

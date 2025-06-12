import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { useNDKCurrentPubkey, useProfileValue } from "@nostr-dev-kit/ndk-hooks";
import {
	Brain,
	ChevronDown,
	ChevronUp,
	Cpu,
	DollarSign,
	GitCommit,
	Hash,
	Zap,
} from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import { useTimeFormat } from "../../hooks/useTimeFormat";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Badge } from "../ui/badge";

interface StatusUpdateProps {
	event: NDKEvent;
}

export function StatusUpdate({ event }: StatusUpdateProps) {
	const profile = useProfileValue(event.pubkey);
	const currentPubkey = useNDKCurrentPubkey();
	const { formatRelativeTime } = useTimeFormat();
	const [showMetadata, setShowMetadata] = useState(false);

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
		];

		for (const tag of llmTags) {
			const value = event.tagValue(tag);
			if (value) {
				metadata[tag] = value;
			}
		}

		return Object.keys(metadata).length > 0 ? metadata : null;
	};

	const formatTokenCount = (count: string | undefined) => {
		if (!count) return "0";
		const num = Number.parseInt(count);
		if (num >= 1000) {
			return `${(num / 1000).toFixed(1)}k`;
		}
		return count;
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
							onClick={() => setShowMetadata(!showMetadata)}
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

					{/* LLM Metadata Details - shown when icon is clicked */}
					{getLLMMetadata() && showMetadata && (
								<div className="mt-2 p-3 bg-muted/50 rounded-md space-y-2 text-xs">
									{getLLMMetadata()?.["llm-model"] && (
										<div className="flex items-center gap-2">
											<Brain className="w-3 h-3 text-muted-foreground" />
											<span className="text-muted-foreground">Model:</span>
											<span className="font-mono">
												{getLLMMetadata()?.["llm-model"]}
											</span>
										</div>
									)}

									{getLLMMetadata()?.["llm-provider"] && (
										<div className="flex items-center gap-2">
											<Cpu className="w-3 h-3 text-muted-foreground" />
											<span className="text-muted-foreground">Provider:</span>
											<span className="font-mono">
												{getLLMMetadata()?.["llm-provider"]}
											</span>
										</div>
									)}

									{/* Token Usage */}
									{(getLLMMetadata()?.["llm-total-tokens"] ||
										getLLMMetadata()?.["llm-prompt-tokens"] ||
										getLLMMetadata()?.["llm-completion-tokens"]) && (
										<div className="pt-2 border-t border-border/50">
											<div className="text-muted-foreground mb-1">
												Token Usage:
											</div>
											<div className="grid grid-cols-2 gap-2 ml-3">
												{getLLMMetadata()?.["llm-prompt-tokens"] && (
													<div className="flex items-center gap-1">
														<Hash className="w-3 h-3 text-muted-foreground" />
														<span className="text-muted-foreground">
															Prompt:
														</span>
														<span className="font-mono">
															{formatTokenCount(
																getLLMMetadata()?.["llm-prompt-tokens"],
															)}
														</span>
													</div>
												)}
												{getLLMMetadata()?.["llm-completion-tokens"] && (
													<div className="flex items-center gap-1">
														<Hash className="w-3 h-3 text-muted-foreground" />
														<span className="text-muted-foreground">
															Completion:
														</span>
														<span className="font-mono">
															{formatTokenCount(
																getLLMMetadata()?.["llm-completion-tokens"],
															)}
														</span>
													</div>
												)}
												{getLLMMetadata()?.["llm-total-tokens"] && (
													<div className="flex items-center gap-1 col-span-2">
														<Hash className="w-3 h-3 text-muted-foreground" />
														<span className="text-muted-foreground">
															Total:
														</span>
														<span className="font-mono font-semibold">
															{formatTokenCount(
																getLLMMetadata()?.["llm-total-tokens"],
															)}
														</span>
													</div>
												)}
											</div>
										</div>
									)}

									{/* Cache Information */}
									{(getLLMMetadata()?.["llm-cache-read-tokens"] ||
										getLLMMetadata()?.["llm-cache-creation-tokens"]) && (
										<div className="pt-2 border-t border-border/50">
											<div className="text-muted-foreground mb-1">
												Cache Usage:
											</div>
											<div className="grid grid-cols-2 gap-2 ml-3">
												{getLLMMetadata()?.["llm-cache-read-tokens"] && (
													<div className="flex items-center gap-1">
														<Zap className="w-3 h-3 text-green-500" />
														<span className="text-muted-foreground">
															Cache Read:
														</span>
														<span className="font-mono text-green-600">
															{formatTokenCount(
																getLLMMetadata()?.["llm-cache-read-tokens"],
															)}
														</span>
													</div>
												)}
												{getLLMMetadata()?.["llm-cache-creation-tokens"] && (
													<div className="flex items-center gap-1">
														<Zap className="w-3 h-3 text-blue-500" />
														<span className="text-muted-foreground">
															Cache Created:
														</span>
														<span className="font-mono text-blue-600">
															{formatTokenCount(
																getLLMMetadata()?.["llm-cache-creation-tokens"],
															)}
														</span>
													</div>
												)}
											</div>
										</div>
									)}

									{/* Cost Information */}
									{(getLLMMetadata()?.["llm-cost"] ||
										getLLMMetadata()?.["llm-cost-usd"]) && (
										<div className="pt-2 border-t border-border/50">
											<div className="flex items-center gap-2">
												<DollarSign className="w-3 h-3 text-green-500" />
												<span className="text-muted-foreground">Cost:</span>
												<span className="font-mono text-green-600 font-semibold">
													$
													{getLLMMetadata()?.["llm-cost-usd"] ||
														getLLMMetadata()?.["llm-cost"]}
												</span>
											</div>
										</div>
									)}

									{/* Confidence Level from metadata */}
									{getLLMMetadata()?.["llm-confidence"] && (
										<div className="pt-2 border-t border-border/50">
											<div className="flex items-center gap-2">
												<span className="text-muted-foreground">
													Confidence:
												</span>
												<Badge variant="secondary" className="text-xs h-5 px-2">
													{getLLMMetadata()?.["llm-confidence"]}
												</Badge>
											</div>
										</div>
									)}
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

import {
	Brain,
	Copy,
	Cpu,
	DollarSign,
	Hash,
	MessageSquare,
	Settings,
	Zap,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "../ui/dialog";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";

interface LLMMetadataDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	metadata: Record<string, string>;
}

export function LLMMetadataDialog({
	open,
	onOpenChange,
	metadata,
}: LLMMetadataDialogProps) {
	const [copiedField, setCopiedField] = useState<string | null>(null);

	const formatTokenCount = (count: string | undefined) => {
		if (!count) return "0";
		const num = Number.parseInt(count);
		if (num >= 1000) {
			return `${(num / 1000).toFixed(1)}k`;
		}
		return count;
	};

	const copyToClipboard = async (text: string, field: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setCopiedField(field);
			setTimeout(() => setCopiedField(null), 2000);
		} catch (err) {
			console.error("Failed to copy text:", err);
		}
	};

	const renderPromptSection = (title: string, content: string, field: string) => {
		if (!content) return null;

		return (
			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<h4 className="font-medium text-sm">{title}</h4>
					<Button
						variant="ghost"
						size="sm"
						className="h-7 px-2"
						onClick={() => copyToClipboard(content, field)}
					>
						{copiedField === field ? (
							<span className="text-xs text-green-600">Copied!</span>
						) : (
							<Copy className="w-3.5 h-3.5" />
						)}
					</Button>
				</div>
				<div className="bg-muted/50 rounded-md p-3">
					<ScrollArea className="max-h-[200px]">
						<pre className="text-xs font-mono whitespace-pre-wrap break-words">
							{content}
						</pre>
					</ScrollArea>
				</div>
			</div>
		);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[80vh]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Cpu className="w-5 h-5" />
						LLM Metadata
					</DialogTitle>
					<DialogDescription>
						Detailed information about the AI model response
					</DialogDescription>
				</DialogHeader>

				<ScrollArea className="h-[60vh] pr-4">
					<div className="space-y-6">
						{/* Model Information */}
						<div className="space-y-3">
							<h3 className="font-semibold text-sm flex items-center gap-2">
								<Brain className="w-4 h-4" />
								Model Information
							</h3>
							<div className="grid grid-cols-2 gap-4 ml-6">
								{metadata["llm-model"] && (
									<div>
										<span className="text-xs text-muted-foreground">Model:</span>
										<p className="font-mono text-sm">{metadata["llm-model"]}</p>
									</div>
								)}
								{metadata["llm-provider"] && (
									<div>
										<span className="text-xs text-muted-foreground">
											Provider:
										</span>
										<p className="font-mono text-sm">
											{metadata["llm-provider"]}
										</p>
									</div>
								)}
							</div>
						</div>

						<Separator />

						{/* Token Usage */}
						{(metadata["llm-total-tokens"] ||
							metadata["llm-prompt-tokens"] ||
							metadata["llm-completion-tokens"]) && (
							<div className="space-y-3">
								<h3 className="font-semibold text-sm flex items-center gap-2">
									<Hash className="w-4 h-4" />
									Token Usage
								</h3>
								<div className="grid grid-cols-2 gap-4 ml-6">
									{metadata["llm-prompt-tokens"] && (
										<div>
											<span className="text-xs text-muted-foreground">
												Prompt Tokens:
											</span>
											<p className="font-mono text-sm">
												{formatTokenCount(metadata["llm-prompt-tokens"])}
											</p>
										</div>
									)}
									{metadata["llm-completion-tokens"] && (
										<div>
											<span className="text-xs text-muted-foreground">
												Completion Tokens:
											</span>
											<p className="font-mono text-sm">
												{formatTokenCount(metadata["llm-completion-tokens"])}
											</p>
										</div>
									)}
									{metadata["llm-total-tokens"] && (
										<div>
											<span className="text-xs text-muted-foreground">
												Total Tokens:
											</span>
											<p className="font-mono text-sm font-semibold">
												{formatTokenCount(metadata["llm-total-tokens"])}
											</p>
										</div>
									)}
								</div>
							</div>
						)}

						{/* Cache Information */}
						{(metadata["llm-cache-read-tokens"] ||
							metadata["llm-cache-creation-tokens"]) && (
							<>
								<Separator />
								<div className="space-y-3">
									<h3 className="font-semibold text-sm flex items-center gap-2">
										<Zap className="w-4 h-4" />
										Cache Usage
									</h3>
									<div className="grid grid-cols-2 gap-4 ml-6">
										{metadata["llm-cache-read-tokens"] && (
											<div>
												<span className="text-xs text-muted-foreground">
													Cache Read:
												</span>
												<p className="font-mono text-sm text-green-600">
													{formatTokenCount(metadata["llm-cache-read-tokens"])}
												</p>
											</div>
										)}
										{metadata["llm-cache-creation-tokens"] && (
											<div>
												<span className="text-xs text-muted-foreground">
													Cache Created:
												</span>
												<p className="font-mono text-sm text-blue-600">
													{formatTokenCount(
														metadata["llm-cache-creation-tokens"],
													)}
												</p>
											</div>
										)}
									</div>
								</div>
							</>
						)}

						{/* Cost & Confidence */}
						{(metadata["llm-cost"] ||
							metadata["llm-cost-usd"] ||
							metadata["llm-confidence"]) && (
							<>
								<Separator />
								<div className="space-y-3">
									<h3 className="font-semibold text-sm flex items-center gap-2">
										<Settings className="w-4 h-4" />
										Performance Metrics
									</h3>
									<div className="grid grid-cols-2 gap-4 ml-6">
										{(metadata["llm-cost"] || metadata["llm-cost-usd"]) && (
											<div>
												<span className="text-xs text-muted-foreground">
													Cost:
												</span>
												<p className="font-mono text-sm text-green-600 flex items-center gap-1">
													<DollarSign className="w-3 h-3" />
													{metadata["llm-cost-usd"] || metadata["llm-cost"]}
												</p>
											</div>
										)}
										{metadata["llm-confidence"] && (
											<div>
												<span className="text-xs text-muted-foreground">
													Confidence:
												</span>
												<div className="mt-1">
													<Badge variant="secondary" className="text-xs">
														{metadata["llm-confidence"]}
													</Badge>
												</div>
											</div>
										)}
									</div>
								</div>
							</>
						)}

						{/* Prompts */}
						{(metadata["llm-system-prompt"] || metadata["llm-user-prompt"]) && (
							<>
								<Separator />
								<div className="space-y-4">
									<h3 className="font-semibold text-sm flex items-center gap-2">
										<MessageSquare className="w-4 h-4" />
										Prompts
									</h3>
									<div className="space-y-4 ml-6">
										{renderPromptSection(
											"System Prompt",
											metadata["llm-system-prompt"],
											"system-prompt",
										)}
										{renderPromptSection(
											"User Prompt",
											metadata["llm-user-prompt"],
											"user-prompt",
										)}
									</div>
								</div>
							</>
						)}
					</div>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}
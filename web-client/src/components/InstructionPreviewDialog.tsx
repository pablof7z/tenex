import { FileText, Tag } from "lucide-react";
import type { NDKLLMRule } from "../types/template";
import { ProfileDisplay } from "./ProfileDisplay";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

interface InstructionPreviewDialogProps {
	instruction: NDKLLMRule | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function InstructionPreviewDialog({
	instruction,
	open,
	onOpenChange,
}: InstructionPreviewDialogProps) {
	if (!instruction) return null;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<FileText className="w-5 h-5" />
						{instruction.title || "Untitled Instruction"}
					</DialogTitle>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto space-y-4">
					{/* Metadata */}
					<div className="bg-slate-50 rounded-lg p-4 space-y-3">
						{instruction.description && (
							<div>
								<h4 className="text-sm font-medium text-slate-700 mb-1">
									Description
								</h4>
								<p className="text-sm text-slate-600">
									{instruction.description}
								</p>
							</div>
						)}

						<div className="flex items-center justify-between text-xs text-slate-500">
							<div className="flex items-center gap-2">
								<span className="text-slate-700 font-medium">Author:</span>
								<ProfileDisplay
									pubkey={instruction.pubkey || ""}
									size="sm"
									nameClassName="text-slate-600"
								/>
							</div>
							{instruction.version && (
								<span>Version: {instruction.version}</span>
							)}
						</div>

						{instruction.hashtags && instruction.hashtags.length > 0 && (
							<div>
								<h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
									<Tag className="w-3 h-3" />
									Tags
								</h4>
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
							</div>
						)}
					</div>

					{/* Content */}
					<div>
						<h4 className="text-sm font-medium text-slate-700 mb-2">
							Instruction Content
						</h4>
						<div className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
							<pre className="text-sm text-slate-100 whitespace-pre-wrap font-mono leading-relaxed">
								{instruction.content || "No content available"}
							</pre>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

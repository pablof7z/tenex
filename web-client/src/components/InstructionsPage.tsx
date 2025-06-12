import { NDKEvent, type NDKKind } from "@nostr-dev-kit/ndk";
import { useNDK, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import {
	ArrowLeft,
	Check,
	Copy,
	Edit,
	FileText,
	Plus,
	Save,
	Sparkles,
	Tag,
	X,
} from "lucide-react";
import { useState } from "react";
import type { NDKLLMRule } from "../types/template";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

interface InstructionsPageProps {
	onBack: () => void;
}

export function InstructionsPage({ onBack }: InstructionsPageProps) {
	const { ndk } = useNDK();
	const [selectedInstruction, setSelectedInstruction] =
		useState<NDKLLMRule | null>(null);
	const [isEditing, setIsEditing] = useState(false);
	const [isCreatingNew, setIsCreatingNew] = useState(false);
	const [copiedId, setCopiedId] = useState<string | null>(null);

	// Form state
	const [formData, setFormData] = useState({
		title: "",
		description: "",
		content: "",
		tags: [] as string[],
		newTag: "",
	});

	// Fetch instruction events (kind 1339)
	const { events: instructions } = useSubscribe<NDKLLMRule>(
		[{ kinds: [1339 as NDKKind], limit: 100 }],
		{ wrap: true },
		[],
	);

	const handleInstructionSelect = (instruction: NDKLLMRule) => {
		setSelectedInstruction(instruction);
		setIsEditing(false);
		setIsCreatingNew(false);
	};

	const handleCreateNew = () => {
		setSelectedInstruction(null);
		setIsCreatingNew(true);
		setIsEditing(true);
		setFormData({
			title: "",
			description: "",
			content: "",
			tags: [],
			newTag: "",
		});
	};

	const handleEdit = () => {
		if (selectedInstruction) {
			// Parse existing instruction data into form
			const instructionTags = selectedInstruction.tags
				.filter((tag) => tag[0] === "t")
				.map((tag) => tag[1]);

			setFormData({
				title:
					selectedInstruction.title || selectedInstruction.tagValue("d") || "",
				description: selectedInstruction.description || "",
				content: selectedInstruction.content || "",
				tags: instructionTags,
				newTag: "",
			});
			setIsEditing(true);
		}
	};

	const validateForm = () => {
		if (!formData.title.trim()) {
			alert("Instruction title is required");
			return false;
		}
		if (!formData.content.trim()) {
			alert("Instruction content is required");
			return false;
		}
		return true;
	};

	const handleSave = async () => {
		if (!ndk || !validateForm()) return;

		const newInstruction = new NDKEvent(ndk);
		newInstruction.kind = 1339;
		newInstruction.content = formData.content;

		if (isCreatingNew) {
			// Creating a new instruction
			newInstruction.tags = [
				["d", formData.title.toLowerCase().replace(/\s+/g, "-")],
				["title", formData.title],
				["ver", "1.0.0"],
			];

			if (formData.description) {
				newInstruction.tags.push(["description", formData.description]);
			}

			// Add hashtags
			formData.tags.forEach((tag) => {
				newInstruction.tags.push(["t", tag]);
			});
		} else if (selectedInstruction) {
			// Editing existing instruction
			const currentVersion = selectedInstruction.version || "1.0.0";
			const versionParts = currentVersion.split(".");
			const newVersion = `${versionParts[0]}.${versionParts[1]}.${Number.parseInt(versionParts[2]) + 1}`;

			// Build new tags
			newInstruction.tags = [
				[
					"d",
					selectedInstruction.tagValue("d") ||
						formData.title.toLowerCase().replace(/\s+/g, "-"),
				],
				["title", formData.title],
				["ver", newVersion],
			];

			if (formData.description) {
				newInstruction.tags.push(["description", formData.description]);
			}

			// Add hashtags
			formData.tags.forEach((tag) => {
				newInstruction.tags.push(["t", tag]);
			});
		}

		try {
			await newInstruction.publish();
			setIsEditing(false);
			setIsCreatingNew(false);
			// The new instruction will appear in the instructions list automatically
		} catch (error) {
			console.error("Failed to publish instruction:", error);
		}
	};

	const handleCancel = () => {
		setIsEditing(false);
		setIsCreatingNew(false);
		setFormData({
			title: "",
			description: "",
			content: "",
			tags: [],
			newTag: "",
		});
	};

	const handleCopyInstructionId = async (instruction: NDKLLMRule) => {
		if (!instruction) return;

		try {
			const encoded = instruction.encode();
			await navigator.clipboard.writeText(encoded);
			setCopiedId(instruction.id);

			// Reset copied state after 2 seconds
			setTimeout(() => {
				setCopiedId(null);
			}, 2000);
		} catch (error) {
			console.error("Failed to copy instruction ID:", error);
		}
	};

	const handleAddTag = () => {
		if (
			formData.newTag.trim() &&
			!formData.tags.includes(formData.newTag.trim())
		) {
			setFormData((prev) => ({
				...prev,
				tags: [...prev.tags, prev.newTag.trim()],
				newTag: "",
			}));
		}
	};

	const handleRemoveTag = (tagToRemove: string) => {
		setFormData((prev) => ({
			...prev,
			tags: prev.tags.filter((tag) => tag !== tagToRemove),
		}));
	};

	const handleFormChange = (field: keyof typeof formData, value: string) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	return (
		<div className="h-screen bg-background flex">
			{/* Left Sidebar - Instructions List */}
			<div className="w-80 bg-card border-r border-border flex flex-col">
				<div className="p-4 border-b border-border">
					<div className="flex items-center gap-3 mb-2">
						<Button
							variant="ghost"
							size="icon"
							onClick={onBack}
							className="h-8 w-8"
						>
							<ArrowLeft className="w-4 h-4" />
						</Button>
						<h1 className="text-lg font-semibold text-foreground">
							Instructions
						</h1>
					</div>
				</div>

				<div className="flex-1 overflow-y-auto bg-muted/30">
					{instructions.length === 0 ? (
						<div className="p-4 text-center text-muted-foreground">
							No instructions found
						</div>
					) : (
						<div className="p-2">
							{instructions.map((instruction) => {
								const title =
									instruction.title || instruction.tagValue("d") || "Untitled";
								const version = instruction.version || "1.0.0";
								const description =
									instruction.description ||
									instruction.content?.slice(0, 100) + "...";

								return (
									<div
										key={instruction.id}
										className={`p-3 rounded-lg cursor-pointer transition-colors ${
											selectedInstruction?.id === instruction.id
												? "bg-primary/10 border border-primary/20"
												: "hover:bg-accent"
										}`}
										onClick={() => handleInstructionSelect(instruction)}
									>
										<div className="flex items-center justify-between mb-1">
											<h3 className="font-medium text-sm text-foreground">
												{title}
											</h3>
											<span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
												v{version}
											</span>
										</div>
										{description && (
											<p className="text-xs text-muted-foreground line-clamp-2">
												{description}
											</p>
										)}
									</div>
								);
							})}
						</div>
					)}
				</div>

				{/* Add new instruction button */}
				<div className="p-2 border-t border-border">
					<Button
						variant="outline"
						size="sm"
						className="w-full"
						onClick={handleCreateNew}
					>
						<Plus className="w-4 h-4 mr-2" />
						Add new instruction
					</Button>
				</div>
			</div>

			{/* Main Content - Instruction Details */}
			<div className="flex-1 flex flex-col">
				{!selectedInstruction && !isCreatingNew ? (
					<div className="flex-1 flex items-center justify-center">
						<div className="text-center">
							<div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 mx-auto">
								<FileText className="w-8 h-8 text-muted-foreground" />
							</div>
							<h3 className="text-lg font-semibold text-foreground mb-2">
								Select an Instruction
							</h3>
							<p className="text-muted-foreground">
								Choose an instruction from the sidebar to view its content, or
								create a new one
							</p>
						</div>
					</div>
				) : (
					<>
						{/* Header */}
						<div className="bg-card border-b border-border px-6 py-4">
							<div className="flex items-center justify-between">
								<div>
									<h1 className="text-xl font-semibold text-foreground">
										{isCreatingNew
											? "Create New Instruction"
											: selectedInstruction?.title ||
												selectedInstruction?.tagValue("d") ||
												"Untitled Instruction"}
									</h1>
									<p className="text-sm text-muted-foreground">
										{isCreatingNew
											? "Version 1.0.0"
											: `Version ${selectedInstruction?.version || "1.0.0"}`}
									</p>
								</div>
								<div className="flex items-center gap-2">
									{isEditing ? (
										<>
											<Button
												variant="outline"
												size="sm"
												onClick={handleCancel}
											>
												<X className="w-4 h-4 mr-2" />
												Cancel
											</Button>
											<Button
												size="sm"
												onClick={handleSave}
												disabled={
													!formData.title.trim() || !formData.content.trim()
												}
											>
												<Save className="w-4 h-4 mr-2" />
												{isCreatingNew
													? "Publish instruction"
													: "Publish new version"}
											</Button>
										</>
									) : (
										<>
											<Button variant="outline" size="sm" onClick={handleEdit}>
												<Edit className="w-4 h-4 mr-2" />
												Edit
											</Button>
											{selectedInstruction && (
												<Button
													variant="outline"
													size="sm"
													onClick={() =>
														handleCopyInstructionId(selectedInstruction)
													}
													title="Copy instruction event ID"
												>
													{copiedId === selectedInstruction.id ? (
														<Check className="w-4 h-4 text-green-600" />
													) : (
														<Copy className="w-4 h-4" />
													)}
												</Button>
											)}
										</>
									)}
								</div>
							</div>
						</div>

						{/* Content */}
						<div className="flex-1 overflow-y-auto bg-gradient-to-br from-muted/30 to-muted/10">
							{isEditing ? (
								<div className="max-w-3xl mx-auto p-8">
									<div className="bg-card rounded-xl shadow-sm border border-border p-8">
										<div className="space-y-8">
											{/* Title */}
											<div className="space-y-2">
												<label className="flex items-center gap-2 text-sm font-semibold text-foreground">
													<FileText className="w-4 h-4 text-blue-600" />
													Instruction Title
													<span className="text-red-500">*</span>
												</label>
												<Input
													value={formData.title}
													onChange={(e) =>
														handleFormChange("title", e.target.value)
													}
													placeholder="e.g., Code Review Guidelines"
													className="w-full h-12 px-4 text-base"
												/>
											</div>

											{/* Description */}
											<div className="space-y-2">
												<label className="flex items-center gap-2 text-sm font-semibold text-foreground">
													<FileText className="w-4 h-4 text-purple-600" />
													Description
												</label>
												<Textarea
													value={formData.description}
													onChange={(e) =>
														handleFormChange("description", e.target.value)
													}
													placeholder="Brief description of this instruction..."
													rows={3}
													className="w-full p-4 text-base resize-none"
												/>
											</div>

											{/* Tags */}
											<div className="space-y-2">
												<label className="flex items-center gap-2 text-sm font-semibold text-foreground">
													<Tag className="w-4 h-4 text-orange-600" />
													Tags
												</label>
												<div className="flex gap-2">
													<Input
														value={formData.newTag}
														onChange={(e) =>
															handleFormChange("newTag", e.target.value)
														}
														onKeyDown={(e) => {
															if (e.key === "Enter") {
																e.preventDefault();
																handleAddTag();
															}
														}}
														placeholder="Add a tag and press Enter..."
														className="flex-1 h-12 px-4 text-base"
													/>
													<Button
														type="button"
														variant="outline"
														size="lg"
														onClick={handleAddTag}
														disabled={!formData.newTag.trim()}
														className="h-12 px-4"
													>
														<Plus className="w-5 h-5" />
													</Button>
												</div>
												{formData.tags.length > 0 && (
													<div className="flex flex-wrap gap-2 pt-2">
														{formData.tags.map((tag) => (
															<Badge
																key={tag}
																variant="secondary"
																className="px-3 py-1.5 text-sm bg-orange-100 text-orange-800 hover:bg-orange-200 cursor-pointer transition-all flex items-center gap-1.5 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50"
																onClick={() => handleRemoveTag(tag)}
															>
																{tag}
																<X className="w-3 h-3" />
															</Badge>
														))}
													</div>
												)}
											</div>

											{/* Content */}
											<div className="space-y-2">
												<label className="flex items-center gap-2 text-sm font-semibold text-foreground">
													<Sparkles className="w-4 h-4 text-indigo-600" />
													Instruction Content
													<span className="text-red-500">*</span>
												</label>
												<Textarea
													value={formData.content}
													onChange={(e) =>
														handleFormChange("content", e.target.value)
													}
													placeholder="Enter the full instruction content..."
													rows={12}
													className="w-full p-4 font-mono text-sm resize-none"
												/>
											</div>
										</div>
									</div>
								</div>
							) : (
								<div className="max-w-3xl mx-auto p-8">
									{isCreatingNew ? (
										<div className="text-center py-12">
											<FileText className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
											<p className="text-muted-foreground text-lg">
												Fill out the form above to create your instruction
											</p>
										</div>
									) : selectedInstruction ? (
										<div className="bg-card rounded-xl shadow-sm border border-border p-8">
											<div className="space-y-6">
												{/* Instruction Header */}
												<div className="border-b border-border pb-6">
													<div className="flex items-start gap-4">
														<div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
															<FileText className="w-7 h-7 text-white" />
														</div>
														<div className="flex-1">
															<h3 className="text-2xl font-bold text-foreground mb-2">
																{selectedInstruction.title ||
																	selectedInstruction.tagValue("d") ||
																	"Untitled Instruction"}
															</h3>
															{selectedInstruction.description && (
																<p className="text-muted-foreground text-base leading-relaxed">
																	{selectedInstruction.description}
																</p>
															)}
														</div>
													</div>
												</div>

												{/* Tags */}
												{selectedInstruction.hashtags &&
													selectedInstruction.hashtags.length > 0 && (
														<div className="flex items-start gap-2">
															<Tag className="w-5 h-5 text-orange-600 mt-0.5" />
															<div className="flex flex-wrap gap-2">
																{selectedInstruction.hashtags.map(
																	(tag, index) => (
																		<Badge
																			key={index}
																			variant="outline"
																			className="text-sm px-3 py-1 bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-300"
																		>
																			{tag}
																		</Badge>
																	),
																)}
															</div>
														</div>
													)}

												{/* Content */}
												{selectedInstruction.content && (
													<div className="mt-8">
														<div className="flex items-center gap-2 mb-4">
															<Sparkles className="w-5 h-5 text-indigo-600" />
															<h4 className="text-lg font-semibold text-foreground">
																Content
															</h4>
														</div>
														<div className="bg-gradient-to-br from-muted/50 to-muted/30 p-6 rounded-xl border border-border">
															<pre className="whitespace-pre-wrap text-sm text-foreground font-mono leading-relaxed">
																{selectedInstruction.content}
															</pre>
														</div>
													</div>
												)}
											</div>
										</div>
									) : (
										<div className="text-center py-12">
											<FileText className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
											<p className="text-muted-foreground text-lg">
												No instruction selected
											</p>
										</div>
									)}
								</div>
							)}
						</div>
					</>
				)}
			</div>
		</div>
	);
}

import { useNDK, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import {
	ArrowLeft,
	Bot,
	Brain,
	Check,
	Copy,
	Edit,
	FileText,
	Plus,
	Save,
	Sparkles,
	Tag,
	User,
	X,
} from "lucide-react";
import { useState } from "react";
import { NDKAgent } from "../lib/ndk-setup";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { EVENT_KINDS } from "../../../shared/dist/types/events";
import type { NDKKind } from "@nostr-dev-kit/ndk";

interface AgentsPageProps {
	onBack: () => void;
}

export function AgentsPage({ onBack }: AgentsPageProps) {
	const { ndk } = useNDK();
	const [selectedAgent, setSelectedAgent] = useState<NDKAgent | null>(null);
	const [isEditing, setIsEditing] = useState(false);
	const [isCreatingNew, setIsCreatingNew] = useState(false);
	const [copiedId, setCopiedId] = useState<string | null>(null);

	// Form state
	const [formData, setFormData] = useState({
		title: "",
		description: "",
		role: "",
		instructions: "",
		tags: [] as string[],
		newTag: "",
	});

	// Fetch agent events (kind 4199)
	const { events: agents } = useSubscribe<NDKAgent>(
		[{ kinds: NDKAgent.kinds, limit: 100 }],
		{ wrap: true },
		[],
	);

	// Fetch lessons for selected agent (kind 4124)
	const { events: lessons } = useSubscribe(
		selectedAgent ? [{ kinds: [EVENT_KINDS.AGENT_LESSON as NDKKind], "#e": [selectedAgent.id] }] : false,
		{},
		[selectedAgent?.id],
	);

	const handleAgentSelect = (agent: NDKAgent) => {
		setSelectedAgent(agent);
		setIsEditing(false);
		setIsCreatingNew(false);
	};

	const handleCreateNew = () => {
		setSelectedAgent(null);
		setIsCreatingNew(true);
		setIsEditing(true);
		setFormData({
			title: "",
			description: "",
			role: "",
			instructions: "",
			tags: [],
			newTag: "",
		});
	};

	const handleEdit = () => {
		if (selectedAgent) {
			// Parse existing agent data into form
			const agentTags = selectedAgent.tags
				.filter((tag) => tag[0] === "t")
				.map((tag) => tag[1]);

			setFormData({
				title:
					selectedAgent.tagValue("title") ||
					selectedAgent.tagValue("name") ||
					selectedAgent.tagValue("d") ||
					"",
				description:
					selectedAgent.tagValue("description") ||
					extractDescriptionFromContent(selectedAgent.content || ""),
				role:
					selectedAgent.tagValue("role") ||
					extractRoleFromContent(selectedAgent.content || ""),
				instructions: selectedAgent.content || "",
				tags: agentTags,
				newTag: "",
			});
			setIsEditing(true);
		}
	};

	const validateForm = () => {
		if (!formData.title.trim()) {
			alert("Agent name is required");
			return false;
		}
		return true;
	};

	const handleSave = async () => {
		if (!ndk || !validateForm()) return;

		const newAgent = new NDKAgent(ndk);
		newAgent.content = formData.instructions;

		if (isCreatingNew) {
			// Creating a new agent
			newAgent.tags = [
				["d", formData.title.toLowerCase().replace(/\s+/g, "-")],
				["title", formData.title],
				["description", formData.description],
				["role", formData.role],
				["ver", "1"],
				...formData.tags.map((tag) => ["t", tag] as [string, string]),
			];
		} else if (selectedAgent) {
			// Editing existing agent
			const currentVersion = selectedAgent.tagValue("ver") || "1";
			const newVersion = String(Number.parseInt(currentVersion) + 1);

			// Build new tags
			newAgent.tags = [
				[
					"d",
					selectedAgent.tagValue("d") ||
						formData.title.toLowerCase().replace(/\s+/g, "-"),
				],
				["title", formData.title],
				["description", formData.description],
				["role", formData.role],
				["ver", newVersion],
				...formData.tags.map((tag) => ["t", tag] as [string, string]),
			];
		}

		try {
			await newAgent.publish();
			setIsEditing(false);
			setIsCreatingNew(false);
			// The new agent will appear in the agents list automatically
		} catch (error) {
			console.error("Failed to publish agent:", error);
		}
	};

	const extractDescriptionFromContent = (content: string): string => {
		const lines = content.split("\n");
		const descIndex = lines.findIndex((line) =>
			line.toLowerCase().includes("description"),
		);
		if (descIndex >= 0 && descIndex < lines.length - 1) {
			return lines[descIndex + 1].trim();
		}
		return "";
	};

	const extractRoleFromContent = (content: string): string => {
		const lines = content.split("\n");
		const roleIndex = lines.findIndex((line) =>
			line.toLowerCase().includes("role"),
		);
		if (roleIndex >= 0 && roleIndex < lines.length - 1) {
			return lines[roleIndex + 1].trim();
		}
		return "";
	};

	const handleCancel = () => {
		setIsEditing(false);
		setIsCreatingNew(false);
		setFormData({
			title: "",
			description: "",
			role: "",
			instructions: "",
			tags: [],
			newTag: "",
		});
	};

	const handleCopyAgentId = async (agent: NDKAgent) => {
		if (!agent) return;

		try {
			const encoded = agent.encode();
			await navigator.clipboard.writeText(encoded);
			setCopiedId(agent.id);

			// Reset copied state after 2 seconds
			setTimeout(() => {
				setCopiedId(null);
			}, 2000);
		} catch (error) {
			console.error("Failed to copy agent ID:", error);
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
			{/* Left Sidebar - Agents List */}
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
						<h1 className="text-lg font-semibold text-foreground">Agents</h1>
					</div>
				</div>

				<div className="flex-1 overflow-y-auto bg-muted/30">
					{agents.length === 0 ? (
						<div className="p-4 text-center text-muted-foreground">
							No agents found
						</div>
					) : (
						<div className="p-2">
							{agents.map((agent) => {
								const name =
									agent.tagValue("name") ||
									agent.tagValue("d") ||
									"Unnamed Agent";
								const version = agent.tagValue("ver") || "1";
								const description =
									agent.tagValue("description") ||
									`${agent.content?.slice(0, 100)}...`;

								return (
									<div
										key={agent.id}
										className={`p-3 rounded-lg cursor-pointer transition-colors ${
											selectedAgent?.id === agent.id
												? "bg-primary/10 border border-primary/20"
												: "hover:bg-accent"
										}`}
										onClick={() => handleAgentSelect(agent)}
									>
										<div className="flex items-center justify-between mb-1">
											<h3 className="font-medium text-sm text-foreground">
												{name}
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

				{/* Add new agent button */}
				<div className="p-2 border-t border-border">
					<Button
						variant="outline"
						size="sm"
						className="w-full"
						onClick={handleCreateNew}
					>
						<Plus className="w-4 h-4 mr-2" />
						Add new agent
					</Button>
				</div>
			</div>

			{/* Main Content - Agent Details */}
			<div className="flex-1 flex flex-col">
				{!selectedAgent && !isCreatingNew ? (
					<div className="flex-1 flex items-center justify-center">
						<div className="text-center">
							<div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 mx-auto">
								<span className="text-2xl">🤖</span>
							</div>
							<h3 className="text-lg font-semibold text-foreground mb-2">
								Select an Agent
							</h3>
							<p className="text-muted-foreground">
								Choose an agent from the sidebar to view its definition, or
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
											? "Create New Agent"
											: selectedAgent?.tagValue("name") ||
												selectedAgent?.tagValue("d") ||
												"Unnamed Agent"}
									</h1>
									<p className="text-sm text-muted-foreground">
										{isCreatingNew
											? "Version 1"
											: `Version ${selectedAgent?.tagValue("ver") || "1"}`}
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
												disabled={!formData.title.trim()}
											>
												<Save className="w-4 h-4 mr-2" />
												{isCreatingNew
													? "Publish agent"
													: "Publish new version"}
											</Button>
										</>
									) : (
										<>
											<Button variant="outline" size="sm" onClick={handleEdit}>
												<Edit className="w-4 h-4 mr-2" />
												Edit
											</Button>
											{selectedAgent && (
												<Button
													variant="outline"
													size="sm"
													onClick={() => handleCopyAgentId(selectedAgent)}
													title="Copy agent event ID"
												>
													{copiedId === selectedAgent.id ? (
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
						<div className="flex-1 overflow-y-auto bg-background">
							{isEditing ? (
								<div className="max-w-3xl mx-auto p-8">
									<div className="bg-card rounded-xl shadow-sm border border-border p-8">
										<div className="space-y-8">
											{/* Title */}
											<div className="space-y-2">
												<label className="flex items-center gap-2 text-sm font-semibold text-foreground">
													<Bot className="w-4 h-4 text-blue-600" />
													Agent Name
													<span className="text-red-500">*</span>
												</label>
												<Input
													value={formData.title}
													onChange={(e) =>
														handleFormChange("title", e.target.value)
													}
													placeholder="e.g., Code Reviewer Agent"
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
													placeholder="Brief description of what this agent does..."
													rows={3}
													className="w-full p-4 text-base resize-none"
												/>
											</div>

											{/* Role */}
											<div className="space-y-2">
												<label className="flex items-center gap-2 text-sm font-semibold text-foreground">
													<User className="w-4 h-4 text-green-600" />
													Role/Specialty
												</label>
												<Input
													value={formData.role}
													onChange={(e) =>
														handleFormChange("role", e.target.value)
													}
													placeholder="e.g., Senior Software Engineer, UX Designer, DevOps Specialist"
													className="w-full h-12 px-4 text-base border-slate-200 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all"
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
																className="px-3 py-1.5 text-sm bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 cursor-pointer transition-all flex items-center gap-1.5"
																onClick={() => handleRemoveTag(tag)}
															>
																{tag}
																<X className="w-3 h-3" />
															</Badge>
														))}
													</div>
												)}
											</div>

											{/* Instructions */}
											<div className="space-y-2">
												<label className="flex items-center gap-2 text-sm font-semibold text-foreground">
													<Sparkles className="w-4 h-4 text-indigo-600" />
													Detailed Instructions
												</label>
												<Textarea
													value={formData.instructions}
													onChange={(e) =>
														handleFormChange("instructions", e.target.value)
													}
													placeholder="Detailed instructions for how the agent should operate, its personality, specific guidelines, etc..."
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
											<Bot className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
											<p className="text-muted-foreground text-lg">
												Fill out the form above to create your agent
											</p>
										</div>
									) : selectedAgent ? (
										<div className="bg-card rounded-xl shadow-sm border border-border p-8">
											<div className="space-y-6">
												{/* Agent Header */}
												<div className="border-b border-border pb-6">
													<div className="flex items-start gap-4">
														<div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
															<Bot className="w-7 h-7 text-white" />
														</div>
														<div className="flex-1">
															<h3 className="text-2xl font-bold text-foreground mb-2">
																{selectedAgent.tagValue("title") ||
																	selectedAgent.tagValue("name") ||
																	selectedAgent.tagValue("d") ||
																	"Unnamed Agent"}
															</h3>
															{selectedAgent.tagValue("description") && (
																<p className="text-muted-foreground text-base leading-relaxed">
																	{selectedAgent.tagValue("description")}
																</p>
															)}
														</div>
													</div>
												</div>

												{/* Role & Tags */}
												<div className="space-y-4">
													{selectedAgent.tagValue("role") && (
														<div className="flex items-center gap-2">
															<User className="w-5 h-5 text-green-600" />
															<span className="inline-block bg-green-500/10 text-green-600 dark:text-green-400 px-4 py-2 rounded-full text-sm font-medium">
																{selectedAgent.tagValue("role")}
															</span>
														</div>
													)}
													{selectedAgent.tags.filter((tag) => tag[0] === "t")
														.length > 0 && (
														<div className="flex items-start gap-2">
															<Tag className="w-5 h-5 text-orange-600 mt-0.5" />
															<div className="flex flex-wrap gap-2">
																{selectedAgent.tags
																	.filter((tag) => tag[0] === "t")
																	.map((tag, index) => (
																		<Badge
																			key={index}
																			variant="outline"
																			className="text-sm px-3 py-1 bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400"
																		>
																			{tag[1]}
																		</Badge>
																	))}
															</div>
														</div>
													)}
												</div>

												{/* Instructions */}
												{selectedAgent.content && (
													<div className="mt-8">
														<div className="flex items-center gap-2 mb-4">
															<Sparkles className="w-5 h-5 text-indigo-600" />
															<h4 className="text-lg font-semibold text-foreground">
																Instructions
															</h4>
														</div>
														<div className="bg-muted/50 p-6 rounded-xl border border-border">
															<pre className="whitespace-pre-wrap text-sm text-foreground font-mono leading-relaxed">
																{selectedAgent.content}
															</pre>
														</div>
													</div>
												)}

												{/* Lessons Learned */}
												{lessons && lessons.length > 0 && (
													<div className="mt-8">
														<div className="flex items-center gap-2 mb-4">
															<Brain className="w-5 h-5 text-pink-600" />
															<h4 className="text-lg font-semibold text-foreground">
																Lessons Learned
															</h4>
															<Badge variant="secondary" className="ml-auto">
																{lessons.length} lesson{lessons.length !== 1 ? 's' : ''}
															</Badge>
														</div>
														<div className="space-y-3">
															{lessons.map((lesson) => {
																const title = lesson.tagValue("title");
																const timestamp = lesson.created_at ? new Date(lesson.created_at * 1000) : null;
																
																return (
																	<div 
																		key={lesson.id} 
																		className="bg-muted/30 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
																	>
																		<div className="flex items-start justify-between gap-3 mb-2">
																			<h5 className="font-semibold text-sm text-foreground">
																				{title || "Untitled Lesson"}
																			</h5>
																			{timestamp && (
																				<time 
																					className="text-xs text-muted-foreground whitespace-nowrap"
																					dateTime={timestamp.toISOString()}
																					title={timestamp.toLocaleString()}
																				>
																					{timestamp.toLocaleDateString()}
																				</time>
																			)}
																		</div>
																		<p className="text-sm text-muted-foreground leading-relaxed">
																			{lesson.content}
																		</p>
																	</div>
																);
															})}
														</div>
													</div>
												)}
											</div>
										</div>
									) : (
										<div className="text-center py-12">
											<Bot className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
											<p className="text-muted-foreground text-lg">
												No agent selected
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

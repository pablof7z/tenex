import { NDKProject, useNDK, useProfileValue, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { Camera, FileText, Info, Plus, Server, Terminal, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { NDKAgent, NDKMCPTool } from "@tenex/cli/events";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Textarea } from "../ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { AgentSelector } from "../agents/AgentSelector";
import { MCPToolSelector } from "../mcp/MCPToolSelector";

interface EditProjectModalProps {
    project: NDKProject | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onProjectUpdated?: () => void;
}

interface ProjectEditState {
    // Metadata
    title: string;
    content: string;
    hashtags: string[];
    repo?: string;
    picture?: string;
    
    // Tags (for agents, mcp tools, rules)
    tags: Array<[string, ...string[]]>;
}

export function EditProjectModal({ 
    project, 
    open, 
    onOpenChange,
    onProjectUpdated 
}: EditProjectModalProps) {
    const { ndk } = useNDK();
    const [isUpdating, setIsUpdating] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [activeTab, setActiveTab] = useState("metadata");
    
    // Single source of truth for all project data
    const [editState, setEditState] = useState<ProjectEditState>({
        title: "",
        content: "",
        hashtags: [],
        repo: undefined,
        picture: undefined,
        tags: []
    });

    // Initialize state when project changes or modal opens
    useEffect(() => {
        if (project && open) {
            setEditState({
                title: project.title || "",
                content: project.content || "",
                hashtags: project.hashtags || [],
                repo: project.repo,
                picture: project.picture,
                tags: [...project.tags]
            });
            setHasChanges(false);
        }
    }, [project, open]);

    // Update handlers that maintain state consistency
    const updateMetadata = useCallback((updates: Partial<ProjectEditState>) => {
        setEditState(prev => ({ ...prev, ...updates }));
        setHasChanges(true);
    }, []);

    const updateTags = useCallback((updater: (tags: Array<[string, ...string[]]>) => Array<[string, ...string[]]>) => {
        setEditState(prev => ({
            ...prev,
            tags: updater(prev.tags)
        }));
        setHasChanges(true);
    }, []);

    const handleSave = async () => {
        if (!project || !ndk || !hasChanges) return;

        setIsUpdating(true);
        try {
            // Create a new project instance for publishing
            const updatedProject = new NDKProject(ndk);
            
            // Copy all tags from edit state
            updatedProject.tags = [...editState.tags];
            
            // Ensure the 'd' tag is preserved
            const dTag = project.tagValue("d");
            if (dTag) {
                // Remove any existing 'd' tag
                updatedProject.tags = updatedProject.tags.filter(tag => tag[0] !== "d");
                // Add the original 'd' tag
                updatedProject.tags.push(["d", dTag]);
            }

            // Set metadata properties
            updatedProject.title = editState.title.trim();
            updatedProject.content = editState.content.trim();
            updatedProject.hashtags = editState.hashtags;
            updatedProject.repo = editState.repo;
            updatedProject.picture = editState.picture;

            // Publish the updated project
            await updatedProject.publishReplaceable();

            setHasChanges(false);
            onProjectUpdated?.();
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to update project:", error);
            // TODO: Show error toast
        } finally {
            setIsUpdating(false);
        }
    };

    const getProjectAvatar = () => {
        if (editState.picture) {
            return editState.picture;
        }
        const seed = project?.tagValue("d") || "default";
        return `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(seed)}`;
    };

    const getInitials = (title: string) => {
        return title
            .split(" ")
            .map((word) => word.charAt(0))
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    if (!project) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b">
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle>Edit Project</DialogTitle>
                            <DialogDescription>
                                Update your project settings and configuration
                            </DialogDescription>
                        </div>
                        {hasChanges && (
                            <Button
                                onClick={handleSave}
                                disabled={isUpdating}
                                size="sm"
                            >
                                {isUpdating ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                        Saving...
                                    </>
                                ) : (
                                    "Save Changes"
                                )}
                            </Button>
                        )}
                    </div>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                    <TabsList className="w-full justify-start rounded-none border-b px-6">
                        <TabsTrigger value="metadata" className="gap-2">
                            <Info className="w-4 h-4" />
                            Metadata
                        </TabsTrigger>
                        <TabsTrigger value="agents" className="gap-2">
                            <Users className="w-4 h-4" />
                            Agents
                        </TabsTrigger>
                        <TabsTrigger value="mcp" className="gap-2">
                            <Server className="w-4 h-4" />
                            MCP Tools
                        </TabsTrigger>
                        <TabsTrigger value="rules" className="gap-2">
                            <FileText className="w-4 h-4" />
                            Rules
                        </TabsTrigger>
                    </TabsList>

                    <ScrollArea className="flex-1">
                        <TabsContent value="metadata" className="mt-0 p-6">
                            <div className="space-y-6">
                                {/* Avatar Section */}
                                <div className="flex items-center gap-6">
                                    <div className="relative">
                                        <Avatar className="w-20 h-20">
                                            <AvatarImage
                                                src={getProjectAvatar()}
                                                alt={editState.title || "Project"}
                                            />
                                            <AvatarFallback className="text-lg font-semibold bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                                                {getInitials(editState.title || "Project")}
                                            </AvatarFallback>
                                        </Avatar>
                                        <Button
                                            size="icon"
                                            variant="secondary"
                                            className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full shadow-lg"
                                            onClick={() => {
                                                const url = prompt("Enter image URL:", editState.picture || "");
                                                if (url !== null) {
                                                    updateMetadata({ picture: url || undefined });
                                                }
                                            }}
                                        >
                                            <Camera className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-sm font-medium text-slate-700">
                                            Project Name
                                        </label>
                                        <Input
                                            placeholder="Enter project name"
                                            value={editState.title}
                                            onChange={(e) => updateMetadata({ title: e.target.value })}
                                            className="mt-1"
                                        />
                                    </div>
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="text-sm font-medium text-slate-700">
                                        Description
                                    </label>
                                    <Textarea
                                        placeholder="Describe your project..."
                                        value={editState.content}
                                        onChange={(e) => updateMetadata({ content: e.target.value })}
                                        className="mt-1 min-h-[100px]"
                                    />
                                </div>

                                {/* Tags */}
                                <div>
                                    <label className="text-sm font-medium text-slate-700">
                                        Tags
                                    </label>
                                    <Input
                                        placeholder="react, typescript, web3 (comma separated)"
                                        value={editState.hashtags.join(", ")}
                                        onChange={(e) => {
                                            const hashtags = e.target.value
                                                .split(",")
                                                .map(tag => tag.trim())
                                                .filter(tag => tag.length > 0);
                                            updateMetadata({ hashtags });
                                        }}
                                        className="mt-1"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">
                                        Separate tags with commas
                                    </p>
                                </div>

                                {/* Repository URL */}
                                <div>
                                    <label className="text-sm font-medium text-slate-700">
                                        Repository URL
                                    </label>
                                    <Input
                                        placeholder="https://github.com/username/repo"
                                        value={editState.repo || ""}
                                        onChange={(e) => updateMetadata({ repo: e.target.value || undefined })}
                                        className="mt-1"
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="agents" className="mt-0 p-6">
                            <EnhancedAgentsSettings
                                tags={editState.tags}
                                onTagsChanged={updateTags}
                            />
                        </TabsContent>

                        <TabsContent value="mcp" className="mt-0 p-6">
                            <EnhancedMCPToolsSettings
                                tags={editState.tags}
                                onTagsChanged={updateTags}
                            />
                        </TabsContent>

                        <TabsContent value="rules" className="mt-0 p-6">
                            <EnhancedRulesSettings
                                tags={editState.tags}
                                onTagsChanged={updateTags}
                            />
                        </TabsContent>
                    </ScrollArea>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

// Enhanced settings components that work with centralized state
interface EnhancedSettingsProps {
    tags: Array<[string, ...string[]]>;
    onTagsChanged: (updater: (tags: Array<[string, ...string[]]>) => Array<[string, ...string[]]>) => void;
}

function EnhancedAgentsSettings({ tags, onTagsChanged }: EnhancedSettingsProps) {
    const [showAgentSelector, setShowAgentSelector] = useState(false);
    
    // Extract agent IDs from tags
    const agentIds = useMemo(() => {
        return tags
            .filter((tag) => tag[0] === "agent" && tag[1])
            .map((tag) => tag[1] as string);
    }, [tags]);
    
    const agentIdsKey = useMemo(() => agentIds.join(","), [agentIds]);
    
    // Subscribe to agent events
    const { events: agentEvents } = useSubscribe<NDKAgent>(
        agentIds.length > 0
            ? [{ kinds: [NDKAgent.kind], ids: agentIds }]
            : false,
        { wrap: true },
        [agentIdsKey]
    );
    
    const handleAddAgents = (selectedAgents: NDKAgent[]) => {
        onTagsChanged(currentTags => {
            // Remove all existing agent tags
            const nonAgentTags = currentTags.filter(tag => tag[0] !== "agent");
            // Add all selected agent tags
            const agentTags = selectedAgents.map(agent => ["agent", agent.id] as [string, ...string[]]);
            return [...nonAgentTags, ...agentTags];
        });
        setShowAgentSelector(false);
    };
    
    const handleRemoveAgent = (agentId: string) => {
        onTagsChanged(currentTags => 
            currentTags.filter(tag => !(tag[0] === "agent" && tag[1] === agentId))
        );
    };
    
    return (
        <>
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold">Project Agents</h3>
                        <p className="text-sm text-slate-600 mt-1">
                            Manage AI agents assigned to work on this project
                        </p>
                    </div>
                    <Button
                        onClick={() => setShowAgentSelector(true)}
                        size="sm"
                        variant="secondary"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Agent
                    </Button>
                </div>
                
                {agentIds.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed border-slate-200 p-8 text-center">
                        <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-600 font-medium">No agents assigned</p>
                        <p className="text-sm text-slate-500 mt-1">
                            Add agents to help work on this project
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {agentIds.map((agentId) => {
                            const agent = agentEvents.find(e => e.id === agentId);
                            return (
                                <AgentCard
                                    key={agentId}
                                    agent={agent}
                                    onRemove={() => handleRemoveAgent(agentId)}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
            
            <Dialog open={showAgentSelector} onOpenChange={setShowAgentSelector}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Select Agents</DialogTitle>
                    </DialogHeader>
                    <AgentSelector
                        selectedAgents={agentEvents}
                        onAgentsChange={handleAddAgents}
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}

function EnhancedMCPToolsSettings({ tags, onTagsChanged }: EnhancedSettingsProps) {
    const [showToolSelector, setShowToolSelector] = useState(false);
    
    // Extract tool IDs from tags
    const toolIds = useMemo(() => {
        return tags
            .filter((tag) => tag[0] === "mcp" && tag[1])
            .map((tag) => tag[1] as string);
    }, [tags]);
    
    const toolIdsKey = useMemo(() => toolIds.join(","), [toolIds]);
    
    // Subscribe to tool events
    const { events: toolEvents } = useSubscribe<NDKMCPTool>(
        toolIds.length > 0
            ? [{ kinds: [NDKMCPTool.kind], ids: toolIds }]
            : false,
        { wrap: true },
        [toolIdsKey]
    );
    
    const handleAddTools = (selectedTools: NDKMCPTool[]) => {
        onTagsChanged(currentTags => {
            // Remove all existing MCP tags
            const nonMCPTags = currentTags.filter(tag => tag[0] !== "mcp");
            // Add all selected MCP tags
            const mcpTags = selectedTools.map(tool => ["mcp", tool.id] as [string, ...string[]]);
            return [...nonMCPTags, ...mcpTags];
        });
        setShowToolSelector(false);
    };
    
    const handleRemoveTool = (toolId: string) => {
        onTagsChanged(currentTags => 
            currentTags.filter(tag => !(tag[0] === "mcp" && tag[1] === toolId))
        );
    };
    
    return (
        <>
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold">MCP Tools</h3>
                        <p className="text-sm text-slate-600 mt-1">
                            Select the MCP tools available for this project
                        </p>
                    </div>
                    <Button
                        onClick={() => setShowToolSelector(true)}
                        size="sm"
                        variant="secondary"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Tool
                    </Button>
                </div>
                
                {toolIds.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed border-slate-200 p-8 text-center">
                        <Server className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-600 font-medium">No MCP tools configured</p>
                        <p className="text-sm text-slate-500 mt-1">
                            Add tools to enhance agent capabilities
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {toolIds.map((toolId) => {
                            const tool = toolEvents.find(e => e.id === toolId);
                            return (
                                <MCPToolCard
                                    key={toolId}
                                    tool={tool}
                                    onRemove={() => handleRemoveTool(toolId)}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
            
            <Dialog open={showToolSelector} onOpenChange={setShowToolSelector}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Select MCP Tools</DialogTitle>
                    </DialogHeader>
                    <MCPToolSelector
                        selectedTools={toolEvents}
                        onToolsChange={handleAddTools}
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}

function EnhancedRulesSettings({ tags, onTagsChanged }: EnhancedSettingsProps) {
    const [showRuleEditor, setShowRuleEditor] = useState(false);
    const [editingRule, setEditingRule] = useState<string>("");
    
    // Extract rule tags
    const rules = useMemo(() => {
        return tags
            .filter((tag) => tag[0] === "rule" && tag[1])
            .map((tag) => tag[1] as string);
    }, [tags]);
    
    const handleAddRule = () => {
        setEditingRule("");
        setShowRuleEditor(true);
    };
    
    const handleEditRule = (rule: string) => {
        setEditingRule(rule);
        setShowRuleEditor(true);
    };
    
    const handleSaveRule = (newRule: string) => {
        onTagsChanged(currentTags => {
            let updatedTags = [...currentTags];
            
            // If editing, remove the old rule
            if (editingRule) {
                updatedTags = updatedTags.filter(tag => 
                    !(tag[0] === "rule" && tag[1] === editingRule)
                );
            }
            
            // Add the new rule
            updatedTags.push(["rule", newRule]);
            return updatedTags;
        });
        setShowRuleEditor(false);
    };
    
    const handleRemoveRule = (rule: string) => {
        onTagsChanged(currentTags => 
            currentTags.filter(tag => !(tag[0] === "rule" && tag[1] === rule))
        );
    };
    
    return (
        <>
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold">Project Rules</h3>
                        <p className="text-sm text-slate-600 mt-1">
                            Define rules and instructions for agents working on this project
                        </p>
                    </div>
                    <Button
                        onClick={handleAddRule}
                        size="sm"
                        variant="secondary"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Rule
                    </Button>
                </div>
                
                {rules.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed border-slate-200 p-8 text-center">
                        <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-600 font-medium">No rules defined</p>
                        <p className="text-sm text-slate-500 mt-1">
                            Add rules to guide agent behavior
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {rules.map((rule, index) => (
                            <div
                                key={index}
                                className="p-3 bg-slate-50 rounded-lg border border-slate-200 group hover:border-slate-300 transition-colors"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <p className="text-sm text-slate-700 flex-1">{rule}</p>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => handleEditRule(rule)}
                                        >
                                            <FileText className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-600 hover:text-red-700"
                                            onClick={() => handleRemoveRule(rule)}
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            <Dialog open={showRuleEditor} onOpenChange={setShowRuleEditor}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingRule ? "Edit Rule" : "Add New Rule"}</DialogTitle>
                    </DialogHeader>
                    <RuleEditor
                        initialValue={editingRule}
                        onSave={handleSaveRule}
                        onCancel={() => setShowRuleEditor(false)}
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}

// Component Cards
function AgentCard({ agent, onRemove }: { agent?: NDKAgent; onRemove: () => void }) {
    const authorProfile = useProfileValue(agent?.pubkey);
    
    if (!agent) {
        return (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-200 rounded-full animate-pulse" />
                        <div className="space-y-2">
                            <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                            <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    
    const getAgentAvatar = () => {
        if (authorProfile?.image) return authorProfile.image;
        return `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(agent.id)}`;
    };
    
    return (
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                        <AvatarImage src={getAgentAvatar()} alt={agent.name} />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm">
                            {agent.name?.slice(0, 2).toUpperCase() || "AG"}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <h4 className="font-medium text-sm text-slate-900">
                            {agent.name || "Unnamed Agent"}
                        </h4>
                        {agent.description && (
                            <p className="text-xs text-slate-600 line-clamp-1">
                                {agent.description}
                            </p>
                        )}
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-red-600"
                    onClick={onRemove}
                >
                    <X className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}

function MCPToolCard({ tool, onRemove }: { tool?: NDKMCPTool; onRemove: () => void }) {
    if (!tool) {
        return (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-200 rounded animate-pulse" />
                        <div className="space-y-2">
                            <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                            <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    
    const getToolIcon = () => {
        if (tool.icon) return tool.icon;
        return `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(tool.id)}`;
    };
    
    return (
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 rounded-lg">
                        <AvatarImage src={getToolIcon()} alt={tool.name} />
                        <AvatarFallback className="rounded-lg bg-gradient-to-br from-green-500 to-teal-600 text-white">
                            <Terminal className="w-5 h-5" />
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <h4 className="font-medium text-sm text-slate-900">
                            {tool.name || "Unnamed Tool"}
                        </h4>
                        {tool.description && (
                            <p className="text-xs text-slate-600 line-clamp-1">
                                {tool.description}
                            </p>
                        )}
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-red-600"
                    onClick={onRemove}
                >
                    <X className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}

function RuleEditor({ 
    initialValue, 
    onSave, 
    onCancel 
}: { 
    initialValue: string; 
    onSave: (rule: string) => void; 
    onCancel: () => void;
}) {
    const [value, setValue] = useState(initialValue);
    
    return (
        <div className="space-y-4">
            <Textarea
                placeholder="Enter a rule or instruction for agents..."
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="min-h-[100px]"
                autoFocus
            />
            <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onCancel}>
                    Cancel
                </Button>
                <Button 
                    onClick={() => onSave(value.trim())}
                    disabled={!value.trim()}
                >
                    Save Rule
                </Button>
            </div>
        </div>
    );
}
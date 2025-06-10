import {
    NDKProject,
    useSubscribe,
    useProfileValue,
} from "@nostr-dev-kit/ndk-hooks";
import { Plus, X, FileText, Loader2, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import type { NDKLLMRule, InstructionWithAgents } from "../../types/template";
import { NDKAgent } from "../../events/agent";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { InstructionSelector } from "../InstructionSelector";
import { cn } from "../../lib/utils";

interface RulesSettingsProps {
    project: NDKProject;
    editedProject: NDKProject;
    onProjectChanged: () => void;
}

interface ProjectRule {
    id: string;
    assignedAgents: string[];
    rule?: NDKLLMRule;
}

export function RulesSettings({
    project,
    editedProject,
    onProjectChanged,
}: RulesSettingsProps) {
    const [projectRules, setProjectRules] = useState<ProjectRule[]>([]);
    const [projectAgents, setProjectAgents] = useState<NDKAgent[]>([]);
    const [showRuleSelector, setShowRuleSelector] = useState(false);
    const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());

    // Get rule tags from project
    const ruleTags = project.tags.filter((tag) => tag[0] === "rule" && tag[1]);
    
    // Get agent IDs from project tags
    const agentIds = project.tags
        .filter((tag) => tag[0] === "agent" && tag[1])
        .map((tag) => tag[1]);

    // Subscribe to agent events
    const { events: agentEvents } = useSubscribe<NDKAgent>(
        agentIds.length > 0
            ? {
                  kinds: [NDKAgent.kind],
                  ids: agentIds,
              }
            : false,
        { wrap: true },
        [agentIds.join(",")]
    );

    // Update projectAgents when agent events are loaded
    useEffect(() => {
        setProjectAgents(agentEvents);
    }, [agentEvents]);

    // Extract rule IDs
    const ruleIds = ruleTags.map((tag) => tag[1]);

    // Subscribe to rule events
    const { events: ruleEvents } = useSubscribe<NDKLLMRule>(
        ruleIds.length > 0
            ? {
                  kinds: [1339], // INSTRUCTION_KIND
                  ids: ruleIds,
              }
            : false,
        { wrap: true },
        [ruleIds.join(",")]
    );

    // Update projectRules when rule events are loaded
    useEffect(() => {
        const rules: ProjectRule[] = ruleTags.map((tag) => {
            const ruleId = tag[1];
            const assignedAgents = tag.slice(2); // Agent names after rule ID
            const rule = ruleEvents.find((e) => e.id === ruleId);
            return { id: ruleId, assignedAgents, rule };
        });
        setProjectRules(rules);
    }, [ruleEvents, ruleTags.map(t => t.join(",")).join("|")]);

    const handleAddRules = (selectedRules: InstructionWithAgents[]) => {
        const newRules = selectedRules.filter(
            (rule) => !projectRules.some((pr) => pr.id === rule.id)
        );
        if (newRules.length > 0) {
            const updatedRules = [
                ...projectRules,
                ...newRules.map((rule) => ({
                    id: rule.id,
                    assignedAgents: rule.assignedAgents || [],
                    rule: rule as NDKLLMRule,
                })),
            ];
            setProjectRules(updatedRules);
            
            // Update the edited project
            editedProject.tags = editedProject.tags.filter((tag) => tag[0] !== "rule");
            updatedRules.forEach((pr) => {
                if (pr.assignedAgents.length > 0) {
                    editedProject.tags.push(["rule", pr.id, ...pr.assignedAgents]);
                } else {
                    editedProject.tags.push(["rule", pr.id]);
                }
            });
            
            onProjectChanged();
        }
        setShowRuleSelector(false);
    };

    const handleRemoveRule = (ruleId: string) => {
        const updatedRules = projectRules.filter((pr) => pr.id !== ruleId);
        setProjectRules(updatedRules);
        
        // Update the edited project
        editedProject.tags = editedProject.tags.filter((tag) => tag[0] !== "rule");
        updatedRules.forEach((pr) => {
            if (pr.assignedAgents.length > 0) {
                editedProject.tags.push(["rule", pr.id, ...pr.assignedAgents]);
            } else {
                editedProject.tags.push(["rule", pr.id]);
            }
        });
        
        onProjectChanged();
    };

    const handleUpdateRuleAgents = (ruleId: string, agentNames: string[]) => {
        const updatedRules = projectRules.map((pr) =>
            pr.id === ruleId ? { ...pr, assignedAgents: agentNames } : pr
        );
        setProjectRules(updatedRules);
        
        // Update the edited project
        editedProject.tags = editedProject.tags.filter((tag) => tag[0] !== "rule");
        updatedRules.forEach((pr) => {
            if (pr.assignedAgents.length > 0) {
                editedProject.tags.push(["rule", pr.id, ...pr.assignedAgents]);
            } else {
                editedProject.tags.push(["rule", pr.id]);
            }
        });
        
        onProjectChanged();
    };


    const toggleRuleExpanded = (ruleId: string) => {
        setExpandedRules((prev) => {
            const next = new Set(prev);
            if (next.has(ruleId)) {
                next.delete(ruleId);
            } else {
                next.add(ruleId);
            }
            return next;
        });
    };

    return (
        <div className="p-4 space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="bg-white rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold text-slate-900">
                        Project Rules & Instructions
                    </h2>
                    <Button
                        onClick={() => setShowRuleSelector(true)}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Rule
                    </Button>
                </div>
                <p className="text-sm text-slate-600">
                    Manage instructions and rules for AI agents in this project
                </p>
            </div>

            {/* Rule List */}
            <div className="space-y-3">
                {projectRules.length === 0 ? (
                    <div className="bg-white rounded-lg p-12 text-center">
                        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-600 mb-2">No rules configured</p>
                        <p className="text-sm text-slate-500">
                            Add rules to guide AI agents working on this project
                        </p>
                    </div>
                ) : (
                    projectRules.map((pr) => (
                        <RuleCard
                            key={pr.id}
                            projectRule={pr}
                            projectAgents={projectAgents}
                            isExpanded={expandedRules.has(pr.id)}
                            onToggleExpanded={() => toggleRuleExpanded(pr.id)}
                            onRemove={() => handleRemoveRule(pr.id)}
                            onUpdateAgents={(agents) => handleUpdateRuleAgents(pr.id, agents)}
                        />
                    ))
                )}
            </div>


            {/* Rule Selector Dialog */}
            <Dialog open={showRuleSelector} onOpenChange={setShowRuleSelector}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Select Rules & Instructions</DialogTitle>
                    </DialogHeader>
                    <InstructionSelector
                        selectedInstructions={projectRules
                            .map((pr) => ({
                                ...pr.rule,
                                assignedAgents: pr.assignedAgents,
                            }))
                            .filter(Boolean) as InstructionWithAgents[]}
                        onSelectionChange={handleAddRules}
                        showAgentAssignment={true}
                        availableAgents={projectAgents}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}

function RuleCard({
    projectRule,
    projectAgents,
    isExpanded,
    onToggleExpanded,
    onRemove,
    onUpdateAgents,
}: {
    projectRule: ProjectRule;
    projectAgents: NDKAgent[];
    isExpanded: boolean;
    onToggleExpanded: () => void;
    onRemove: () => void;
    onUpdateAgents: (agents: string[]) => void;
}) {
    const rule = projectRule.rule;
    const authorProfile = useProfileValue(rule?.pubkey);

    if (!rule) {
        return (
            <div className="bg-white rounded-lg p-4 border border-slate-200">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
                        <div className="h-3 w-32 bg-slate-200 rounded animate-pulse" />
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onRemove}
                        className="text-slate-400 hover:text-red-600"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        );
    }

    const title = rule.tagValue("title") || "Untitled Rule";
    const description = rule.tagValue("description") || "";
    const hashtags = rule.getMatchingTags("t").map((tag) => tag[1]);

    const handleToggleAgent = (agentName: string) => {
        const currentAgents = [...projectRule.assignedAgents];
        const index = currentAgents.indexOf(agentName);
        if (index >= 0) {
            currentAgents.splice(index, 1);
        } else {
            currentAgents.push(agentName);
        }
        onUpdateAgents(currentAgents);
    };

    const isAllAgents = projectRule.assignedAgents.length === 0;

    return (
        <div className="bg-white rounded-lg border border-slate-200">
            <div
                className="p-4 cursor-pointer hover:bg-slate-50"
                onClick={onToggleExpanded}
            >
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-slate-900">{title}</h3>
                            <ChevronRight
                                className={cn(
                                    "w-4 h-4 text-slate-400 transition-transform",
                                    isExpanded && "rotate-90"
                                )}
                            />
                        </div>
                        {description && (
                            <p className="text-sm text-slate-600 line-clamp-2 mb-2">
                                {description}
                            </p>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                            {isAllAgents ? (
                                <Badge variant="default" className="text-xs">
                                    All Agents
                                </Badge>
                            ) : (
                                projectRule.assignedAgents.map((agentName) => (
                                    <Badge key={agentName} variant="secondary" className="text-xs">
                                        {agentName}
                                    </Badge>
                                ))
                            )}
                            {hashtags.length > 0 && (
                                <>
                                    <span className="text-slate-300">•</span>
                                    {hashtags.map((tag) => (
                                        <Badge key={tag} variant="outline" className="text-xs">
                                            #{tag}
                                        </Badge>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove();
                        }}
                        className="text-slate-400 hover:text-red-600 ml-2"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {isExpanded && (
                <div className="border-t border-slate-200 p-4 space-y-4">
                    {rule.content && (
                        <div>
                            <h4 className="text-sm font-medium text-slate-700 mb-2">
                                Instruction Content
                            </h4>
                            <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-wrap font-mono">
                                {rule.content}
                            </div>
                        </div>
                    )}

                    <div>
                        <h4 className="text-sm font-medium text-slate-700 mb-2">
                            Assign to Agents
                        </h4>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isAllAgents}
                                    onChange={() => onUpdateAgents([])}
                                    className="rounded border-slate-300"
                                />
                                <span className="text-sm text-slate-700">All Agents</span>
                            </label>
                            {projectAgents.map((agent) => (
                                <label
                                    key={agent.id}
                                    className="flex items-center gap-2 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={
                                            !isAllAgents &&
                                            projectRule.assignedAgents.includes(agent.name || "")
                                        }
                                        onChange={() => handleToggleAgent(agent.name || "")}
                                        disabled={isAllAgents}
                                        className="rounded border-slate-300 disabled:opacity-50"
                                    />
                                    <span
                                        className={cn(
                                            "text-sm",
                                            isAllAgents
                                                ? "text-slate-400"
                                                : "text-slate-700"
                                        )}
                                    >
                                        {agent.name || "Unnamed Agent"}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {authorProfile && (
                        <div className="text-xs text-slate-500">
                            Created by {authorProfile.name || authorProfile.displayName || "Unknown"}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
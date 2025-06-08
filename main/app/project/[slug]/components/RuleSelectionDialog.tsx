"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { NDKLLMRule } from "@/lib/nostr/events/rule";
import { useNDK, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Hash, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

interface RuleSelectionDialogProps {
    onAddRules: (rules: NDKLLMRule[]) => void;
    selectedRuleIds?: Set<string>;
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function RuleSelectionDialog({
    onAddRules,
    selectedRuleIds = new Set(),
    children,
    open: controlledOpen,
    onOpenChange,
}: RuleSelectionDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const open = controlledOpen ?? internalOpen;
    const setOpen = onOpenChange ?? setInternalOpen;
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedHashtag, setSelectedHashtag] = useState<string | null>(null);
    const [selectedRules, setSelectedRules] = useState<Set<string>>(new Set());
    const [previewRule, setPreviewRule] = useState<NDKLLMRule | null>(null);
    const [newRuleTitle, setNewRuleTitle] = useState("");
    const [newRuleDescription, setNewRuleDescription] = useState("");
    const [newRuleContent, setNewRuleContent] = useState("");
    const [newRuleHashtags, setNewRuleHashtags] = useState("");
    const [showCreateForm, setShowCreateForm] = useState(false);
    const { ndk } = useNDK();

    const { events: ruleEvents } = useSubscribe(
        open
            ? [
                  {
                      kinds: [1339],
                      limit: 1000,
                  },
              ]
            : false,
    );

    const rules = useMemo(() => {
        return ruleEvents.map((event) => NDKLLMRule.from(event));
    }, [ruleEvents]);

    const allHashtags = useMemo(() => {
        const tagSet = new Set<string>();
        rules.forEach((rule) => {
            rule.hashtags.forEach((tag) => tagSet.add(tag));
        });
        return Array.from(tagSet).sort();
    }, [rules]);

    const filteredRules = useMemo(() => {
        let filtered = rules;

        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            filtered = filtered.filter(
                (rule) =>
                    rule.title.toLowerCase().includes(searchLower) ||
                    rule.description.toLowerCase().includes(searchLower) ||
                    rule.ruleContent.toLowerCase().includes(searchLower) ||
                    rule.hashtags.some((tag) => tag.toLowerCase().includes(searchLower)),
            );
        }

        if (selectedHashtag) {
            filtered = filtered.filter((rule) => rule.hashtags.includes(selectedHashtag));
        }

        return filtered;
    }, [rules, searchTerm, selectedHashtag]);

    const handleSelectRule = (ruleId: string) => {
        const newSelected = new Set(selectedRules);
        if (newSelected.has(ruleId)) {
            newSelected.delete(ruleId);
        } else {
            newSelected.add(ruleId);
        }
        setSelectedRules(newSelected);
    };

    const handleAddSelectedRules = () => {
        const rulesToAdd = rules.filter((rule) => selectedRules.has(rule.id));
        onAddRules(rulesToAdd);
        setOpen(false);
        setSelectedRules(new Set());
        toast({
            title: "Rules Added",
            description: `Added ${rulesToAdd.length} rule(s) to your project.`,
        });
    };

    const handleCreateNewRule = async () => {
        if (!newRuleTitle || !newRuleContent) {
            toast({
                title: "Missing Information",
                description: "Please provide at least a title and content for the rule.",
                variant: "destructive",
            });
            return;
        }

        const rule = new NDKLLMRule(ndk!);
        rule.title = newRuleTitle;
        rule.description = newRuleDescription;
        rule.ruleContent = newRuleContent;
        rule.hashtags = newRuleHashtags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);

        try {
            await rule.publish();
            onAddRules([rule]);
            setOpen(false);
            setNewRuleTitle("");
            setNewRuleDescription("");
            setNewRuleContent("");
            setNewRuleHashtags("");
            setShowCreateForm(false);
            toast({
                title: "Rule Created",
                description: "Your new rule has been created and added to the project.",
            });
        } catch {
            toast({
                title: "Error",
                description: "Failed to create rule. Please try again.",
                variant: "destructive",
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle>
                        {showCreateForm ? "Create New Rule" : previewRule ? "Rule Preview" : "Add Rules to Project"}
                    </DialogTitle>
                    <DialogDescription>
                        {showCreateForm
                            ? "Define a new rule for your project"
                            : previewRule
                              ? "Review the rule details"
                              : "Search and select rules to add to your project"}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {showCreateForm ? (
                        <>
                            {/* Create new rule form */}
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="title">Title</Label>
                                    <Input
                                        id="title"
                                        value={newRuleTitle}
                                        onChange={(e) => setNewRuleTitle(e.target.value)}
                                        placeholder="Enter rule title..."
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="description">Description</Label>
                                    <Input
                                        id="description"
                                        value={newRuleDescription}
                                        onChange={(e) => setNewRuleDescription(e.target.value)}
                                        placeholder="Enter rule description..."
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="hashtags">Hashtags (comma-separated)</Label>
                                    <Input
                                        id="hashtags"
                                        value={newRuleHashtags}
                                        onChange={(e) => setNewRuleHashtags(e.target.value)}
                                        placeholder="e.g., javascript, testing, best-practices"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="content">Rule Content</Label>
                                    <Textarea
                                        id="content"
                                        value={newRuleContent}
                                        onChange={(e) => setNewRuleContent(e.target.value)}
                                        placeholder="Enter the rule content..."
                                        className="min-h-[300px] font-mono"
                                    />
                                </div>
                            </div>

                            <DialogFooter>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setShowCreateForm(false);
                                        setNewRuleTitle("");
                                        setNewRuleDescription("");
                                        setNewRuleContent("");
                                        setNewRuleHashtags("");
                                    }}
                                >
                                    Back
                                </Button>
                                <Button onClick={handleCreateNewRule} disabled={!newRuleTitle || !newRuleContent}>
                                    Create & Add Rule
                                </Button>
                            </DialogFooter>
                        </>
                    ) : previewRule ? (
                        <>
                            {/* Preview mode */}
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setPreviewRule(null)}
                                    className="gap-2"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Back to list
                                </Button>
                                <div className="flex-1" />
                                <div className="flex items-center gap-2">
                                    {selectedRuleIds.has(previewRule.id) ? (
                                        <Badge variant="secondary">Already added</Badge>
                                    ) : selectedRules.has(previewRule.id) ? (
                                        <Badge variant="default">Selected</Badge>
                                    ) : null}
                                </div>
                            </div>

                            <ScrollArea className="h-[450px]">
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-2xl font-semibold">{previewRule.title}</h3>
                                        {previewRule.description && (
                                            <p className="text-muted-foreground mt-2">{previewRule.description}</p>
                                        )}
                                        {previewRule.hashtags.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-3">
                                                {previewRule.hashtags.map((tag) => (
                                                    <Badge key={tag} variant="secondary">
                                                        <Hash className="w-3 h-3 mr-1" />
                                                        {tag}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <Separator />

                                    <div className="bg-muted/50 rounded-lg p-4">
                                        <pre className="text-sm whitespace-pre-wrap font-mono">
                                            {previewRule.ruleContent}
                                        </pre>
                                    </div>
                                </div>
                            </ScrollArea>

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setPreviewRule(null)}>
                                    Back
                                </Button>
                                {!selectedRuleIds.has(previewRule.id) && (
                                    <Button
                                        onClick={() => {
                                            handleSelectRule(previewRule.id);
                                            setPreviewRule(null);
                                        }}
                                        variant={selectedRules.has(previewRule.id) ? "secondary" : "default"}
                                    >
                                        {selectedRules.has(previewRule.id) ? "Deselect" : "Select"} Rule
                                    </Button>
                                )}
                            </DialogFooter>
                        </>
                    ) : (
                        <>
                            {/* List mode */}
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search rules by title, description, or content..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-8"
                                    />
                                </div>
                            </div>

                            {allHashtags.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    <Badge
                                        variant={selectedHashtag === null ? "default" : "outline"}
                                        className="cursor-pointer"
                                        onClick={() => setSelectedHashtag(null)}
                                    >
                                        All
                                    </Badge>
                                    {allHashtags.map((tag) => (
                                        <Badge
                                            key={tag}
                                            variant={selectedHashtag === tag ? "default" : "outline"}
                                            className="cursor-pointer"
                                            onClick={() => setSelectedHashtag(tag)}
                                        >
                                            <Hash className="w-3 h-3 mr-1" />
                                            {tag}
                                        </Badge>
                                    ))}
                                </div>
                            )}

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <Label>Available Rules ({filteredRules.length})</Label>
                                    {selectedRules.size > 0 && (
                                        <Badge variant="default">{selectedRules.size} selected</Badge>
                                    )}
                                </div>
                                <ScrollArea className="h-[400px] border rounded-md p-2">
                                    <div className="space-y-2">
                                        {filteredRules.map((rule) => (
                                            <Card
                                                key={rule.id}
                                                className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                                                    selectedRules.has(rule.id) ? "border-primary" : ""
                                                } ${selectedRuleIds.has(rule.id) ? "opacity-50" : ""}`}
                                                onClick={() => setPreviewRule(rule)}
                                            >
                                                <CardHeader className="p-4">
                                                    <div className="flex items-start gap-3">
                                                        <div
                                                            className="mt-0.5"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                !selectedRuleIds.has(rule.id) &&
                                                                    handleSelectRule(rule.id);
                                                            }}
                                                        >
                                                            {selectedRuleIds.has(rule.id) ? (
                                                                <CheckCircle2 className="w-5 h-5 text-muted-foreground" />
                                                            ) : selectedRules.has(rule.id) ? (
                                                                <CheckCircle2 className="w-5 h-5 text-primary" />
                                                            ) : (
                                                                <Circle className="w-5 h-5 text-muted-foreground hover:text-primary" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 space-y-1">
                                                            <CardTitle className="text-base">{rule.title}</CardTitle>
                                                            {rule.description && (
                                                                <CardDescription className="text-sm">
                                                                    {rule.description}
                                                                </CardDescription>
                                                            )}
                                                            {rule.hashtags.length > 0 && (
                                                                <div className="flex flex-wrap gap-1 mt-2">
                                                                    {rule.hashtags.map((tag) => (
                                                                        <Badge
                                                                            key={tag}
                                                                            variant="secondary"
                                                                            className="text-xs"
                                                                        >
                                                                            {tag}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                                    </div>
                                                </CardHeader>
                                            </Card>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </div>

                            <DialogFooter>
                                <div className="flex items-center justify-between w-full">
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowCreateForm(true)}
                                        className="mr-auto"
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Create New Rule
                                    </Button>
                                    <div className="flex gap-2">
                                        <Button variant="outline" onClick={() => setOpen(false)}>
                                            Cancel
                                        </Button>
                                        <Button onClick={handleAddSelectedRules} disabled={selectedRules.size === 0}>
                                            Add {selectedRules.size} Rule{selectedRules.size !== 1 ? "s" : ""}
                                        </Button>
                                    </div>
                                </div>
                            </DialogFooter>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

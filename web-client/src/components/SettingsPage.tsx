import {
    NDKPrivateKeySigner,
    useNDKCurrentPubkey,
    useNDKSessionLogout,
    useNDKSessionSigners,
} from "@nostr-dev-kit/ndk-hooks";
import { ArrowLeft, Bot, Check, Copy, Eye, EyeOff, LogOut, Mic, Settings } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { LLMSettings } from "./settings/LLMSettings";
import { SpeechSettings } from "./settings/SpeechSettings";

interface SettingsPageProps {
    onBack: () => void;
}

type SettingsTab = 'llm' | 'speech' | 'account' | 'agents';

export function SettingsPage({ onBack }: SettingsPageProps) {
    const [activeTab, setActiveTab] = useState<SettingsTab>('llm');
    const [showNsec, setShowNsec] = useState(false);
    const [copiedNsec, setCopiedNsec] = useState(false);
    const logout = useNDKSessionLogout();
    const currentPubkey = useNDKCurrentPubkey();
    const signers = useNDKSessionSigners();
    const navigate = useNavigate();

    const handleLogout = () => {
        if (currentPubkey) {
            logout(currentPubkey);
        }
    };

    const getNsec = () => {
        if (!currentPubkey) return null;
        const signer = signers.get(currentPubkey);

        // Check if it's a private key signer
        if (signer && signer instanceof NDKPrivateKeySigner) {
            return signer.nsec;
        }
        return null;
    };

    const handleCopyNsec = async () => {
        const nsec = getNsec();
        if (nsec) {
            await navigator.clipboard.writeText(nsec);
            setCopiedNsec(true);
            setTimeout(() => setCopiedNsec(false), 2000);
        }
    };

    const tabs = [
        { id: 'llm' as SettingsTab, label: 'LLM Models', icon: Settings },
        { id: 'speech' as SettingsTab, label: 'Speech-to-Text', icon: Mic },
        { id: 'account' as SettingsTab, label: 'Account', icon: Bot },
        { id: 'agents' as SettingsTab, label: 'Agents', icon: Bot },
    ];

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="bg-card border-b border-border backdrop-blur-xl bg-card/95 sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={onBack} className="w-9 h-9">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-semibold">Settings</h1>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-border bg-background/95 backdrop-blur-xl sticky top-[73px] z-40">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="flex space-x-8">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 py-4 text-sm font-medium border-b-2 transition-colors ${
                                        activeTab === tab.id
                                            ? 'border-primary text-primary'
                                            : 'border-transparent text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-6xl mx-auto px-6 py-8">
                {activeTab === 'llm' && <LLMSettings />}
                
                {activeTab === 'speech' && <SpeechSettings />}
                
                {activeTab === 'account' && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-semibold">Account Information</h2>
                            <p className="text-muted-foreground">
                                Manage your Nostr identity and account settings
                            </p>
                        </div>
                        
                        <div className="bg-card rounded-lg p-6 space-y-4 max-w-2xl">
                            <div className="space-y-3">
                                <div>
                                    <p className="text-sm text-muted-foreground mb-2">Signed in as:</p>
                                    <div className="bg-muted/50 rounded-md p-3 font-mono text-sm break-all">
                                        {currentPubkey || "Unknown"}
                                    </div>
                                </div>

                                {getNsec() && (
                                    <div>
                                        <p className="text-sm text-muted-foreground mb-2">
                                            Private Key (nsec):
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-muted/50 rounded-md p-3 font-mono text-sm">
                                                {showNsec ? getNsec() : "•".repeat(63)}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setShowNsec(!showNsec)}
                                                className="shrink-0"
                                            >
                                                {showNsec ? (
                                                    <EyeOff className="w-4 h-4" />
                                                ) : (
                                                    <Eye className="w-4 h-4" />
                                                )}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={handleCopyNsec}
                                                className="shrink-0"
                                            >
                                                {copiedNsec ? (
                                                    <Check className="w-4 h-4 text-green-500" />
                                                ) : (
                                                    <Copy className="w-4 h-4" />
                                                )}
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-2">
                                            ⚠️ Keep your private key secure. Anyone with this key can
                                            control your account.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <Button
                                onClick={handleLogout}
                                variant="destructive"
                                className="w-full sm:w-auto flex items-center gap-2"
                            >
                                <LogOut className="w-4 h-4" />
                                Logout
                            </Button>
                        </div>
                    </div>
                )}
                
                {activeTab === 'agents' && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-semibold">Agent Management</h2>
                            <p className="text-muted-foreground">
                                Manage your AI agents and their configurations
                            </p>
                        </div>
                        
                        <div className="bg-card rounded-lg p-6 max-w-2xl">
                            <div className="space-y-4">
                                <Button
                                    variant="outline"
                                    onClick={() => navigate("/agent-requests")}
                                    className="flex items-center gap-2 justify-start"
                                >
                                    <Bot className="w-4 h-4" />
                                    Agent Requests
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

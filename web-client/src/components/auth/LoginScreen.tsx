import {
    NDKNip07Signer,
    NDKPrivateKeySigner,
    useNDKCurrentPubkey,
    useNDKSessionLogin,
} from "@nostr-dev-kit/ndk-hooks";
import { ArrowRight, Chrome, Copy, Key, UserPlus, Zap } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/button";

export function LoginScreen() {
    const [nsecInput, setNsecInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [selectedMethod, setSelectedMethod] = useState<"extension" | "key" | "new" | null>(null);
    const [newAccountPubkey, setNewAccountPubkey] = useState<string | null>(null);
    const [newAccountSigner, setNewAccountSigner] = useState<NDKPrivateKeySigner | null>(null);
    const [copied, setCopied] = useState(false);
    const login = useNDKSessionLogin();
    const currentPubkey = useNDKCurrentPubkey();
    const navigate = useNavigate();

    // Redirect if already logged in (but not if we just created a new account)
    useEffect(() => {
        if (currentPubkey && !newAccountPubkey) {
            navigate("/", { replace: true });
        }
    }, [currentPubkey, navigate, newAccountPubkey]);

    const handleNip07Login = useCallback(async () => {
        setIsLoading(true);
        try {
            const signer = new NDKNip07Signer();
            await signer.blockUntilReady();
            login(signer);
        } catch (_error) {
            // console.error("NIP-07 login failed:", error);
        } finally {
            setIsLoading(false);
        }
    }, [login]);

    const handleNsecLogin = useCallback(() => {
        if (!nsecInput.trim()) return;

        setIsLoading(true);
        try {
            const signer = new NDKPrivateKeySigner(nsecInput.trim());
            login(signer);
        } catch (_error) {
            // console.error("Nsec login failed:", error);
        } finally {
            setIsLoading(false);
        }
    }, [nsecInput, login]);

    const handleNewAccount = useCallback(() => {
        setIsLoading(true);
        try {
            const signer = NDKPrivateKeySigner.generate();
            const pubkey = signer.pubkey;
            setNewAccountPubkey(pubkey);
            setNewAccountSigner(signer);
            // Don't login immediately - wait for user to continue
        } catch (error) {
            console.error("Account generation failed:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleCopyPubkey = useCallback(async () => {
        if (newAccountPubkey) {
            await navigator.clipboard.writeText(newAccountPubkey);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, [newAccountPubkey]);

    const handleContinueToDashboard = useCallback(() => {
        if (newAccountSigner) {
            login(newAccountSigner);
        }
    }, [newAccountSigner, login]);

    return (
        <div className="min-h-screen bg-[#0F1419] text-white flex flex-col">
            {/* Header */}
            <div className="flex-1 flex items-center justify-center px-6 py-8">
                <div className="w-full max-w-sm">
                    {/* Logo and Title */}
                    <div className="text-center mb-12">
                        <div className="w-24 h-24 bg-gradient-to-br from-[#229ED9] to-[#1B7ABF] rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">
                            <Zap className="w-12 h-12 text-white" />
                        </div>
                        <h1 className="text-3xl font-light mb-3 text-white">Nostr Projects</h1>
                        <p className="text-[#8B949E] text-base leading-relaxed">
                            Connect to the decentralized social network
                        </p>
                    </div>

                    {/* Login Methods */}
                    <div className="space-y-4">
                        {/* Browser Extension */}
                        <Button
                            onClick={handleNip07Login}
                            disabled={isLoading}
                            variant="primary"
                            size="xl"
                            rounded="xl"
                            className="w-full bg-[#229ED9] hover:bg-[#1B7ABF] dark:bg-[#229ED9] dark:hover:bg-[#1B7ABF]"
                        >
                            <Chrome className="w-6 h-6" />
                            Continue with Extension
                        </Button>

                        {/* Divider */}
                        <div className="relative my-8">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-[#30363D]" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-4 bg-[#0F1419] text-[#8B949E]">or</span>
                            </div>
                        </div>

                        {/* Private Key Toggle */}
                        <Button
                            onClick={() =>
                                setSelectedMethod(selectedMethod === "key" ? null : "key")
                            }
                            variant="secondary"
                            size="xl"
                            rounded="xl"
                            className="w-full bg-[#21262D] hover:bg-[#30363D] text-white dark:bg-[#21262D] dark:hover:bg-[#30363D] justify-between"
                        >
                            <div className="flex items-center gap-3">
                                <Key className="w-6 h-6" />
                                <span>Use Private Key</span>
                            </div>
                            <ArrowRight
                                className={`w-5 h-5 transition-transform ${selectedMethod === "key" ? "rotate-90" : ""}`}
                            />
                        </Button>

                        {/* Private Key Input */}
                        {selectedMethod === "key" && (
                            <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                                <input
                                    type="password"
                                    placeholder="nsec1..."
                                    value={nsecInput}
                                    onChange={(e) => setNsecInput(e.target.value)}
                                    className="w-full px-4 py-4 bg-[#21262D] border border-[#30363D] rounded-xl text-white placeholder-[#8B949E] focus:border-[#229ED9] focus:outline-none focus:ring-2 focus:ring-[#229ED9]/20 transition-all"
                                />
                                <Button
                                    onClick={handleNsecLogin}
                                    disabled={isLoading || !nsecInput.trim()}
                                    variant="success"
                                    size="xl"
                                    rounded="xl"
                                    className="w-full bg-[#238636] hover:bg-[#2EA043] dark:bg-[#238636] dark:hover:bg-[#2EA043]"
                                >
                                    {isLoading ? "Signing in..." : "Sign In"}
                                </Button>
                            </div>
                        )}

                        {/* Create Account Toggle */}
                        <button
                            type="button"
                            onClick={() =>
                                setSelectedMethod(selectedMethod === "new" ? null : "new")
                            }
                            className="w-full bg-[#21262D] hover:bg-[#30363D] text-white py-4 px-6 rounded-xl font-medium text-lg transition-all duration-200 flex items-center justify-between"
                        >
                            <div className="flex items-center gap-3">
                                <UserPlus className="w-6 h-6" />
                                <span>Create New Account</span>
                            </div>
                            <ArrowRight
                                className={`w-5 h-5 transition-transform ${selectedMethod === "new" ? "rotate-90" : ""}`}
                            />
                        </button>

                        {/* Create Account Confirmation */}
                        {selectedMethod === "new" && (
                            <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                                <div className="bg-[#21262D] border border-[#30363D] rounded-xl p-4">
                                    <p className="text-[#F0F6FC] text-sm leading-relaxed mb-3">
                                        This will generate a new Nostr identity for you.
                                    </p>
                                    <p className="text-[#F85149] text-xs">
                                        ⚠️ Make sure to backup your private key after creation
                                    </p>
                                </div>

                                {/* Display Generated Pubkey */}
                                {newAccountPubkey && (
                                    <div className="bg-[#238636]/10 border border-[#238636]/30 rounded-xl p-4 animate-in slide-in-from-top-2 duration-200">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-2 h-2 bg-[#238636] rounded-full" />
                                            <span className="text-[#238636] text-sm font-medium">
                                                Account Created Successfully
                                            </span>
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-[#8B949E] text-xs font-medium mb-1 block">
                                                    Your Public Key
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <code className="flex-1 bg-[#0F1419] border border-[#30363D] rounded-lg p-3 text-[#F0F6FC] text-sm font-mono break-all">
                                                        {newAccountPubkey}
                                                    </code>
                                                    <button
                                                        onClick={handleCopyPubkey}
                                                        className="flex-shrink-0 p-3 bg-[#21262D] hover:bg-[#30363D] border border-[#30363D] rounded-lg transition-colors"
                                                        title="Copy public key"
                                                    >
                                                        <Copy className="w-4 h-4 text-[#8B949E]" />
                                                    </button>
                                                </div>
                                                {copied && (
                                                    <p className="text-[#238636] text-xs mt-1">
                                                        Copied to clipboard!
                                                    </p>
                                                )}
                                            </div>
                                            <p className="text-[#8B949E] text-xs">
                                                This is your unique identifier on Nostr. You can
                                                share this with others.
                                            </p>
                                        </div>
                                        <Button
                                            onClick={handleContinueToDashboard}
                                            variant="success"
                                            size="xl"
                                            rounded="xl"
                                            className="w-full bg-[#238636] hover:bg-[#2EA043] dark:bg-[#238636] dark:hover:bg-[#2EA043]"
                                        >
                                            Continue to Dashboard
                                        </Button>
                                    </div>
                                )}

                                {!newAccountPubkey && (
                                    <Button
                                        onClick={handleNewAccount}
                                        disabled={isLoading}
                                        variant="primary"
                                        size="xl"
                                        rounded="xl"
                                        className="w-full bg-[#A855F7] hover:bg-[#9333EA] dark:bg-[#A855F7] dark:hover:bg-[#9333EA]"
                                    >
                                        {isLoading ? "Creating..." : "Generate New Identity"}
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center pb-8">
                <div className="flex items-center justify-center gap-2 text-sm text-[#8B949E]">
                    <div className="w-2 h-2 bg-[#238636] rounded-full" />
                    <span>Secure</span>
                    <div className="w-1 h-1 bg-[#8B949E] rounded-full mx-2" />
                    <div className="w-2 h-2 bg-[#229ED9] rounded-full" />
                    <span>Decentralized</span>
                    <div className="w-1 h-1 bg-[#8B949E] rounded-full mx-2" />
                    <div className="w-2 h-2 bg-[#A855F7] rounded-full" />
                    <span>Open Source</span>
                </div>
            </div>
        </div>
    );
}

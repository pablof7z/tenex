import {
	NDKPrivateKeySigner,
	useNDKCurrentPubkey,
	useNDKSessionLogout,
	useNDKSessionSigners,
} from "@nostr-dev-kit/ndk-hooks";
import { ArrowLeft, Check, Copy, Eye, EyeOff, LogOut, Bot } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface SettingsPageProps {
	onBack: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
	const [openaiApiKey, setOpenaiApiKey] = useState("");
	const [showNsec, setShowNsec] = useState(false);
	const [copiedNsec, setCopiedNsec] = useState(false);
	const logout = useNDKSessionLogout();
	const currentPubkey = useNDKCurrentPubkey();
	const signers = useNDKSessionSigners();
	const navigate = useNavigate();

	useEffect(() => {
		const savedApiKey = localStorage.getItem("openaiApiKey") || "";
		setOpenaiApiKey(savedApiKey);
	}, []);

	const handleSave = () => {
		localStorage.setItem("openaiApiKey", openaiApiKey);
		alert("Settings saved successfully!");
	};

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

	return (
		<div className="min-h-screen bg-background">
			{/* Header */}
			<div className="bg-card border-b border-border backdrop-blur-xl bg-card/95 sticky top-0 z-50">
				<div className="max-w-4xl mx-auto px-6 py-4">
					<div className="flex items-center gap-3">
						<Button
							variant="ghost"
							size="icon"
							onClick={onBack}
							className="w-9 h-9"
						>
							<ArrowLeft className="w-5 h-5" />
						</Button>
						<div>
							<h1 className="text-2xl font-semibold">Settings</h1>
						</div>
					</div>
				</div>
			</div>

			{/* Content */}
			<div className="max-w-4xl mx-auto px-6 py-8">
				<div className="grid gap-6 md:grid-cols-2">
					{/* OpenAI Configuration */}
					<div className="bg-card rounded-lg p-6 space-y-4">
						<h2 className="text-lg font-semibold">OpenAI Configuration</h2>

						<div className="space-y-3">
							<label htmlFor="openai-key" className="block text-sm font-medium">
								OpenAI API Key
							</label>
							<Input
								id="openai-key"
								type="password"
								placeholder="sk-..."
								value={openaiApiKey}
								onChange={(e) => setOpenaiApiKey(e.target.value)}
								className="w-full"
							/>
							<p className="text-sm text-muted-foreground">
								Your OpenAI API key is stored locally and used for voice
								transcription.
							</p>
						</div>

						<Button onClick={handleSave} className="w-full sm:w-auto">
							Save Settings
						</Button>
					</div>

					{/* Account Information */}
					<div className="bg-card rounded-lg p-6 space-y-4">
						<h2 className="text-lg font-semibold">Account</h2>

						<div className="space-y-3">
							<div>
								<p className="text-sm text-muted-foreground mb-2">
									Signed in as:
								</p>
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

					{/* Agent Management */}
					<div className="bg-card rounded-lg p-6 space-y-4 md:col-span-2">
						<h2 className="text-lg font-semibold">Agent Management</h2>
						
						<div className="grid gap-4 sm:grid-cols-2">
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
			</div>
		</div>
	);
}

import {
	useNDKCurrentPubkey,
	useNDKSessionLogout,
} from "@nostr-dev-kit/ndk-hooks";
import { ArrowLeft, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface SettingsPageProps {
	onBack: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
	const [openaiApiKey, setOpenaiApiKey] = useState("");
	const logout = useNDKSessionLogout();
	const currentPubkey = useNDKCurrentPubkey();

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

	return (
		<div className="min-h-screen bg-slate-50">
			{/* Header */}
			<div className="bg-white border-b border-slate-200/60 backdrop-blur-xl bg-white/95 sticky top-0 z-50">
				<div className="flex items-center justify-between px-3 sm:px-4 py-3 sm:py-4">
					<div className="flex items-center gap-2 sm:gap-3">
						<Button
							variant="ghost"
							size="icon"
							onClick={onBack}
							className="w-8 h-8 sm:w-9 sm:h-9 text-slate-700 hover:bg-slate-100"
						>
							<ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
						</Button>
						<div>
							<h1 className="text-lg sm:text-xl font-semibold text-slate-900">
								Settings
							</h1>
						</div>
					</div>
				</div>
			</div>

			{/* Content */}
			<div className="p-4 space-y-6">
				<div className="bg-white rounded-lg p-4 space-y-4">
					<h2 className="text-lg font-medium text-slate-900">
						OpenAI Configuration
					</h2>

					<div className="space-y-2">
						<label
							htmlFor="openai-key"
							className="block text-sm font-medium text-slate-700"
						>
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
						<p className="text-xs text-slate-500">
							Your OpenAI API key is stored locally and used for voice
							transcription.
						</p>
					</div>

					<Button onClick={handleSave} className="w-full">
						Save Settings
					</Button>
				</div>

				<div className="bg-white rounded-lg p-4 space-y-4">
					<h2 className="text-lg font-medium text-slate-900">Account</h2>

					<div className="space-y-2">
						<p className="text-sm text-slate-600">
							Signed in with:{" "}
							{currentPubkey
								? `${currentPubkey.slice(0, 8)}...${currentPubkey.slice(-8)}`
								: "Unknown"}
						</p>
					</div>

					<Button
						onClick={handleLogout}
						variant="destructive"
						className="w-full flex items-center gap-2"
					>
						<LogOut className="w-4 h-4" />
						Logout
					</Button>
				</div>
			</div>
		</div>
	);
}

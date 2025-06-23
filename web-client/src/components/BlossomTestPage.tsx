import { NDKPrivateKeySigner, useNDKCurrentPubkey, useNDKSessionLogin, useNDK } from "@nostr-dev-kit/ndk-hooks";
import { Upload, Key, FileText } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Buffer } from "buffer";

// Make Buffer available globally for ndk-blossom
if (typeof window !== 'undefined') {
    (window as any).Buffer = Buffer;
}

export function BlossomTestPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [uploadResult, setUploadResult] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const login = useNDKSessionLogin();
    const currentPubkey = useNDKCurrentPubkey();
    const {ndk} = useNDK();

    // Generate a new key when the page loads
    useEffect(() => {
        const newSigner = NDKPrivateKeySigner.generate();
        login(newSigner, true);
    }, [login]);

    const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !ndk) return;

        setIsLoading(true);
        setUploadError(null);
        setUploadResult(null);

        try {
            // Import ndk-blossom client
            const { default: NDKBlossom } = await import("@nostr-dev-kit/ndk-blossom");
            
            // Create blossom client - ndk is guaranteed to be non-null due to guard above
            const blossomClient = new NDKBlossom(ndk);
            
            // Upload file to blossom.primal.net
            debugger
            const uploadResponse = await blossomClient.upload(file, {
                server: "https://blossom.primal.net"
            });
            
            setUploadResult(uploadResponse.url || "Upload completed but no URL returned");
        } catch (error) {
            console.error("Upload failed:", error);
            setUploadError(error instanceof Error ? error.message : "Upload failed");
        } finally {
            setIsLoading(false);
        }
    }, [ndk]);

    return (
        <div className="min-h-screen bg-[#0F1419] text-white p-6">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-light mb-3">Blossom Upload Test</h1>
                    <p className="text-[#8B949E]">Test file uploads to blossom.primal.net</p>
                </div>

                {/* Current Pubkey Display */}
                <div className="bg-[#21262D] border border-[#30363D] rounded-xl p-6 mb-6">
                    <div className="flex items-center gap-3 mb-3">
                        <Key className="w-5 h-5 text-[#229ED9]" />
                        <h2 className="text-lg font-medium">Current Identity</h2>
                    </div>
                    <div className="bg-[#0F1419] rounded-lg p-3 font-mono text-sm break-all">
                        {currentPubkey || "Loading..."}
                    </div>
                </div>

                {/* Upload Section */}
                <div className="bg-[#21262D] border border-[#30363D] rounded-xl p-6 mb-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Upload className="w-5 h-5 text-[#229ED9]" />
                        <h2 className="text-lg font-medium">File Upload</h2>
                    </div>
                    
                    <div className="space-y-4">
                        <input
                            type="file"
                            onChange={handleFileUpload}
                            disabled={isLoading || !currentPubkey}
                            className="w-full px-4 py-3 bg-[#0F1419] border border-[#30363D] rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#229ED9] file:text-white hover:file:bg-[#1B7ABF] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        
                        {isLoading && (
                            <div className="flex items-center gap-2 text-[#229ED9]">
                                <div className="w-4 h-4 border-2 border-[#229ED9] border-t-transparent rounded-full animate-spin" />
                                <span>Uploading to blossom server...</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Results Section */}
                {(uploadResult || uploadError) && (
                    <div className="bg-[#21262D] border border-[#30363D] rounded-xl p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <FileText className="w-5 h-5 text-[#229ED9]" />
                            <h2 className="text-lg font-medium">Upload Result</h2>
                        </div>
                        
                        {uploadResult && (
                            <div className="space-y-3">
                                <div className="text-[#238636] font-medium">✅ Upload successful!</div>
                                <div className="bg-[#0F1419] rounded-lg p-3">
                                    <div className="text-sm text-[#8B949E] mb-1">File URL:</div>
                                    <div className="font-mono text-sm break-all text-[#229ED9]">
                                        <a href={uploadResult} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                            {uploadResult}
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {uploadError && (
                            <div className="space-y-3">
                                <div className="text-[#F85149] font-medium">❌ Upload failed</div>
                                <div className="bg-[#0F1419] rounded-lg p-3">
                                    <div className="text-sm text-[#F85149] font-mono">
                                        {uploadError}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
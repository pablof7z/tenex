// Demo component to show different context window states
import { ContextWindowProgressBar } from "./ContextWindowProgressBar";

export function ContextWindowDemo() {
    return (
        <div className="p-6 space-y-8 max-w-2xl">
            <h2 className="text-2xl font-bold mb-6">Context Window Progress Bar Demo</h2>
            
            {/* Low usage scenario */}
            <div className="space-y-2">
                <h3 className="text-lg font-semibold">Low Usage (30%)</h3>
                <ContextWindowProgressBar
                    totalTokens={60000}
                    contextWindow={200000}
                    maxCompletionTokens={8192}
                />
            </div>

            {/* Moderate usage scenario */}
            <div className="space-y-2">
                <h3 className="text-lg font-semibold">Moderate Usage (65%)</h3>
                <ContextWindowProgressBar
                    totalTokens={130000}
                    contextWindow={200000}
                    maxCompletionTokens={8192}
                />
            </div>

            {/* High usage scenario */}
            <div className="space-y-2">
                <h3 className="text-lg font-semibold">High Usage (80%)</h3>
                <ContextWindowProgressBar
                    totalTokens={160000}
                    contextWindow={200000}
                    maxCompletionTokens={8192}
                />
            </div>

            {/* Critical usage scenario */}
            <div className="space-y-2">
                <h3 className="text-lg font-semibold">Critical Usage (95%)</h3>
                <ContextWindowProgressBar
                    totalTokens={190000}
                    contextWindow={200000}
                    maxCompletionTokens={8192}
                />
            </div>

            {/* GPT-4 scenario */}
            <div className="space-y-2">
                <h3 className="text-lg font-semibold">GPT-4o (Small context window)</h3>
                <ContextWindowProgressBar
                    totalTokens={90000}
                    contextWindow={128000}
                    maxCompletionTokens={4096}
                />
            </div>

            {/* Gemini scenario */}
            <div className="space-y-2">
                <h3 className="text-lg font-semibold">Gemini 1.5 Pro (Large context window)</h3>
                <ContextWindowProgressBar
                    totalTokens={200000}
                    contextWindow={1048576}
                />
            </div>
        </div>
    );
}
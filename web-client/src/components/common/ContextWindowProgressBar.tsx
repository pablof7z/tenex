import { Activity, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { cn } from "../../lib/utils";
import { Progress } from "../ui/progress";

interface ContextWindowProgressBarProps {
    totalTokens: number;
    contextWindow: number;
    maxCompletionTokens?: number;
    className?: string;
}

export function ContextWindowProgressBar({
    totalTokens,
    contextWindow,
    maxCompletionTokens,
    className
}: ContextWindowProgressBarProps) {
    // Calculate usage percentage
    const usagePercentage = (totalTokens / contextWindow) * 100;
    
    // Determine status and colors
    const getStatus = () => {
        if (usagePercentage >= 90) return { 
            status: "critical", 
            color: "bg-red-500", 
            icon: AlertTriangle, 
            textColor: "text-red-600 dark:text-red-400" 
        };
        if (usagePercentage >= 75) return { 
            status: "warning", 
            color: "bg-yellow-500", 
            icon: AlertTriangle, 
            textColor: "text-yellow-600 dark:text-yellow-400" 
        };
        if (usagePercentage >= 50) return { 
            status: "moderate", 
            color: "bg-blue-500", 
            icon: Activity, 
            textColor: "text-blue-600 dark:text-blue-400" 
        };
        return { 
            status: "good", 
            color: "bg-green-500", 
            icon: CheckCircle, 
            textColor: "text-green-600 dark:text-green-400" 
        };
    };

    const { color, icon: Icon, textColor } = getStatus();
    
    // Format numbers with commas
    const formatNumber = (num: number): string => {
        return num.toLocaleString();
    };

    // Format percentage
    const formatPercentage = (percentage: number): string => {
        return percentage.toFixed(1) + "%";
    };

    // Calculate remaining tokens
    const remainingTokens = contextWindow - totalTokens;

    return (
        <div className={cn("space-y-3", className)}>
            {/* Header with status */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Icon className={cn("w-4 h-4", textColor)} />
                    <span className="text-sm font-medium">Context Window Usage</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={cn("text-sm font-semibold", textColor)}>
                        {formatPercentage(usagePercentage)}
                    </span>
                </div>
            </div>

            {/* Progress bar container with gradient background */}
            <div className="relative">
                <Progress 
                    value={usagePercentage} 
                    className="h-3 bg-muted/30"
                />
                {/* Custom progress indicator with gradient */}
                <div 
                    className={cn(
                        "absolute top-0 left-0 h-3 rounded-full transition-all duration-300",
                        color,
                        "bg-gradient-to-r from-current to-current/80"
                    )}
                    style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                />
                
                {/* Completion tokens limit indicator (if available) */}
                {maxCompletionTokens && maxCompletionTokens < contextWindow && (
                    <div 
                        className="absolute top-0 h-3 w-0.5 bg-purple-400 opacity-60"
                        style={{ 
                            left: `${Math.min((contextWindow - maxCompletionTokens) / contextWindow * 100, 100)}%` 
                        }}
                        title={`Max completion tokens limit: ${formatNumber(maxCompletionTokens)}`}
                    />
                )}
            </div>

            {/* Detailed stats */}
            <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Used:</span>
                        <span className="font-mono font-medium">{formatNumber(totalTokens)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Remaining:</span>
                        <span className="font-mono font-medium text-green-600 dark:text-green-400">
                            {formatNumber(remainingTokens)}
                        </span>
                    </div>
                </div>
                <div className="space-y-1">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Capacity:</span>
                        <span className="font-mono font-medium">{formatNumber(contextWindow)}</span>
                    </div>
                    {maxCompletionTokens && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Max Completion:</span>
                            <span className="font-mono font-medium text-purple-600 dark:text-purple-400">
                                {formatNumber(maxCompletionTokens)}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Status message */}
            <div className="flex items-start gap-2 p-2 rounded-md bg-muted/20">
                <Info className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="text-xs text-muted-foreground leading-relaxed">
                    {usagePercentage >= 90 && (
                        <span>Context window is nearly full. Consider starting a new conversation or summarizing.</span>
                    )}
                    {usagePercentage >= 75 && usagePercentage < 90 && (
                        <span>Context window usage is high. Monitor token consumption for optimal performance.</span>
                    )}
                    {usagePercentage >= 50 && usagePercentage < 75 && (
                        <span>Context window usage is moderate. Plenty of space remaining for the conversation.</span>
                    )}
                    {usagePercentage < 50 && (
                        <span>Context window usage is low. Excellent capacity remaining for this conversation.</span>
                    )}
                </div>
            </div>
        </div>
    );
}
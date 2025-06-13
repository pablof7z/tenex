import { type NDKEvent } from "@nostr-dev-kit/ndk-hooks";
import { X } from "lucide-react";
import { Button } from "../ui/button";

interface ChatDebugDialogProps {
  indicator: NDKEvent | null;
  onClose: () => void;
}

export function ChatDebugDialog({ indicator, onClose }: ChatDebugDialogProps) {
  if (!indicator) return null;

  const systemPromptTag = indicator.tags.find(tag => tag[0] === 'system-prompt');
  const promptTag = indicator.tags.find(tag => tag[0] === 'prompt');

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background border rounded-lg shadow-lg max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">LLM Debug Information</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* System Prompt */}
          {systemPromptTag && (
            <div>
              <h4 className="font-semibold mb-2">System Prompt</h4>
              <pre className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap overflow-x-auto">
                {systemPromptTag[1]}
              </pre>
            </div>
          )}
          
          {/* User Prompt */}
          {promptTag && (
            <div>
              <h4 className="font-semibold mb-2">User Prompt</h4>
              <pre className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap overflow-x-auto">
                {promptTag[1]}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
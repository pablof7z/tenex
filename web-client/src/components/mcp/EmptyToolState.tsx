import { Server } from "lucide-react";

export function EmptyToolState() {
    return (
        <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
                <Server className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-lg font-semibold mb-2">No MCP tool selected</h2>
                <p className="text-muted-foreground">
                    Select an MCP tool from the list or create a new one
                </p>
            </div>
        </div>
    );
}
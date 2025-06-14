/**
 * Project status types
 */
export type ProjectStatusType = "active" | "inactive" | "archived" | "error";
export interface ProjectStatusInfo {
    status: ProjectStatusType;
    lastActive?: number;
    activeAgents?: string[];
    runningTasks?: number;
    error?: string;
}
export interface ProjectProcess {
    pid: number;
    projectPath: string;
    projectNaddr: string;
    startTime: number;
    status: "running" | "stopped" | "error";
    lastPing?: number;
}
//# sourceMappingURL=status.d.ts.map
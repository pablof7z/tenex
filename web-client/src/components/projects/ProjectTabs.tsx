import { type NDKProject } from "@nostr-dev-kit/ndk-hooks";
import { ArrowLeft, Edit3, MoreVertical } from "lucide-react";
import { Button } from "../ui/button";

interface ProjectTabsProps {
  project: NDKProject;
  activeTab: "tasks" | "threads" | "docs";
  taskCount: number;
  threadCount: number;
  docCount: number;
  onTabChange: (tab: "tasks" | "threads" | "docs") => void;
  onBack: () => void;
  onEditProject: () => void;
}

export function ProjectTabs({
  project,
  activeTab,
  taskCount,
  threadCount,
  docCount,
  onTabChange,
  onBack,
  onEditProject,
}: ProjectTabsProps) {
  return (
    <>
      {/* Header */}
      <div className="bg-card border-b border-border/60 backdrop-blur-xl bg-card/95 sticky top-0 z-40">
        <div className="flex items-center justify-between px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="w-8 h-8 sm:w-9 sm:h-9 hover:bg-accent"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
            <div>
              <h1 className="text-lg sm:text-xl font-semibold text-foreground truncate max-w-48">
                {project.title || project.tagValue("title") || "Unnamed Project"}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {project.description ? (
                  <span className="truncate max-w-48">{project.description}</span>
                ) : (
                  <span className="italic">No description</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onEditProject}
              className="w-8 h-8 sm:w-9 sm:h-9"
            >
              <Edit3 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 sm:w-9 sm:h-9"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-card/80 backdrop-blur-sm sticky top-[60px] sm:top-[68px] z-30 border-b border-border/60">
        <div className="flex px-1 sm:px-2">
          <button
            className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-all duration-200 border-b-2 ${
              activeTab === "tasks"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onTabChange("tasks")}
          >
            Tasks ({taskCount})
          </button>
          <button
            className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-all duration-200 border-b-2 ${
              activeTab === "threads"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onTabChange("threads")}
          >
            Threads ({threadCount})
          </button>
          <button
            className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-all duration-200 border-b-2 ${
              activeTab === "docs"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onTabChange("docs")}
          >
            Docs ({docCount})
          </button>
        </div>
      </div>
    </>
  );
}
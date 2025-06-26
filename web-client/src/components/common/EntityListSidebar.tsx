import React from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

export interface EntityListItem {
  id: string
}

export interface EntityListSidebarProps<T extends EntityListItem> {
  title: string
  items: T[]
  selectedItem: T | null
  onBack: () => void
  onSelect: (item: T) => void
  onCreateNew: () => void
  getItemTitle: (item: T) => string
  getItemVersion?: (item: T) => string | undefined
  getItemDescription?: (item: T) => string | undefined
  renderItemExtra?: (item: T) => React.ReactNode
  createButtonText: string
  className?: string
  itemsClassName?: string
}

export function EntityListSidebar<T extends EntityListItem>({
  title,
  items,
  selectedItem,
  onBack,
  onSelect,
  onCreateNew,
  getItemTitle,
  getItemVersion,
  getItemDescription,
  renderItemExtra,
  createButtonText,
  className,
  itemsClassName,
}: EntityListSidebarProps<T>) {
  return (
    <div
      className={cn(
        "w-80 md:w-96 bg-background border-r border-border flex flex-col h-full",
        className
      )}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Back"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>

      <div className={cn("flex-1 overflow-y-auto p-4", itemsClassName)}>
        <div className="space-y-2">
          {items.map((item) => {
            const version = getItemVersion?.(item)
            const description = getItemDescription?.(item)
            
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-colors",
                  "hover:bg-accent hover:border-accent-foreground/20",
                  selectedItem?.id === item.id
                    ? "bg-accent border-accent-foreground/20"
                    : "bg-card border-border"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium">{getItemTitle(item)}</h3>
                  {version && (
                    <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                      v{version}
                    </span>
                  )}
                </div>
                {description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {description}
                  </p>
                )}
                {renderItemExtra?.(item)}
              </button>
            )
          })}
        </div>
      </div>

      <div className="p-4 border-t border-border">
        <Button
          onClick={onCreateNew}
          className="w-full"
          variant="outline"
        >
          <Plus className="h-4 w-4 mr-2" />
          {createButtonText}
        </Button>
      </div>
    </div>
  )
}
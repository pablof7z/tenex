import React, { useState, useMemo } from 'react';
import { useTemplates } from '@/hooks/useTemplates';
import { NostrTemplate, TemplateFilters } from '@/types/template';
import { TemplateCard } from './TemplateCard';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Filter, X } from 'lucide-react';

interface TemplateSelectorProps {
  onTemplateSelect?: (template: NostrTemplate) => void;
  selectedTemplate?: NostrTemplate;
}

export function TemplateSelector({ onTemplateSelect, selectedTemplate }: TemplateSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Build filters for the useTemplates hook
  const filters = useMemo((): TemplateFilters => {
    const result: TemplateFilters = {};
    
    if (searchTerm.trim()) {
      result.search = searchTerm.trim();
    }
    
    if (selectedTags.length > 0) {
      result.tags = selectedTags;
    }
    
    return result;
  }, [searchTerm, selectedTags]);

  // Fetch templates using the hook
  const { templates, eose } = useTemplates(filters);

  // Extract all unique tags from templates for filtering
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    templates.forEach(template => {
      template.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [templates]);

  // Handle tag selection
  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedTags([]);
  };

  // Handle template selection
  const handleTemplateSelect = (template: NostrTemplate) => {
    if (onTemplateSelect) {
      onTemplateSelect(template);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter Controls */}
      <div className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search templates by name, description, or tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tag Filters */}
        {allTags.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filter by tags:</span>
              {(searchTerm || selectedTags.length > 0) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-6 px-2 text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {allTags.slice(0, 20).map((tag) => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/10 transition-colors"
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </Badge>
              ))}
              {allTags.length > 20 && (
                <Badge variant="outline" className="text-muted-foreground">
                  +{allTags.length - 20} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Active Filters Display */}
        {(searchTerm || selectedTags.length > 0) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Active filters:</span>
            {searchTerm && (
              <Badge variant="secondary">
                Search: "{searchTerm}"
              </Badge>
            )}
            {selectedTags.map((tag) => (
              <Badge key={tag} variant="secondary">
                Tag: {tag}
                <X 
                  className="h-3 w-3 ml-1 cursor-pointer hover:text-foreground" 
                  onClick={() => toggleTag(tag)}
                />
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Templates Grid */}
      <div className="space-y-4">
        {templates.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-muted-foreground">
              {eose ? (
                searchTerm || selectedTags.length > 0 ? (
                  <div className="space-y-2">
                    <p>No templates found matching your filters.</p>
                    <Button variant="outline" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  </div>
                ) : (
                  <p>No templates available yet.</p>
                )
              ) : (
                <p>Searching for templates...</p>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Results count */}
            <div className="text-sm text-muted-foreground">
              {templates.length} template{templates.length !== 1 ? 's' : ''} found
            </div>

            {/* Templates grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onClick={handleTemplateSelect}
                  isSelected={selectedTemplate?.id === template.id}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
/**
 * Section Selector
 * Step 3: Select and arrange document sections with drag-and-drop
 */

import React, { useState, useMemo } from 'react';
import {
  useDocumentBuilderStore,
  useDocument,
  useSectionLibrary,
  useSections,
} from '@/stores/document-builder-store';
import { SectionCategory, DocumentSection, SectionDefinition } from '@shared/document-builder/types';
import {
  GripVertical,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  Sparkles,
  Image,
  Database,
  Layers,
  FileText,
  BarChart3,
  Map,
  Shield,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// =============================================================================
// Category Configuration
// =============================================================================

const CATEGORY_CONFIG: Record<SectionCategory, { label: string; icon: React.ElementType; color: string }> = {
  cover: { label: 'Cover & Intro', icon: BookOpen, color: 'bg-purple-500' },
  summary: { label: 'Summary', icon: FileText, color: 'bg-blue-500' },
  property: { label: 'Property', icon: Layers, color: 'bg-green-500' },
  market: { label: 'Market', icon: Map, color: 'bg-orange-500' },
  financial: { label: 'Financial', icon: BarChart3, color: 'bg-emerald-500' },
  underwriting: { label: 'Underwriting', icon: Database, color: 'bg-cyan-500' },
  due_diligence: { label: 'Due Diligence', icon: Shield, color: 'bg-red-500' },
};

// =============================================================================
// Sortable Section Item
// =============================================================================

interface SortableSectionItemProps {
  section: DocumentSection;
  definition: SectionDefinition | null;
  isSelected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onRemove: () => void;
}

const SortableSectionItem: React.FC<SortableSectionItemProps> = ({
  section,
  definition,
  isSelected,
  onSelect,
  onToggle,
  onRemove,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const completionPercent = section.completionStatus?.percentage || 0;
  const isComplete = section.completionStatus?.complete;
  const hasWarnings = (section.completionStatus?.warnings?.length || 0) > 0;

  const categoryConfig = definition
    ? CATEGORY_CONFIG[definition.category]
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border bg-background transition-all',
        isDragging && 'opacity-50 shadow-lg',
        isSelected && 'ring-2 ring-primary',
        !section.enabled && 'opacity-60'
      )}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Category Indicator */}
      {categoryConfig && (
        <div
          className={cn(
            'w-8 h-8 rounded flex items-center justify-center text-white',
            categoryConfig.color
          )}
        >
          <categoryConfig.icon className="w-4 h-4" />
        </div>
      )}

      {/* Section Info */}
      <button
        onClick={onSelect}
        className="flex-1 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">
            {section.customTitle || definition?.name || section.sectionKey}
          </span>
          {definition?.marinaSpecific && (
            <Badge variant="outline" className="text-xs">
              Marina
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all',
                isComplete ? 'bg-green-500' : 'bg-primary'
              )}
              style={{ width: `${completionPercent}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {completionPercent}%
          </span>
          {isComplete && <CheckCircle className="w-3 h-3 text-green-500" />}
          {hasWarnings && <AlertCircle className="w-3 h-3 text-yellow-500" />}
        </div>
      </button>

      {/* Requirements Indicators */}
      <div className="flex items-center gap-1.5">
        {definition?.requiredDataBindings?.length ? (
          <div
            className={cn(
              'w-6 h-6 rounded flex items-center justify-center',
              section.completionStatus?.missingRequiredBindings?.length === 0
                ? 'bg-green-100 text-green-600'
                : 'bg-muted text-muted-foreground'
            )}
            title="Data bindings"
          >
            <Database className="w-3 h-3" />
          </div>
        ) : null}
        {definition?.requiredMedia?.length ? (
          <div
            className={cn(
              'w-6 h-6 rounded flex items-center justify-center',
              section.completionStatus?.missingRequiredMedia?.length === 0
                ? 'bg-green-100 text-green-600'
                : 'bg-muted text-muted-foreground'
            )}
            title="Media required"
          >
            <Image className="w-3 h-3" />
          </div>
        ) : null}
        {definition?.aiPromptTemplates?.length ? (
          <div
            className="w-6 h-6 rounded flex items-center justify-center bg-purple-100 text-purple-600"
            title="AI generation available"
          >
            <Sparkles className="w-3 h-3" />
          </div>
        ) : null}
      </div>

      {/* Enable/Disable Toggle */}
      <Switch
        checked={section.enabled}
        onCheckedChange={onToggle}
        aria-label="Enable section"
      />

      {/* Remove Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
};

// =============================================================================
// Available Section Card
// =============================================================================

interface AvailableSectionCardProps {
  sectionKey: string;
  definition: SectionDefinition;
  onAdd: () => void;
  alreadyAdded: boolean;
}

const AvailableSectionCard: React.FC<AvailableSectionCardProps> = ({
  sectionKey,
  definition,
  onAdd,
  alreadyAdded,
}) => {
  const categoryConfig = CATEGORY_CONFIG[definition.category];

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border transition-all',
        alreadyAdded
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:border-primary/50 cursor-pointer'
      )}
      onClick={() => !alreadyAdded && onAdd()}
    >
      <div
        className={cn(
          'w-8 h-8 rounded flex items-center justify-center text-white',
          categoryConfig?.color || 'bg-gray-500'
        )}
      >
        {categoryConfig && <categoryConfig.icon className="w-4 h-4" />}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{definition.name}</span>
          {definition.marinaSpecific && (
            <Badge variant="outline" className="text-xs">
              Marina
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-1">
          {definition.description}
        </p>
      </div>
      {!alreadyAdded && (
        <Plus className="w-4 h-4 text-muted-foreground" />
      )}
      {alreadyAdded && (
        <CheckCircle className="w-4 h-4 text-green-500" />
      )}
    </div>
  );
};

// =============================================================================
// Section Selector
// =============================================================================

export const SectionSelector: React.FC = () => {
  const store = useDocumentBuilderStore();
  const document = useDocument();
  const sectionLibrary = useSectionLibrary();
  const sections = useSections();

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['summary', 'property', 'financial'])
  );
  const [showAvailable, setShowAvailable] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Get sections sorted by order
  const sortedSections = useMemo(() => {
    return [...sections].sort((a, b) => a.order - b.order);
  }, [sections]);

  // Get available sections grouped by category
  const availableSectionsByCategory = useMemo(() => {
    const grouped: Record<string, { key: string; def: SectionDefinition }[]> = {};
    
    Object.entries(sectionLibrary).forEach(([key, def]) => {
      // Filter by document type
      if (document && !def.supportedDocTypes.includes(document.documentType)) {
        return;
      }
      
      const cat = def.category;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push({ key, def });
    });
    
    return grouped;
  }, [sectionLibrary, document?.documentType]);

  // Track which sections are already added
  const addedSectionKeys = useMemo(() => {
    return new Set(sections.map((s) => s.sectionKey));
  }, [sections]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = sortedSections.findIndex((s) => s.id === active.id);
      const newIndex = sortedSections.findIndex((s) => s.id === over.id);
      
      const newSections = arrayMove(sortedSections, oldIndex, newIndex);
      
      // Update orders
      const sectionOrders = newSections.map((s, idx) => ({
        sectionId: String(s.id),
        order: idx,
      }));

      // Optimistic update
      newSections.forEach((s, idx) => {
        store.updateSectionOrder(s.id, idx);
      });

      // Persist to server
      try {
        await fetch(
          `/api/document-builder/documents/${document?.id}/sections/reorder`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sectionOrders }),
          }
        );
      } catch (err) {
        console.error('Failed to reorder sections:', err);
      }
    }
  };

  const handleAddSection = async (sectionKey: string) => {
    if (!document) return;

    store.addSection(sectionKey);

    // Persist to server
    try {
      const response = await fetch(
        `/api/document-builder/documents/${document.id}/sections`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sectionKey }),
        }
      );
      
      const result = await response.json();
      if (!result.success) {
        console.error('Failed to add section:', result.error);
      }
    } catch (err) {
      console.error('Failed to add section:', err);
    }
  };

  const handleToggleSection = async (sectionId: number) => {
    if (!document) return;

    store.toggleSectionEnabled(sectionId);

    // Persist to server
    const section = sections.find((s) => s.id === sectionId);
    try {
      await fetch(
        `/api/document-builder/documents/${document.id}/sections/${sectionId}/toggle`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: !section?.enabled }),
        }
      );
    } catch (err) {
      console.error('Failed to toggle section:', err);
    }
  };

  const handleRemoveSection = async (sectionId: number) => {
    if (!document) return;

    store.removeSection(sectionId);

    // Persist to server
    try {
      await fetch(
        `/api/document-builder/documents/${document.id}/sections/${sectionId}`,
        {
          method: 'DELETE',
        }
      );
    } catch (err) {
      console.error('Failed to remove section:', err);
    }
  };

  const toggleCategory = (category: string) => {
    const next = new Set(expandedCategories);
    if (next.has(category)) {
      next.delete(category);
    } else {
      next.add(category);
    }
    setExpandedCategories(next);
  };

  if (!document) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Please create a document first
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {/* Selected Sections */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Document Sections
            <Badge variant="secondary">{sections.length}</Badge>
          </h3>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedSections.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {sortedSections.map((section) => (
                <SortableSectionItem
                  key={section.id}
                  section={section}
                  definition={sectionLibrary[section.sectionKey] || null}
                  isSelected={store.selectedSectionId === section.id}
                  onSelect={() => store.selectSection(section.id)}
                  onToggle={() => handleToggleSection(section.id)}
                  onRemove={() => handleRemoveSection(section.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {sections.length === 0 && (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            No sections added yet. Add sections from the library →
          </div>
        )}
      </div>

      {/* Available Sections */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Available Sections
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAvailable(!showAvailable)}
          >
            {showAvailable ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
        </div>

        {showAvailable && (
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
            {Object.entries(CATEGORY_CONFIG).map(([category, config]) => {
              const categorySections = availableSectionsByCategory[category] || [];
              if (categorySections.length === 0) return null;

              const isExpanded = expandedCategories.has(category);

              return (
                <div key={category} className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center gap-2 p-3 bg-muted/50 hover:bg-muted transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <div
                      className={cn(
                        'w-6 h-6 rounded flex items-center justify-center text-white',
                        config.color
                      )}
                    >
                      <config.icon className="w-3 h-3" />
                    </div>
                    <span className="font-medium text-sm">{config.label}</span>
                    <Badge variant="secondary" className="ml-auto">
                      {categorySections.length}
                    </Badge>
                  </button>

                  {isExpanded && (
                    <div className="p-2 space-y-2">
                      {categorySections.map(({ key, def }) => (
                        <AvailableSectionCard
                          key={key}
                          sectionKey={key}
                          definition={def}
                          onAdd={() => handleAddSection(key)}
                          alreadyAdded={addedSectionKeys.has(key)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SectionSelector;

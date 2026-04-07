import { useState, useRef, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Link2,
  Image,
  GripVertical,
  Plus,
  Trash2,
  Eye,
  Edit3,
  ChevronUp,
  ChevronDown,
  Columns,
  AlignLeft,
  SidebarIcon,
  Maximize2,
} from 'lucide-react';

interface Section {
  id: string;
  title: string;
  content: string;
  layout: 'full-width' | 'two-column' | 'sidebar';
  imageUrl: string | null;
  order: number;
}

interface SectionEditorProps {
  sections: Section[];
  onSectionsChange: (sections: Section[]) => void;
}

const LAYOUT_OPTIONS = [
  { value: 'full-width', label: 'Full Width', icon: Maximize2 },
  { value: 'two-column', label: 'Two Column', icon: Columns },
  { value: 'sidebar', label: 'Sidebar', icon: SidebarIcon },
] as const;

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  active = false,
}: {
  icon: typeof Bold;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <Button
      variant={active ? 'secondary' : 'ghost'}
      size="sm"
      className="h-8 w-8 p-0"
      onClick={onClick}
      title={label}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}

function RichTextToolbar({ editorRef }: { editorRef: React.RefObject<HTMLDivElement | null> }) {
  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const insertLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      execCommand('createLink', url);
    }
  };

  return (
    <div className="flex items-center gap-0.5 p-1 border-b bg-muted/30">
      <ToolbarButton icon={Bold} label="Bold" onClick={() => execCommand('bold')} />
      <ToolbarButton icon={Italic} label="Italic" onClick={() => execCommand('italic')} />
      <Separator orientation="vertical" className="h-6 mx-1" />
      <ToolbarButton icon={Heading1} label="Heading 1" onClick={() => execCommand('formatBlock', 'h2')} />
      <ToolbarButton icon={Heading2} label="Heading 2" onClick={() => execCommand('formatBlock', 'h3')} />
      <Separator orientation="vertical" className="h-6 mx-1" />
      <ToolbarButton icon={List} label="Bullet List" onClick={() => execCommand('insertUnorderedList')} />
      <ToolbarButton icon={ListOrdered} label="Numbered List" onClick={() => execCommand('insertOrderedList')} />
      <Separator orientation="vertical" className="h-6 mx-1" />
      <ToolbarButton icon={Link2} label="Insert Link" onClick={insertLink} />
      <ToolbarButton icon={AlignLeft} label="Normal" onClick={() => execCommand('formatBlock', 'p')} />
    </div>
  );
}

function SectionBlock({
  section,
  index,
  totalSections,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isPreview,
}: {
  section: Section;
  index: number;
  totalSections: number;
  onUpdate: (updates: Partial<Section>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isPreview: boolean;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [editingTitle, setEditingTitle] = useState(false);

  const handleContentChange = useCallback(() => {
    if (editorRef.current) {
      onUpdate({ content: editorRef.current.innerHTML });
    }
  }, [onUpdate]);

  if (isPreview) {
    return (
      <div className={`mb-6 ${section.layout === 'two-column' ? 'grid grid-cols-2 gap-6' : section.layout === 'sidebar' ? 'grid grid-cols-3 gap-6' : ''}`}>
        <div className={section.layout === 'sidebar' ? 'col-span-2' : ''}>
          <h3 className="text-xl font-bold mb-3">{section.title}</h3>
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(section.content) }}
          />
        </div>
        {section.layout !== 'full-width' && (
          <div className="bg-muted/50 rounded-lg p-4 flex items-center justify-center min-h-[200px]">
            {section.imageUrl ? (
              <img src={section.imageUrl} alt="" className="max-w-full rounded" />
            ) : (
              <div className="text-center text-muted-foreground">
                <Image className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Image placeholder</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="group">
      <CardHeader className="pb-2 flex flex-row items-center gap-2">
        <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />

        <div className="flex-1">
          {editingTitle ? (
            <Input
              value={section.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingTitle(false)}
              className="font-semibold"
              autoFocus
            />
          ) : (
            <div
              className="font-semibold cursor-pointer hover:text-primary transition-colors"
              onClick={() => setEditingTitle(true)}
            >
              {section.title || 'Untitled Section'}
              <Edit3 className="h-3 w-3 inline ml-2 opacity-50" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Select
            value={section.layout}
            onValueChange={(v: Section['layout']) => onUpdate({ layout: v })}
          >
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LAYOUT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <span className="flex items-center gap-2">
                    <opt.icon className="h-3 w-3" />
                    {opt.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="ghost" size="sm" onClick={onMoveUp} disabled={index === 0} className="h-8 w-8 p-0">
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onMoveDown} disabled={index === totalSections - 1} className="h-8 w-8 p-0">
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="h-8 w-8 p-0 text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className={`${section.layout === 'two-column' ? 'grid grid-cols-2 gap-4' : section.layout === 'sidebar' ? 'grid grid-cols-3 gap-4' : ''}`}>
          <div className={`border rounded-lg overflow-hidden ${section.layout === 'sidebar' ? 'col-span-2' : ''}`}>
            <RichTextToolbar editorRef={editorRef} />
            <div
              ref={editorRef}
              contentEditable
              className="min-h-[150px] p-4 prose prose-sm max-w-none dark:prose-invert focus:outline-none"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(section.content) }}
              onInput={handleContentChange}
              suppressContentEditableWarning
            />
          </div>

          {section.layout !== 'full-width' && (
            <div
              className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center min-h-[150px] cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => {
                // Placeholder for image upload
                const url = prompt('Enter image URL (placeholder for upload):');
                if (url) onUpdate({ imageUrl: url });
              }}
            >
              <Image className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Click to add image</p>
              {section.imageUrl && (
                <Badge variant="secondary" className="mt-2 text-xs">Image set</Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SectionEditor({ sections: initialSections, onSectionsChange }: SectionEditorProps) {
  const [sections, setSections] = useState<Section[]>(
    initialSections.length > 0
      ? initialSections
      : [
          { id: '1', title: 'Executive Summary', content: '<p>Enter your executive summary here...</p>', layout: 'full-width', imageUrl: null, order: 0 },
          { id: '2', title: 'Property Overview', content: '<p>Describe the property details...</p>', layout: 'two-column', imageUrl: null, order: 1 },
          { id: '3', title: 'Financial Analysis', content: '<p>Key financial metrics and projections...</p>', layout: 'full-width', imageUrl: null, order: 2 },
        ]
  );
  const [isPreview, setIsPreview] = useState(false);

  const updateSections = useCallback((newSections: Section[]) => {
    setSections(newSections);
    onSectionsChange(newSections);
  }, [onSectionsChange]);

  const updateSection = (id: string, updates: Partial<Section>) => {
    updateSections(sections.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const deleteSection = (id: string) => {
    updateSections(sections.filter((s) => s.id !== id));
  };

  const moveSection = (fromIndex: number, direction: -1 | 1) => {
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= sections.length) return;
    const newSections = [...sections];
    [newSections[fromIndex], newSections[toIndex]] = [newSections[toIndex], newSections[fromIndex]];
    updateSections(newSections.map((s, i) => ({ ...s, order: i })));
  };

  const addSection = () => {
    const newSection: Section = {
      id: `section-${Date.now()}`,
      title: 'New Section',
      content: '<p>Enter content here...</p>',
      layout: 'full-width',
      imageUrl: null,
      order: sections.length,
    };
    updateSections([...sections, newSection]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {sections.length} section{sections.length !== 1 ? 's' : ''}
        </div>
        <div className="flex gap-2">
          <Button
            variant={isPreview ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsPreview(!isPreview)}
          >
            {isPreview ? <Edit3 className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {isPreview ? 'Edit' : 'Preview'}
          </Button>
          {!isPreview && (
            <Button size="sm" onClick={addSection}>
              <Plus className="h-4 w-4 mr-2" />
              Add Section
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {sections.map((section, index) => (
          <SectionBlock
            key={section.id}
            section={section}
            index={index}
            totalSections={sections.length}
            onUpdate={(updates) => updateSection(section.id, updates)}
            onDelete={() => deleteSection(section.id)}
            onMoveUp={() => moveSection(index, -1)}
            onMoveDown={() => moveSection(index, 1)}
            isPreview={isPreview}
          />
        ))}
      </div>

      {!isPreview && sections.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Edit3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">No sections yet</h3>
            <p className="text-muted-foreground mb-4">
              Add sections to build your offering memorandum
            </p>
            <Button onClick={addSection}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Section
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

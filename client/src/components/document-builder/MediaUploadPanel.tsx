/**
 * Media Upload Panel
 * Step 5: Add images, maps, and charts to document sections
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  useDocumentBuilderStore,
  useDocument,
  useSectionLibrary,
  useSections,
} from '@/stores/document-builder-store';
import { MediaRequirement, SectionDefinition } from '@shared/document-builder/types';
import {
  Image,
  Upload,
  X,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Map,
  BarChart2,
  FileImage,
  Trash2,
  ExternalLink,
  Loader2,
  ImagePlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

// =============================================================================
// Media Type Icons
// =============================================================================

const MEDIA_TYPE_ICONS: Record<string, React.ElementType> = {
  hero_image: Image,
  aerial_photo: Map,
  property_photo: FileImage,
  map: Map,
  chart: BarChart2,
  logo: Image,
  default: FileImage,
};

// =============================================================================
// Media Upload Dropzone
// =============================================================================

interface MediaDropzoneProps {
  mediaKey: string;
  requirement: MediaRequirement;
  currentMedia?: {
    assetId?: string;
    url?: string;
    alt?: string;
    caption?: string;
  };
  onUpload: (file: File) => Promise<void>;
  onRemove: () => void;
  onUpdateMeta: (meta: { alt?: string; caption?: string }) => void;
}

const MediaDropzone: React.FC<MediaDropzoneProps> = ({
  mediaKey,
  requirement,
  currentMedia,
  onUpload,
  onRemove,
  onUpdateMeta,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showMetaDialog, setShowMetaDialog] = useState(false);

  const Icon = MEDIA_TYPE_ICONS[mediaKey] || MEDIA_TYPE_ICONS.default;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        setIsUploading(true);
        try {
          await onUpload(file);
        } finally {
          setIsUploading(false);
        }
      }
    },
    [onUpload]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setIsUploading(true);
        try {
          await onUpload(file);
        } finally {
          setIsUploading(false);
        }
      }
    },
    [onUpload]
  );

  const hasMedia = !!currentMedia?.url || !!currentMedia?.assetId;

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 bg-muted/30">
        <Icon className="w-5 h-5 text-muted-foreground" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">
              {requirement.label || mediaKey}
            </span>
            {requirement.required && (
              <Badge variant="outline" className="text-xs">
                Required
              </Badge>
            )}
          </div>
          {requirement.dimensions && (
            <span className="text-xs text-muted-foreground">
              {requirement.dimensions.width} × {requirement.dimensions.height}px
            </span>
          )}
        </div>
        {hasMedia && (
          <CheckCircle className="w-4 h-4 text-green-500" />
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        {hasMedia ? (
          <div className="space-y-3">
            {/* Preview */}
            <div className="relative group">
              <img
                src={currentMedia.url || `/api/assets/${currentMedia.assetId}`}
                alt={currentMedia.alt || 'Uploaded media'}
                className="w-full h-40 object-cover rounded-md"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-md">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowMetaDialog(true)}
                >
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onRemove}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Caption display */}
            {currentMedia.caption && (
              <p className="text-xs text-muted-foreground italic">
                {currentMedia.caption}
              </p>
            )}
          </div>
        ) : (
          <div
            className={cn(
              'relative border-2 border-dashed rounded-md p-6 transition-colors',
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-muted hover:border-muted-foreground/50'
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isUploading}
            />
            <div className="flex flex-col items-center gap-2 text-center">
              {isUploading ? (
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              ) : (
                <ImagePlus className="w-8 h-8 text-muted-foreground" />
              )}
              <div className="text-sm">
                <span className="font-medium">Click to upload</span>
                <span className="text-muted-foreground"> or drag and drop</span>
              </div>
              <span className="text-xs text-muted-foreground">
                PNG, JPG, WEBP up to 10MB
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Meta Dialog */}
      <Dialog open={showMetaDialog} onOpenChange={setShowMetaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Media Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="alt">Alt Text</Label>
              <Input
                id="alt"
                value={currentMedia?.alt || ''}
                onChange={(e) =>
                  onUpdateMeta({ ...currentMedia, alt: e.target.value })
                }
                placeholder="Describe the image"
              />
            </div>
            <div>
              <Label htmlFor="caption">Caption</Label>
              <Textarea
                id="caption"
                value={currentMedia?.caption || ''}
                onChange={(e) =>
                  onUpdateMeta({ ...currentMedia, caption: e.target.value })
                }
                placeholder="Optional caption for the image"
                rows={2}
              />
            </div>
            <Button onClick={() => setShowMetaDialog(false)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// =============================================================================
// Section Media Card
// =============================================================================

interface SectionMediaCardProps {
  section: {
    id: number;
    sectionKey: string;
    customTitle: string | null;
    media: Record<string, any>;
    completionStatus: any;
  };
  definition: SectionDefinition | null;
  onMediaChange: (
    sectionId: number,
    mediaKey: string,
    media: any | null
  ) => void;
}

const SectionMediaCard: React.FC<SectionMediaCardProps> = ({
  section,
  definition,
  onMediaChange,
}) => {
  const [isOpen, setIsOpen] = useState(true);

  const requiredMedia = definition?.requiredMedia || [];
  const optionalMedia = definition?.optionalMedia || [];
  const allMedia = [...requiredMedia, ...optionalMedia];

  const missingRequired = section.completionStatus?.missingRequiredMedia || [];
  const uploadedCount = Object.keys(section.media).length;
  const requiredCount = requiredMedia.length;
  const isComplete = missingRequired.length === 0;

  const handleUpload = async (
    mediaKey: string,
    file: File
  ): Promise<void> => {
    // TODO: Implement actual upload to asset storage
    // For now, create a local URL
    const url = URL.createObjectURL(file);
    onMediaChange(section.id, mediaKey, {
      url,
      alt: file.name,
    });
  };

  const handleRemove = (mediaKey: string) => {
    onMediaChange(section.id, mediaKey, null);
  };

  const handleUpdateMeta = (mediaKey: string, meta: { alt?: string; caption?: string }) => {
    const current = section.media[mediaKey];
    onMediaChange(section.id, mediaKey, { ...current, ...meta });
  };

  if (!definition || allMedia.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg overflow-hidden">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center gap-3 p-3 bg-muted/30 hover:bg-muted/50 transition-colors">
            {isOpen ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <span className="font-medium flex-1 text-left">
              {section.customTitle || definition.name}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {uploadedCount} / {allMedia.length} media
              </span>
              {isComplete ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : requiredCount > 0 ? (
                <AlertCircle className="w-4 h-4 text-yellow-500" />
              ) : null}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-3 grid grid-cols-2 gap-3 border-t">
            {allMedia.map((req) => (
              <MediaDropzone
                key={req.key}
                mediaKey={req.key}
                requirement={req}
                currentMedia={section.media[req.key]}
                onUpload={(file) => handleUpload(req.key, file)}
                onRemove={() => handleRemove(req.key)}
                onUpdateMeta={(meta) => handleUpdateMeta(req.key, meta)}
              />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

// =============================================================================
// Media Upload Panel
// =============================================================================

export const MediaUploadPanel: React.FC = () => {
  const store = useDocumentBuilderStore();
  const document = useDocument();
  const sectionLibrary = useSectionLibrary();
  const sections = useSections();

  // Filter enabled sections with media requirements
  const sectionsWithMedia = useMemo(() => {
    return sections
      .filter((s) => s.enabled)
      .filter((s) => {
        const def = sectionLibrary[s.sectionKey];
        return def?.requiredMedia?.length || def?.optionalMedia?.length;
      });
  }, [sections, sectionLibrary]);

  // Calculate overall media completion
  const mediaStats = useMemo(() => {
    let totalRequired = 0;
    let totalUploaded = 0;

    sectionsWithMedia.forEach((section) => {
      const def = sectionLibrary[section.sectionKey];
      if (def?.requiredMedia) {
        totalRequired += def.requiredMedia.length;
        def.requiredMedia.forEach((m) => {
          if (section.media[m.key]) {
            totalUploaded++;
          }
        });
      }
    });

    return {
      totalRequired,
      totalUploaded,
      percentage:
        totalRequired > 0
          ? Math.round((totalUploaded / totalRequired) * 100)
          : 100,
    };
  }, [sectionsWithMedia, sectionLibrary]);

  const handleMediaChange = async (
    sectionId: number,
    mediaKey: string,
    media: any | null
  ) => {
    if (!document) return;

    // Update local state
    const section = sections.find((s) => s.id === sectionId);
    if (section) {
      const newMedia = media
        ? { ...section.media, [mediaKey]: media }
        : Object.fromEntries(
            Object.entries(section.media).filter(([k]) => k !== mediaKey)
          );

      store.setDocument({
        ...document,
        sections: document.sections.map((s) =>
          s.id === sectionId ? { ...s, media: newMedia } : s
        ),
      });

      // Persist to server
      try {
        await fetch(
          `/api/document-builder/documents/${document.id}/sections/${sectionId}/media`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ media: newMedia }),
          }
        );
      } catch (err) {
        console.error('Failed to update media:', err);
      }
    }
  };

  if (!document) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Please create a document first
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-medium">Media & Images</h3>
            <p className="text-sm text-muted-foreground">
              Add photos, maps, and charts to your document
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all',
                  mediaStats.percentage === 100
                    ? 'bg-green-500'
                    : 'bg-primary'
                )}
                style={{ width: `${mediaStats.percentage}%` }}
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {mediaStats.totalUploaded} / {mediaStats.totalRequired} required
            </span>
          </div>
        </div>
      </div>

      {/* Section Media */}
      <div className="space-y-3">
        {sectionsWithMedia.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            No sections require media. Add sections with image requirements.
          </div>
        ) : (
          sectionsWithMedia.map((section) => (
            <SectionMediaCard
              key={section.id}
              section={section}
              definition={sectionLibrary[section.sectionKey] || null}
              onMediaChange={handleMediaChange}
            />
          ))
        )}
      </div>

      {/* Tips */}
      <div className="p-4 bg-muted/30 rounded-lg">
        <h4 className="font-medium text-sm mb-2">Media Tips</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Use high-resolution images (at least 1920×1080) for best quality</li>
          <li>• Aerial photos should clearly show property boundaries</li>
          <li>• Include alt text for accessibility and SEO</li>
          <li>• Maps should be labeled with key points of interest</li>
        </ul>
      </div>
    </div>
  );
};

export default MediaUploadPanel;

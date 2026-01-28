/**
 * Document Configurator
 * Step 2: Configure document title, audience, theme, and branding
 */

import React, { useState, useEffect } from 'react';
import {
  useDocumentBuilderStore,
  useDocument,
} from '@/stores/document-builder-store';
import {
  AudiencePersona,
  AssetClass,
} from '@shared/document-builder/types';
import {
  Users,
  Building2,
  Palette,
  Type,
  Save,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// =============================================================================
// Constants
// =============================================================================

const AUDIENCE_OPTIONS: { value: AudiencePersona; label: string; description: string }[] = [
  {
    value: 'institutional_investor',
    label: 'Institutional Investor',
    description: 'Family offices, PE firms, hedge funds',
  },
  {
    value: 'lender',
    label: 'Lender',
    description: 'Banks, credit unions, debt funds',
  },
  {
    value: 'broker',
    label: 'Broker',
    description: 'Real estate brokers and agents',
  },
  {
    value: 'owner_operator',
    label: 'Owner/Operator',
    description: 'Marina operators and owners',
  },
  {
    value: 'management_company',
    label: 'Management Company',
    description: 'Property management firms',
  },
  {
    value: 'internal_team',
    label: 'Internal Team',
    description: 'IC memos and internal review',
  },
];

const ASSET_CLASS_OPTIONS: { value: AssetClass; label: string }[] = [
  { value: 'marina', label: 'Marina' },
  { value: 'rv_park', label: 'RV Park' },
  { value: 'mobile_home_park', label: 'Mobile Home Park' },
  { value: 'self_storage', label: 'Self Storage' },
  { value: 'multifamily', label: 'Multifamily' },
  { value: 'mixed_use', label: 'Mixed Use' },
  { value: 'other', label: 'Other' },
];

// =============================================================================
// Document Configurator
// =============================================================================

export const DocumentConfigurator: React.FC = () => {
  const store = useDocumentBuilderStore();
  const document = useDocument();

  const [title, setTitle] = useState(document?.title || '');
  const [audience, setAudience] = useState<AudiencePersona | ''>(
    document?.audience || ''
  );
  const [assetClass, setAssetClass] = useState<AssetClass | ''>(
    document?.assetClass || 'marina'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Track changes
  useEffect(() => {
    if (document) {
      const changed =
        title !== document.title ||
        audience !== (document.audience || '') ||
        assetClass !== (document.assetClass || 'marina');
      setHasChanges(changed);
    }
  }, [title, audience, assetClass, document]);

  // Sync with document
  useEffect(() => {
    if (document) {
      setTitle(document.title);
      setAudience(document.audience || '');
      setAssetClass(document.assetClass || 'marina');
    }
  }, [document?.id]);

  const handleSave = async () => {
    if (!document) return;

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/document-builder/documents/${document.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            audience: audience || null,
            assetClass: assetClass || null,
          }),
        }
      );

      const result = await response.json();
      if (result.success) {
        store.setDocument({ ...document, ...result.data });
        setHasChanges(false);
      } else {
        store.setError(result.error);
      }
    } catch (err) {
      store.setError('Failed to save changes');
    } finally {
      setIsSaving(false);
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
    <div className="max-w-2xl space-y-8">
      {/* Document Title */}
      <div className="space-y-2">
        <Label htmlFor="title" className="flex items-center gap-2">
          <Type className="w-4 h-4" />
          Document Title
        </Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter document title"
          className="text-lg"
        />
        <p className="text-sm text-muted-foreground">
          This will appear on the cover page and in exports
        </p>
      </div>

      {/* Target Audience */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          Target Audience
        </Label>
        <div className="grid grid-cols-2 gap-3">
          {AUDIENCE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setAudience(option.value)}
              className={cn(
                'p-3 rounded-lg border text-left transition-all',
                'hover:border-primary/50',
                audience === option.value
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                  : 'border-muted'
              )}
            >
              <div className="font-medium text-sm">{option.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {option.description}
              </div>
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          This helps tailor content and tone for your audience
        </p>
      </div>

      {/* Asset Class */}
      <div className="space-y-2">
        <Label htmlFor="assetClass" className="flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          Asset Class
        </Label>
        <Select
          value={assetClass}
          onValueChange={(value) => setAssetClass(value as AssetClass)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select asset class" />
          </SelectTrigger>
          <SelectContent>
            {ASSET_CLASS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Enables asset-specific sections and terminology
        </p>
      </div>

      {/* Theme Selection (placeholder for now) */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Palette className="w-4 h-4" />
          Theme
        </Label>
        <div className="p-4 rounded-lg border border-dashed bg-muted/30">
          <p className="text-sm text-muted-foreground">
            Theme customization coming soon. Documents will use the default
            institutional theme.
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="text-sm text-muted-foreground">
          {hasChanges
            ? 'You have unsaved changes'
            : 'All changes saved'}
        </div>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
        >
          {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          <Save className="w-4 h-4 mr-2" />
          Save Changes
        </Button>
      </div>
    </div>
  );
};

export default DocumentConfigurator;

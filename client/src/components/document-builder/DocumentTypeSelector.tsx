/**
 * Document Type Selector
 * Step 1: Select the type of document to create
 */

import React from 'react';
import { useDocumentBuilderStore } from '@/stores/document-builder-store';
import { DocumentType, DOCUMENT_TYPE_CONFIGS } from '@shared/document-builder/types';
import {
  FileText,
  Presentation,
  BookOpen,
  FileSpreadsheet,
  Briefcase,
  Building,
  Target,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

interface DocumentTypeCardProps {
  type: DocumentType;
  config: (typeof DOCUMENT_TYPE_CONFIGS)[DocumentType];
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

// =============================================================================
// Icon Mapping
// =============================================================================

const TYPE_ICONS: Record<DocumentType, React.ElementType> = {
  offering_memorandum: BookOpen,
  executive_summary: FileText,
  pitch_deck: Presentation,
  ic_memo: Briefcase,
  teaser: Target,
  lender_package: Building,
  due_diligence_summary: FileSpreadsheet,
  custom: FileText,
};

// =============================================================================
// Document Type Card
// =============================================================================

const DocumentTypeCard: React.FC<DocumentTypeCardProps> = ({
  type,
  config,
  selected,
  onSelect,
  disabled,
}) => {
  const Icon = TYPE_ICONS[type] || FileText;

  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'relative flex flex-col items-start p-5 rounded-lg border-2 transition-all text-left',
        'hover:border-primary/50 hover:bg-muted/50',
        selected
          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
          : 'border-muted',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <div
        className={cn(
          'w-12 h-12 rounded-lg flex items-center justify-center mb-3',
          selected ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="font-semibold text-base mb-1">{config.label}</h3>
      <p className="text-sm text-muted-foreground line-clamp-2">
        {config.description}
      </p>
      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
        <span>{config.defaultSections?.length || 0} sections</span>
        <span>•</span>
        <span>{config.estimatedPages} pages</span>
      </div>
      {selected && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
          <svg
            className="w-3 h-3 text-primary-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      )}
    </button>
  );
};

// =============================================================================
// Document Type Selector
// =============================================================================

interface DocumentTypeSelectorProps {
  dealId: string;
}

export const DocumentTypeSelector: React.FC<DocumentTypeSelectorProps> = ({
  dealId,
}) => {
  const store = useDocumentBuilderStore();
  const document = store.document;
  const documentTypeConfigs = store.documentTypeConfigs;

  const [selectedType, setSelectedType] = React.useState<DocumentType | null>(
    document?.documentType || null
  );
  const [isCreating, setIsCreating] = React.useState(false);

  // Use local config if store is empty
  const configs = Object.keys(documentTypeConfigs).length > 0
    ? documentTypeConfigs
    : DOCUMENT_TYPE_CONFIGS;

  const handleSelect = (type: DocumentType) => {
    setSelectedType(type);
  };

  const handleCreate = async () => {
    if (!selectedType) return;

    setIsCreating(true);
    try {
      const config = configs[selectedType];
      const response = await fetch('/api/document-builder/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId,
          documentType: selectedType,
          title: `New ${config.label}`,
        }),
      });

      const result = await response.json();
      if (result.success) {
        store.setDocument(result.data);
        store.nextStep();
      } else {
        store.setError(result.error || 'Failed to create document');
      }
    } catch (err) {
      store.setError('Failed to create document');
    } finally {
      setIsCreating(false);
    }
  };

  // Primary document types (most commonly used)
  const primaryTypes: DocumentType[] = [
    'offering_memorandum',
    'ic_memo',
    'pitch_deck',
    'executive_summary',
  ];

  // Secondary document types
  const secondaryTypes: DocumentType[] = [
    'teaser',
    'lender_package',
    'due_diligence_summary',
  ];

  return (
    <div className="space-y-8">
      {/* Primary Types */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-4">
          Common Document Types
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {primaryTypes.map((type) => (
            <DocumentTypeCard
              key={type}
              type={type}
              config={configs[type]}
              selected={selectedType === type}
              onSelect={() => handleSelect(type)}
            />
          ))}
        </div>
      </div>

      {/* Secondary Types */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-4">
          Additional Types
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {secondaryTypes.map((type) => (
            <DocumentTypeCard
              key={type}
              type={type}
              config={configs[type]}
              selected={selectedType === type}
              onSelect={() => handleSelect(type)}
            />
          ))}
        </div>
      </div>

      {/* Selected Type Details */}
      {selectedType && (
        <div className="p-4 rounded-lg border bg-muted/30">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium">{configs[selectedType].label}</h4>
              <p className="text-sm text-muted-foreground mt-1">
                {configs[selectedType].description}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {configs[selectedType].exportFormats?.map((format: string) => (
                  <span
                    key={format}
                    className="text-xs px-2 py-1 bg-background rounded border"
                  >
                    {format.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={handleCreate}
              disabled={isCreating}
              className={cn(
                'px-4 py-2 rounded-md font-medium transition-colors',
                'bg-primary text-primary-foreground hover:bg-primary/90',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center gap-2'
              )}
            >
              {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Document
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentTypeSelector;

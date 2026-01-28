/**
 * Document Review
 * Step 7: Review document completion and export
 */

import React, { useState, useMemo } from 'react';
import {
  useDocumentBuilderStore,
  useDocument,
  useSectionLibrary,
  useSections,
} from '@/stores/document-builder-store';
import { ExportFormat, DocumentSection, SectionDefinition } from '@shared/document-builder/types';
import {
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  FileText,
  Download,
  Eye,
  Loader2,
  ChevronRight,
  Database,
  Image,
  Sparkles,
  FileDown,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CompletionIndicator } from './CompletionIndicator';

// =============================================================================
// Export Format Options
// =============================================================================

interface ExportOption {
  format: ExportFormat;
  label: string;
  description: string;
  icon: React.ElementType;
  available: boolean;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    format: 'pdf',
    label: 'PDF',
    description: 'High-quality print-ready document',
    icon: FileText,
    available: true,
  },
  {
    format: 'pptx',
    label: 'PowerPoint',
    description: 'Editable presentation slides',
    icon: FileDown,
    available: true,
  },
  {
    format: 'docx',
    label: 'Word',
    description: 'Editable document format',
    icon: FileText,
    available: false,
  },
];

// =============================================================================
// Section Status Row
// =============================================================================

interface SectionStatusRowProps {
  section: DocumentSection;
  definition: SectionDefinition | null;
  onNavigate: () => void;
}

const SectionStatusRow: React.FC<SectionStatusRowProps> = ({
  section,
  definition,
  onNavigate,
}) => {
  const completion = section.completionStatus;
  const isComplete = completion?.complete;
  const hasWarnings = (completion?.warnings?.length || 0) > 0;
  const percentage = completion?.percentage || 0;

  const issues: string[] = [];
  if (completion?.missingRequiredBindings?.length) {
    issues.push(`${completion.missingRequiredBindings.length} missing data`);
  }
  if (completion?.missingRequiredMedia?.length) {
    issues.push(`${completion.missingRequiredMedia.length} missing media`);
  }
  if (completion?.missingRequiredFields?.length) {
    issues.push(`${completion.missingRequiredFields.length} missing fields`);
  }

  return (
    <button
      onClick={onNavigate}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
        'hover:bg-muted/50',
        !section.enabled && 'opacity-50'
      )}
    >
      {/* Status Icon */}
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center',
          isComplete
            ? 'bg-green-100 text-green-600'
            : hasWarnings
              ? 'bg-yellow-100 text-yellow-600'
              : 'bg-red-100 text-red-600'
        )}
      >
        {isComplete ? (
          <CheckCircle className="w-4 h-4" />
        ) : hasWarnings ? (
          <AlertTriangle className="w-4 h-4" />
        ) : (
          <AlertCircle className="w-4 h-4" />
        )}
      </div>

      {/* Section Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">
            {section.customTitle || definition?.name || section.sectionKey}
          </span>
          {!section.enabled && (
            <Badge variant="outline" className="text-xs">
              Disabled
            </Badge>
          )}
        </div>
        {issues.length > 0 && (
          <div className="text-xs text-muted-foreground mt-0.5">
            {issues.join(', ')}
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        <Progress value={percentage} className="w-20 h-2" />
        <span className="text-sm text-muted-foreground w-10">
          {percentage}%
        </span>
      </div>

      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </button>
  );
};

// =============================================================================
// Export Card
// =============================================================================

interface ExportCardProps {
  option: ExportOption;
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
}

const ExportCard: React.FC<ExportCardProps> = ({
  option,
  selected,
  onSelect,
  disabled,
}) => {
  const Icon = option.icon;

  return (
    <button
      onClick={onSelect}
      disabled={disabled || !option.available}
      className={cn(
        'flex items-center gap-3 p-4 rounded-lg border transition-all text-left',
        selected
          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
          : 'border-muted hover:border-muted-foreground/50',
        (disabled || !option.available) && 'opacity-50 cursor-not-allowed'
      )}
    >
      <div
        className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center',
          selected ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{option.label}</span>
          {!option.available && (
            <Badge variant="outline" className="text-xs">
              Coming Soon
            </Badge>
          )}
        </div>
        <span className="text-sm text-muted-foreground">
          {option.description}
        </span>
      </div>
      {selected && (
        <CheckCircle className="w-5 h-5 text-primary" />
      )}
    </button>
  );
};

// =============================================================================
// Document Review
// =============================================================================

export const DocumentReview: React.FC = () => {
  const store = useDocumentBuilderStore();
  const document = useDocument();
  const sectionLibrary = useSectionLibrary();
  const sections = useSections();

  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf');
  const [isExporting, setIsExporting] = useState(false);
  const [exportJob, setExportJob] = useState<any>(null);

  // Calculate overall completion
  const completionStats = useMemo(() => {
    const enabledSections = sections.filter((s) => s.enabled);
    const completeSections = enabledSections.filter(
      (s) => s.completionStatus?.complete
    );
    const sectionsWithWarnings = enabledSections.filter(
      (s) => (s.completionStatus?.warnings?.length || 0) > 0
    );

    const totalPercentage =
      enabledSections.length > 0
        ? Math.round(
            enabledSections.reduce(
              (sum, s) => sum + (s.completionStatus?.percentage || 0),
              0
            ) / enabledSections.length
          )
        : 0;

    return {
      total: enabledSections.length,
      complete: completeSections.length,
      withWarnings: sectionsWithWarnings.length,
      percentage: totalPercentage,
      readyToExport: document?.completionStatus?.readyToExport || false,
    };
  }, [sections, document]);

  // Count requirements
  const requirementCounts = useMemo(() => {
    let missingData = 0;
    let missingMedia = 0;
    let aiGenerated = 0;

    sections.filter((s) => s.enabled).forEach((s) => {
      missingData += s.completionStatus?.missingRequiredBindings?.length || 0;
      missingMedia += s.completionStatus?.missingRequiredMedia?.length || 0;
      if (s.aiGenerated) aiGenerated++;
    });

    return { missingData, missingMedia, aiGenerated };
  }, [sections]);

  const handleExport = async () => {
    if (!document) return;

    setIsExporting(true);
    try {
      const response = await fetch(
        `/api/document-builder/documents/${document.id}/export`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            format: selectedFormat,
            options: {
              quality: 'standard',
            },
          }),
        }
      );

      const result = await response.json();
      if (result.success) {
        setExportJob(result.data);
        // Poll for completion
        pollExportJob(result.data.id);
      } else {
        console.error('Export failed:', result.error);
      }
    } catch (err) {
      console.error('Failed to create export job:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const pollExportJob = async (jobId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(
          `/api/document-builder/export/${jobId}`
        );
        const result = await response.json();
        
        if (result.success) {
          setExportJob(result.data);
          
          if (result.data.status === 'completed') {
            // Download the file
            if (result.data.outputUrl) {
              window.open(result.data.outputUrl, '_blank');
            }
          } else if (result.data.status === 'failed') {
            console.error('Export failed:', result.data.errorMessage);
          } else {
            // Still processing, poll again
            setTimeout(poll, 2000);
          }
        }
      } catch (err) {
        console.error('Failed to poll export job:', err);
      }
    };

    poll();
  };

  const handleNavigateToSection = (sectionId: number) => {
    store.selectSection(sectionId);
    store.setCurrentStep('bind_data');
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
      {/* Completion Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Document Completion</CardTitle>
              <CardDescription>
                Review your document before exporting
              </CardDescription>
            </div>
            <CompletionIndicator
              percentage={completionStats.percentage}
              size="lg"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold text-foreground">
                {completionStats.total}
              </div>
              <div className="text-sm text-muted-foreground">Sections</div>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {completionStats.complete}
              </div>
              <div className="text-sm text-muted-foreground">Complete</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {completionStats.withWarnings}
              </div>
              <div className="text-sm text-muted-foreground">With Warnings</div>
            </div>
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {requirementCounts.aiGenerated}
              </div>
              <div className="text-sm text-muted-foreground">AI Generated</div>
            </div>
          </div>

          {/* Requirement Indicators */}
          <div className="flex gap-4 mt-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Database className={cn(
                'w-4 h-4',
                requirementCounts.missingData > 0
                  ? 'text-yellow-500'
                  : 'text-green-500'
              )} />
              <span className="text-sm">
                {requirementCounts.missingData > 0
                  ? `${requirementCounts.missingData} missing data bindings`
                  : 'All data bound'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Image className={cn(
                'w-4 h-4',
                requirementCounts.missingMedia > 0
                  ? 'text-yellow-500'
                  : 'text-green-500'
              )} />
              <span className="text-sm">
                {requirementCounts.missingMedia > 0
                  ? `${requirementCounts.missingMedia} missing media`
                  : 'All media added'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section Status List */}
      <Card>
        <CardHeader>
          <CardTitle>Section Status</CardTitle>
          <CardDescription>
            Click on a section to navigate and fix issues
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {sections
            .filter((s) => s.enabled)
            .sort((a, b) => a.order - b.order)
            .map((section) => (
              <SectionStatusRow
                key={section.id}
                section={section}
                definition={sectionLibrary[section.sectionKey] || null}
                onNavigate={() => handleNavigateToSection(section.id)}
              />
            ))}
        </CardContent>
      </Card>

      {/* Export Options */}
      <Card>
        <CardHeader>
          <CardTitle>Export Document</CardTitle>
          <CardDescription>
            Choose your export format and download
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {EXPORT_OPTIONS.map((option) => (
              <ExportCard
                key={option.format}
                option={option}
                selected={selectedFormat === option.format}
                onSelect={() => setSelectedFormat(option.format)}
                disabled={!completionStats.readyToExport}
              />
            ))}
          </div>

          {/* Export Status */}
          {exportJob && (
            <div className={cn(
              'p-4 rounded-lg border',
              exportJob.status === 'completed'
                ? 'bg-green-50 border-green-200'
                : exportJob.status === 'failed'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-muted/30'
            )}>
              <div className="flex items-center gap-3">
                {exportJob.status === 'completed' ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : exportJob.status === 'failed' ? (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                ) : (
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                )}
                <div className="flex-1">
                  <div className="font-medium">
                    {exportJob.status === 'completed'
                      ? 'Export Complete'
                      : exportJob.status === 'failed'
                        ? 'Export Failed'
                        : 'Exporting...'}
                  </div>
                  {exportJob.status === 'failed' && exportJob.errorMessage && (
                    <div className="text-sm text-red-600">
                      {exportJob.errorMessage}
                    </div>
                  )}
                </div>
                {exportJob.status === 'completed' && exportJob.outputUrl && (
                  <Button
                    size="sm"
                    onClick={() => window.open(exportJob.outputUrl, '_blank')}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Export Button */}
          <div className="flex items-center gap-4">
            <Button
              onClick={handleExport}
              disabled={!completionStats.readyToExport || isExporting}
              size="lg"
              className="flex-1"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Export...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export as {selectedFormat.toUpperCase()}
                </>
              )}
            </Button>
            <Button variant="outline" size="lg">
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </Button>
          </div>

          {!completionStats.readyToExport && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Not ready to export.</strong> Please complete all
                  required data bindings and media before exporting.
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentReview;

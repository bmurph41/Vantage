/**
 * Document Builder Page
 * Main page for the Document Builder wizard
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { DocumentBuilder } from '../../components/document-builder/DocumentBuilder';
import { DocumentPreview } from '../../components/document-builder/DocumentPreview';
import { useDocumentBuilderStore } from '../../stores/document-builder-store';
import {
  useDocument,
  useCreateDocument,
  useDocumentTypeConfigs,
  useSectionLibrary,
  useBindingsCatalog,
} from '../../lib/document-builder-api';
import { DocumentType, BuilderStep } from '@shared/document-builder/types';

// =============================================================================
// Page Component
// =============================================================================

export function DocumentBuilderPage() {
  const { dealId, documentId } = useParams<{ dealId: string; documentId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const {
    document,
    currentStep,
    showPreview,
    setDocument,
    setLoading,
    setError,
    setBuilderMode,
    setCurrentStep,
    setSectionLibrary,
    setDocumentTypeConfigs,
    setBindingsCatalog,
    togglePreview,
  } = useDocumentBuilderStore();

  // API Queries
  const { data: existingDocument, isLoading: documentLoading, error: documentError } = useDocument(
    documentId ? parseInt(documentId, 10) : undefined,
    { enabled: !!documentId }
  );

  const { data: documentTypeConfigs } = useDocumentTypeConfigs();
  const { data: sectionLibrary } = useSectionLibrary();
  const { data: bindingsCatalog } = useBindingsCatalog(
    dealId ? parseInt(dealId, 10) : undefined
  );

  const createDocumentMutation = useCreateDocument();

  // =============================================================================
  // Effects
  // =============================================================================

  // Initialize builder mode
  useEffect(() => {
    setBuilderMode(true);
    return () => setBuilderMode(false);
  }, [setBuilderMode]);

  // Load document type configs
  useEffect(() => {
    if (documentTypeConfigs?.data) {
      setDocumentTypeConfigs(documentTypeConfigs.data);
    }
  }, [documentTypeConfigs, setDocumentTypeConfigs]);

  // Load section library
  useEffect(() => {
    if (sectionLibrary?.data) {
      setSectionLibrary(sectionLibrary.data);
    }
  }, [sectionLibrary, setSectionLibrary]);

  // Load bindings catalog
  useEffect(() => {
    if (bindingsCatalog?.data) {
      setBindingsCatalog(bindingsCatalog.data);
    }
  }, [bindingsCatalog, setBindingsCatalog]);

  // Load existing document
  useEffect(() => {
    setLoading(documentLoading);
    if (existingDocument?.data) {
      setDocument(existingDocument.data);
      // Skip to appropriate step based on document state
      if (existingDocument.data.sections?.length > 0) {
        setCurrentStep(BuilderStep.BIND_DATA);
      }
    }
    if (documentError) {
      setError(documentError instanceof Error ? documentError.message : 'Failed to load document');
    }
  }, [existingDocument, documentLoading, documentError, setDocument, setLoading, setError, setCurrentStep]);

  // Handle initial document type from URL
  useEffect(() => {
    const docType = searchParams.get('type');
    if (docType && !documentId) {
      // New document with type pre-selected
      setCurrentStep(BuilderStep.CONFIGURE);
    }
  }, [searchParams, documentId, setCurrentStep]);

  // =============================================================================
  // Handlers
  // =============================================================================

  const handleCreateDocument = async (input: {
    documentType: DocumentType;
    title: string;
    audience?: string;
    assetClass?: string;
    themeId?: number;
    templateId?: number;
  }) => {
    if (!dealId) return;

    try {
      const result = await createDocumentMutation.mutateAsync({
        dealId: parseInt(dealId, 10),
        ...input,
      });

      if (result.data) {
        setDocument(result.data);
        navigate(`/deals/${dealId}/documents/${result.data.id}/build`, { replace: true });
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create document');
    }
  };

  const handleComplete = () => {
    if (document) {
      navigate(`/deals/${dealId}/documents/${document.id}`);
    } else {
      navigate(`/deals/${dealId}/documents`);
    }
  };

  const handleCancel = () => {
    navigate(`/deals/${dealId}/documents`);
  };

  // =============================================================================
  // Render
  // =============================================================================

  if (!dealId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Invalid Deal</h2>
          <p className="mt-2 text-gray-600">No deal ID provided.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Main Builder Area */}
      <div className={`flex-1 overflow-hidden transition-all duration-300 ${showPreview ? 'mr-96' : ''}`}>
        <DocumentBuilder
          dealId={parseInt(dealId, 10)}
          documentId={documentId ? parseInt(documentId, 10) : undefined}
          onComplete={handleComplete}
          onCancel={handleCancel}
          onCreate={handleCreateDocument}
        />
      </div>

      {/* Preview Panel */}
      {showPreview && document && (
        <div className="fixed right-0 top-0 h-screen w-96 border-l border-gray-200 bg-white shadow-lg overflow-hidden">
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="font-medium text-gray-900">Preview</h3>
              <button
                onClick={() => togglePreview()}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              <DocumentPreview
                document={document}
                scale={0.5}
                showPageNumbers
              />
            </div>
          </div>
        </div>
      )}

      {/* Preview Toggle Button (when preview is hidden) */}
      {!showPreview && document && currentStep !== BuilderStep.SELECT_TYPE && (
        <button
          onClick={() => togglePreview()}
          className="fixed right-4 bottom-4 p-3 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-colors"
          title="Show Preview"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
      )}
    </div>
  );
}

// =============================================================================
// Document List Page
// =============================================================================

export function DocumentListPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();

  const { data: documents, isLoading } = useDocuments(
    dealId ? parseInt(dealId, 10) : undefined
  );

  const handleNewDocument = () => {
    navigate(`/deals/${dealId}/documents/new`);
  };

  const handleViewDocument = (documentId: number) => {
    navigate(`/deals/${dealId}/documents/${documentId}`);
  };

  const handleEditDocument = (documentId: number) => {
    navigate(`/deals/${dealId}/documents/${documentId}/build`);
  };

  if (!dealId) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">No deal selected</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="mt-1 text-gray-500">Create and manage investment documents</p>
        </div>
        <button
          onClick={handleNewDocument}
          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Document
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && (!documents?.data || documents.data.length === 0) && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No documents yet</h3>
          <p className="mt-2 text-gray-500">Get started by creating your first document.</p>
          <button
            onClick={handleNewDocument}
            className="mt-4 inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Create Document
          </button>
        </div>
      )}

      {/* Document Grid */}
      {!isLoading && documents?.data && documents.data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.data.map((doc: any) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onView={() => handleViewDocument(doc.id)}
              onEdit={() => handleEditDocument(doc.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Document Card Component
// =============================================================================

interface DocumentCardProps {
  document: {
    id: number;
    title: string;
    documentType: string;
    status: string;
    completionStatus?: {
      percentage: number;
      readyToExport: boolean;
    };
    updatedAt: string;
  };
  onView: () => void;
  onEdit: () => void;
}

function DocumentCard({ document, onView, onEdit }: DocumentCardProps) {
  const documentTypeLabels: Record<string, string> = {
    offering_memorandum: 'Offering Memorandum',
    investment_committee_memo: 'IC Memo',
    pitch_deck: 'Pitch Deck',
    executive_summary: 'Executive Summary',
    teaser: 'Teaser',
    lender_package: 'Lender Package',
    dd_summary: 'DD Summary',
    custom: 'Custom',
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    generating: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  };

  const completionPercent = document.completionStatus?.percentage || 0;
  const isReady = document.completionStatus?.readyToExport || false;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{document.title}</h3>
          <p className="text-sm text-gray-500">
            {documentTypeLabels[document.documentType] || document.documentType}
          </p>
        </div>
        <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${statusColors[document.status] || statusColors.draft}`}>
          {document.status}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Completion</span>
          <span className="font-medium text-gray-900">{completionPercent}%</span>
        </div>
        <div className="mt-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${isReady ? 'bg-green-500' : 'bg-primary-500'}`}
            style={{ width: `${completionPercent}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          Updated {new Date(document.updatedAt).toLocaleDateString()}
        </span>
        <div className="flex items-center space-x-2">
          <button
            onClick={onEdit}
            className="px-3 py-1.5 text-sm text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded transition-colors"
          >
            Edit
          </button>
          <button
            onClick={onView}
            className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
          >
            View
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Document View Page
// =============================================================================

export function DocumentViewPage() {
  const { dealId, documentId } = useParams<{ dealId: string; documentId: string }>();
  const navigate = useNavigate();
  const [exportFormat, setExportFormat] = useState<'pdf' | 'pptx' | 'docx'>('pdf');
  const [isExporting, setIsExporting] = useState(false);

  const { data: document, isLoading } = useDocument(
    documentId ? parseInt(documentId, 10) : undefined
  );

  const exportMutation = useCreateExportJob();

  const handleEdit = () => {
    navigate(`/deals/${dealId}/documents/${documentId}/build`);
  };

  const handleExport = async () => {
    if (!documentId) return;

    setIsExporting(true);
    try {
      const result = await exportMutation.mutateAsync({
        documentId: parseInt(documentId, 10),
        format: exportFormat,
        options: {
          includeTableOfContents: true,
          includePageNumbers: true,
        },
      });

      // Poll for job completion
      if (result.data?.id) {
        pollExportJob(result.data.id);
      }
    } catch (error) {
      console.error('Export failed:', error);
      setIsExporting(false);
    }
  };

  const pollExportJob = async (jobId: number) => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/document-builder/export/${jobId}`);
        const result = await response.json();

        if (result.data?.status === 'completed') {
          setIsExporting(false);
          // Trigger download
          window.location.href = `/api/document-builder/export/${jobId}/download`;
        } else if (result.data?.status === 'failed') {
          setIsExporting(false);
          alert('Export failed: ' + (result.data?.errorMessage || 'Unknown error'));
        } else {
          // Keep polling
          setTimeout(checkStatus, 1000);
        }
      } catch (error) {
        setIsExporting(false);
        console.error('Failed to check export status:', error);
      }
    };

    checkStatus();
  };

  if (!dealId || !documentId) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Document not found</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!document?.data) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Document not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{document.data.title}</h1>
              <p className="text-sm text-gray-500">
                {document.data.documentType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {/* Export Dropdown */}
              <div className="relative inline-flex">
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as any)}
                  className="appearance-none px-3 py-2 pr-8 border border-gray-300 rounded-l-lg bg-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="pdf">PDF</option>
                  <option value="pptx">PowerPoint</option>
                  <option value="docx">Word</option>
                </select>
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-r-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isExporting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Export
                    </>
                  )}
                </button>
              </div>

              <button
                onClick={handleEdit}
                className="px-4 py-2 border border-gray-300 bg-white text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
              >
                Edit Document
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Document Preview */}
      <div className="max-w-5xl mx-auto py-8 px-4">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <DocumentPreview
            document={document.data}
            scale={1}
            showPageNumbers
          />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Imports for hooks (need to be added to the actual api file)
// =============================================================================

// These would normally come from the API file
function useDocuments(dealId?: number) {
  return useQuery({
    queryKey: ['documents', dealId],
    queryFn: async () => {
      const response = await fetch(`/api/document-builder/deal/${dealId}/documents`);
      return response.json();
    },
    enabled: !!dealId,
  });
}

function useCreateExportJob() {
  return useMutation({
    mutationFn: async (input: { documentId: number; format: string; options?: any }) => {
      const response = await fetch(`/api/document-builder/documents/${input.documentId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: input.format, options: input.options }),
      });
      return response.json();
    },
  });
}

// Re-export for typing
import { useQuery, useMutation } from '@tanstack/react-query';

export default DocumentBuilderPage;

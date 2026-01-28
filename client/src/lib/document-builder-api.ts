/**
 * Document Builder API Client
 * React Query hooks and API utilities for the Document Builder system
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import type {
  DocumentType,
  DocumentStatus,
  AudiencePersona,
  AssetClass,
  ExportFormat,
  SectionDefinition,
  DocumentSection,
  DataBindingRequirement,
  ResolvedBinding,
  CompletionStatus,
  ExportJob,
  ExportJobStatus,
  BuilderStep,
} from '@shared/document-builder/types';

// =============================================================================
// Types
// =============================================================================

export interface DocumentData {
  id: number;
  dealId: number;
  documentType: DocumentType;
  title: string;
  audience: AudiencePersona | null;
  assetClass: AssetClass | null;
  themeId: number | null;
  templateId: number | null;
  status: DocumentStatus;
  completionStatus: CompletionStatus | null;
  sections: DocumentSection[];
  metadata: Record<string, any>;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentInput {
  dealId: number;
  documentType: DocumentType;
  title: string;
  audience?: AudiencePersona;
  assetClass?: AssetClass;
  themeId?: number;
  templateId?: number;
}

export interface UpdateDocumentInput {
  title?: string;
  audience?: AudiencePersona | null;
  themeId?: number | null;
  status?: DocumentStatus;
  metadata?: Record<string, any>;
}

export interface AddSectionInput {
  sectionKey: string;
  order?: number;
}

export interface UpdateSectionContentInput {
  content: Record<string, any>;
}

export interface UpdateSectionBindingsInput {
  bindings: Record<string, {
    source: string;
    field: string;
    resolvedValue?: any;
    locked?: boolean;
    overridden?: boolean;
  }>;
}

export interface UpdateSectionMediaInput {
  media: Record<string, {
    url?: string;
    s3Key?: string;
    mimeType?: string;
    width?: number;
    height?: number;
    caption?: string;
  }>;
}

export interface ReorderSectionsInput {
  sectionOrders: Array<{ sectionId: number; order: number }>;
}

export interface ResolveBindingsInput {
  dealId: number;
  bindings: Array<{
    key: string;
    source: string;
    field: string;
    transform?: string;
    fallback?: any;
  }>;
}

export interface GenerateContentInput {
  sectionKey: string;
  promptKey: string;
  context: Record<string, any>;
  provider?: 'openai' | 'anthropic';
  temperature?: number;
}

export interface CreateExportJobInput {
  format: ExportFormat;
  options?: {
    includePageNumbers?: boolean;
    includeToc?: boolean;
    includeDisclaimer?: boolean;
    quality?: 'draft' | 'standard' | 'high';
    paperSize?: 'letter' | 'a4' | 'legal';
    orientation?: 'portrait' | 'landscape';
  };
}

export interface BindingsCatalog {
  [source: string]: {
    label: string;
    description?: string;
    fields: Array<{
      key: string;
      label: string;
      type: string;
      description?: string;
      format?: string;
    }>;
  };
}

export interface DocumentTypeConfig {
  type: DocumentType;
  label: string;
  description: string;
  defaultSections: string[];
  optionalSections: string[];
  estimatedPages: { min: number; max: number };
  supportedExports: ExportFormat[];
}

export interface AIGenerationResult {
  content: string;
  provider: string;
  model: string;
  tokensUsed: number;
  metadata?: Record<string, any>;
}

export interface AIProviders {
  available: string[];
  default: string;
}

export interface CompletionSummary {
  documentId: number;
  totalSections: number;
  completedSections: number;
  percentage: number;
  readyForExport: boolean;
  missingRequirements: {
    sectionId: number;
    sectionKey: string;
    missingBindings: string[];
    missingMedia: string[];
  }[];
  warnings: string[];
}

// =============================================================================
// API Client
// =============================================================================

const API_BASE = '/api/document-builder';

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith('/') ? endpoint : `${API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  const result = await response.json();
  return result.data ?? result;
}

// =============================================================================
// Query Keys
// =============================================================================

export const documentBuilderKeys = {
  all: ['document-builder'] as const,
  documents: () => [...documentBuilderKeys.all, 'documents'] as const,
  document: (id: number) => [...documentBuilderKeys.documents(), id] as const,
  dealDocuments: (dealId: number) => [...documentBuilderKeys.documents(), 'deal', dealId] as const,
  completion: (id: number) => [...documentBuilderKeys.document(id), 'completion'] as const,
  config: () => [...documentBuilderKeys.all, 'config'] as const,
  documentTypes: () => [...documentBuilderKeys.config(), 'document-types'] as const,
  sections: () => [...documentBuilderKeys.config(), 'sections'] as const,
  sectionsForType: (docType: DocumentType) => [...documentBuilderKeys.sections(), docType] as const,
  bindings: () => [...documentBuilderKeys.all, 'bindings'] as const,
  bindingsCatalog: () => [...documentBuilderKeys.bindings(), 'catalog'] as const,
  ai: () => [...documentBuilderKeys.all, 'ai'] as const,
  aiProviders: () => [...documentBuilderKeys.ai(), 'providers'] as const,
  export: () => [...documentBuilderKeys.all, 'export'] as const,
  exportJob: (jobId: number) => [...documentBuilderKeys.export(), jobId] as const,
};

// =============================================================================
// Document Hooks
// =============================================================================

/**
 * Fetch a single document with all sections
 */
export function useDocument(
  documentId: number | null,
  options?: Omit<UseQueryOptions<DocumentData>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: documentBuilderKeys.document(documentId!),
    queryFn: () => apiRequest<DocumentData>(`/documents/${documentId}`),
    enabled: documentId !== null,
    ...options,
  });
}

/**
 * Fetch all documents for a deal
 */
export function useDealDocuments(
  dealId: number | null,
  options?: Omit<UseQueryOptions<DocumentData[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: documentBuilderKeys.dealDocuments(dealId!),
    queryFn: () => apiRequest<DocumentData[]>(`/deals/${dealId}/documents`),
    enabled: dealId !== null,
    ...options,
  });
}

/**
 * Create a new document
 */
export function useCreateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateDocumentInput) =>
      apiRequest<DocumentData>('/documents', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(documentBuilderKeys.document(data.id), data);
      queryClient.invalidateQueries({ queryKey: documentBuilderKeys.dealDocuments(data.dealId) });
    },
  });
}

/**
 * Update a document
 */
export function useUpdateDocument(documentId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateDocumentInput) =>
      apiRequest<DocumentData>(`/documents/${documentId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(documentBuilderKeys.document(documentId), data);
    },
  });
}

/**
 * Delete a document
 */
export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ documentId, dealId }: { documentId: number; dealId: number }) =>
      apiRequest<void>(`/documents/${documentId}`, { method: 'DELETE' }),
    onSuccess: (_, { documentId, dealId }) => {
      queryClient.removeQueries({ queryKey: documentBuilderKeys.document(documentId) });
      queryClient.invalidateQueries({ queryKey: documentBuilderKeys.dealDocuments(dealId) });
    },
  });
}

// =============================================================================
// Section Hooks
// =============================================================================

/**
 * Add a section to a document
 */
export function useAddSection(documentId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AddSectionInput) =>
      apiRequest<DocumentSection>(`/documents/${documentId}/sections`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentBuilderKeys.document(documentId) });
    },
  });
}

/**
 * Remove a section from a document
 */
export function useRemoveSection(documentId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sectionId: number) =>
      apiRequest<void>(`/documents/${documentId}/sections/${sectionId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentBuilderKeys.document(documentId) });
    },
  });
}

/**
 * Update section content
 */
export function useUpdateSectionContent(documentId: number, sectionId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateSectionContentInput) =>
      apiRequest<DocumentSection>(`/documents/${documentId}/sections/${sectionId}/content`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentBuilderKeys.document(documentId) });
    },
  });
}

/**
 * Update section data bindings
 */
export function useUpdateSectionBindings(documentId: number, sectionId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateSectionBindingsInput) =>
      apiRequest<DocumentSection>(`/documents/${documentId}/sections/${sectionId}/bindings`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentBuilderKeys.document(documentId) });
    },
  });
}

/**
 * Update section media
 */
export function useUpdateSectionMedia(documentId: number, sectionId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateSectionMediaInput) =>
      apiRequest<DocumentSection>(`/documents/${documentId}/sections/${sectionId}/media`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentBuilderKeys.document(documentId) });
    },
  });
}

/**
 * Toggle section enabled status
 */
export function useToggleSection(documentId: number, sectionId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiRequest<DocumentSection>(`/documents/${documentId}/sections/${sectionId}/toggle`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentBuilderKeys.document(documentId) });
    },
  });
}

/**
 * Reorder sections
 */
export function useReorderSections(documentId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReorderSectionsInput) =>
      apiRequest<void>(`/documents/${documentId}/sections/reorder`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentBuilderKeys.document(documentId) });
    },
  });
}

// =============================================================================
// Data Binding Hooks
// =============================================================================

/**
 * Fetch bindings catalog
 */
export function useBindingsCatalog(
  options?: Omit<UseQueryOptions<BindingsCatalog>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: documentBuilderKeys.bindingsCatalog(),
    queryFn: () => apiRequest<BindingsCatalog>('/bindings/catalog'),
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
}

/**
 * Resolve data bindings
 */
export function useResolveBindings() {
  return useMutation({
    mutationFn: (input: ResolveBindingsInput) =>
      apiRequest<Record<string, ResolvedBinding>>('/bindings/resolve', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

/**
 * Preview a single binding value
 */
export function usePreviewBinding(
  dealId: number | null,
  source: string | null,
  field: string | null,
  transform?: string
) {
  return useQuery({
    queryKey: [...documentBuilderKeys.bindings(), 'preview', dealId, source, field, transform],
    queryFn: () => {
      const params = new URLSearchParams();
      if (transform) params.set('transform', transform);
      const queryStr = params.toString();
      return apiRequest<{ source: string; field: string; value: any }>(
        `/bindings/preview/${dealId}/${source}/${field}${queryStr ? `?${queryStr}` : ''}`
      );
    },
    enabled: dealId !== null && source !== null && field !== null,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// =============================================================================
// AI Content Hooks
// =============================================================================

/**
 * Get available AI providers
 */
export function useAIProviders(
  options?: Omit<UseQueryOptions<AIProviders>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: documentBuilderKeys.aiProviders(),
    queryFn: () => apiRequest<AIProviders>('/ai/providers'),
    staleTime: 60 * 60 * 1000, // 1 hour
    ...options,
  });
}

/**
 * Generate content using AI
 */
export function useGenerateContent() {
  return useMutation({
    mutationFn: (input: GenerateContentInput) =>
      apiRequest<AIGenerationResult>('/ai/generate', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

/**
 * Generate executive summary
 */
export function useGenerateExecutiveSummary() {
  return useMutation({
    mutationFn: (input: {
      propertyName: string;
      propertyType?: string;
      location?: string;
      highlights?: string[];
      metrics?: Record<string, any>;
      options?: { provider?: string; temperature?: number };
    }) =>
      apiRequest<AIGenerationResult>('/ai/executive-summary', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

/**
 * Generate investment highlights
 */
export function useGenerateInvestmentHighlights() {
  return useMutation({
    mutationFn: (input: {
      propertyName: string;
      propertyType?: string;
      financials?: Record<string, any>;
      marketData?: Record<string, any>;
      count?: number;
      options?: { provider?: string; temperature?: number };
    }) =>
      apiRequest<AIGenerationResult>('/ai/investment-highlights', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

/**
 * Generate market overview
 */
export function useGenerateMarketOverview() {
  return useMutation({
    mutationFn: (input: {
      location: string;
      propertyType?: string;
      demographics?: Record<string, any>;
      marketStats?: Record<string, any>;
      options?: { provider?: string; temperature?: number };
    }) =>
      apiRequest<AIGenerationResult>('/ai/market-overview', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

/**
 * Generate risk assessment
 */
export function useGenerateRiskAssessment() {
  return useMutation({
    mutationFn: (input: {
      propertyName: string;
      propertyType?: string;
      financials?: Record<string, any>;
      marketConditions?: Record<string, any>;
      options?: { provider?: string; temperature?: number };
    }) =>
      apiRequest<AIGenerationResult>('/ai/risk-assessment', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

// =============================================================================
// Export Hooks
// =============================================================================

/**
 * Create an export job
 */
export function useCreateExportJob(documentId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateExportJobInput) =>
      apiRequest<ExportJob>(`/documents/${documentId}/export`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(documentBuilderKeys.exportJob(data.id), data);
    },
  });
}

/**
 * Get export job status
 */
export function useExportJob(
  jobId: number | null,
  options?: Omit<UseQueryOptions<ExportJob>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: documentBuilderKeys.exportJob(jobId!),
    queryFn: () => apiRequest<ExportJob>(`/export/${jobId}`),
    enabled: jobId !== null,
    refetchInterval: (data) => {
      // Poll while job is pending or processing
      if (data?.status === 'pending' || data?.status === 'processing') {
        return 2000; // Poll every 2 seconds
      }
      return false;
    },
    ...options,
  });
}

// =============================================================================
// Configuration Hooks
// =============================================================================

/**
 * Fetch document type configurations
 */
export function useDocumentTypeConfigs(
  options?: Omit<UseQueryOptions<DocumentTypeConfig[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: documentBuilderKeys.documentTypes(),
    queryFn: () => apiRequest<DocumentTypeConfig[]>('/config/document-types'),
    staleTime: 60 * 60 * 1000, // 1 hour
    ...options,
  });
}

/**
 * Fetch full section library
 */
export function useSectionLibrary(
  options?: Omit<UseQueryOptions<Record<string, SectionDefinition>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: documentBuilderKeys.sections(),
    queryFn: () => apiRequest<Record<string, SectionDefinition>>('/config/sections'),
    staleTime: 60 * 60 * 1000, // 1 hour
    ...options,
  });
}

/**
 * Fetch sections available for a document type
 */
export function useSectionsForType(
  docType: DocumentType | null,
  options?: Omit<UseQueryOptions<SectionDefinition[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: documentBuilderKeys.sectionsForType(docType!),
    queryFn: () => apiRequest<SectionDefinition[]>(`/config/sections/${docType}`),
    enabled: docType !== null,
    staleTime: 60 * 60 * 1000, // 1 hour
    ...options,
  });
}

/**
 * Get completion summary for a document
 */
export function useDocumentCompletion(
  documentId: number | null,
  options?: Omit<UseQueryOptions<CompletionSummary>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: documentBuilderKeys.completion(documentId!),
    queryFn: () => apiRequest<CompletionSummary>(`/documents/${documentId}/completion`),
    enabled: documentId !== null,
    ...options,
  });
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Build export download URL
 */
export function getExportDownloadUrl(jobId: number): string {
  return `${API_BASE}/export/${jobId}/download`;
}

/**
 * Build document preview URL
 */
export function getDocumentPreviewUrl(documentId: number, format: 'html' | 'pdf' = 'html'): string {
  return `${API_BASE}/documents/${documentId}/preview?format=${format}`;
}

/**
 * Invalidate all document-related queries
 */
export function useInvalidateDocumentQueries() {
  const queryClient = useQueryClient();

  return (documentId?: number) => {
    if (documentId) {
      queryClient.invalidateQueries({ queryKey: documentBuilderKeys.document(documentId) });
    } else {
      queryClient.invalidateQueries({ queryKey: documentBuilderKeys.documents() });
    }
  };
}

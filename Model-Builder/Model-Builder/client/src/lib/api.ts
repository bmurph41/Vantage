import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Om, InsertOm, OmPage, InsertOmPage, OmBlock, InsertOmBlock, Dataset } from "@shared/schema";

// API Client
async function fetchApi(endpoint: string, options?: RequestInit) {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

// OM API Functions
export const omApi = {
  getOmsByProject: (projectId: string) => 
    fetchApi(`/api/oms/project/${projectId}`),
  
  getOm: (id: string) => 
    fetchApi(`/api/oms/${id}`),
  
  createOm: (om: InsertOm) => 
    fetchApi("/api/oms", {
      method: "POST",
      body: JSON.stringify(om),
    }),
  
  updateOm: (id: string, updates: Partial<InsertOm>) => 
    fetchApi(`/api/oms/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),
  
  deleteOm: (id: string) => 
    fetchApi(`/api/oms/${id}`, { method: "DELETE" }),
  
  cloneOm: (id: string) => 
    fetchApi(`/api/oms/${id}/clone`, { method: "POST" }),
};

// Page API Functions
export const pageApi = {
  getPagesByOm: (omId: string) => 
    fetchApi(`/api/oms/${omId}/pages`),
  
  getPage: (id: string) => 
    fetchApi(`/api/pages/${id}`),
  
  createPage: (page: InsertOmPage) => 
    fetchApi("/api/pages", {
      method: "POST",
      body: JSON.stringify(page),
    }),
  
  updatePage: (id: string, updates: Partial<InsertOmPage>) => 
    fetchApi(`/api/pages/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),
  
  deletePage: (id: string) => 
    fetchApi(`/api/pages/${id}`, { method: "DELETE" }),
  
  reorderPages: (omId: string, pageIds: string[]) => 
    fetchApi(`/api/oms/${omId}/pages/reorder`, {
      method: "POST",
      body: JSON.stringify({ pageIds }),
    }),
};

// Block API Functions
export const blockApi = {
  getBlocksByPage: (pageId: string) => 
    fetchApi(`/api/pages/${pageId}/blocks`),
  
  getBlock: (id: string) => 
    fetchApi(`/api/blocks/${id}`),
  
  createBlock: (block: InsertOmBlock) => 
    fetchApi("/api/blocks", {
      method: "POST",
      body: JSON.stringify(block),
    }),
  
  updateBlock: (id: string, updates: Partial<InsertOmBlock>) => 
    fetchApi(`/api/blocks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),
  
  deleteBlock: (id: string) => 
    fetchApi(`/api/blocks/${id}`, { method: "DELETE" }),
  
  reorderBlocks: (pageId: string, blockIds: string[]) => 
    fetchApi(`/api/pages/${pageId}/blocks/reorder`, {
      method: "POST",
      body: JSON.stringify({ blockIds }),
    }),
};

// React Query Hooks - OMs
export function useOms(projectId: string) {
  return useQuery<Om[]>({
    queryKey: ["oms", projectId],
    queryFn: () => omApi.getOmsByProject(projectId),
  });
}

export function useOm(id: string | undefined) {
  return useQuery<Om>({
    queryKey: ["om", id],
    queryFn: () => omApi.getOm(id!),
    enabled: !!id,
  });
}

export function useCreateOm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: omApi.createOm,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["oms", data.projectId] });
    },
  });
}

export function useUpdateOm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<InsertOm> }) =>
      omApi.updateOm(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["om", data?.id] });
      queryClient.invalidateQueries({ queryKey: ["oms", data?.projectId] });
    },
  });
}

export function useDeleteOm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: omApi.deleteOm,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["oms"] });
    },
  });
}

export function useCloneOm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: omApi.cloneOm,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["oms", data?.projectId] });
    },
  });
}

// React Query Hooks - Pages
export function usePages(omId: string | undefined) {
  return useQuery<OmPage[]>({
    queryKey: ["pages", omId],
    queryFn: () => pageApi.getPagesByOm(omId!),
    enabled: !!omId,
  });
}

export function useCreatePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: pageApi.createPage,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pages", data.omId] });
    },
  });
}

export function useUpdatePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<InsertOmPage> }) =>
      pageApi.updatePage(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pages", data?.omId] });
    },
  });
}

export function useDeletePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: pageApi.deletePage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pages"] });
    },
  });
}

// React Query Hooks - Blocks
export function useBlocks(pageId: string | undefined) {
  return useQuery<OmBlock[]>({
    queryKey: ["blocks", pageId],
    queryFn: () => blockApi.getBlocksByPage(pageId!),
    enabled: !!pageId,
  });
}

export function useCreateBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: blockApi.createBlock,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["blocks", data.pageId] });
    },
  });
}

export function useUpdateBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<InsertOmBlock> }) =>
      blockApi.updateBlock(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["blocks", data?.pageId] });
    },
  });
}

export function useDeleteBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: blockApi.deleteBlock,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocks"] });
    },
  });
}

// Dataset API Functions
export const datasetApi = {
  getDatasetsByProject: (projectId: string) => 
    fetchApi(`/api/datasets/project/${projectId}`),
  
  getDataset: (id: string) => 
    fetchApi(`/api/datasets/${id}`),
  
  uploadDataset: async (file: File, projectId: string, name: string, type: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);
    formData.append('name', name);
    formData.append('type', type);
    
    const response = await fetch('/api/datasets/upload', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    return response.json();
  },
  
  deleteDataset: (id: string) => 
    fetchApi(`/api/datasets/${id}`, { method: "DELETE" }),
  
  getSheetData: (datasetId: string, sheetName: string) =>
    fetchApi(`/api/datasets/${datasetId}/sheet/${encodeURIComponent(sheetName)}`),
};

// Data Facade API Functions
export const dataFacadeApi = {
  getSources: (projectId: string) =>
    fetchApi(`/api/data-facade/sources/${projectId}`),
  
  getData: (sourceId: string, sheet?: string) =>
    fetchApi(`/api/data-facade/data/${sourceId}${sheet ? `?sheet=${encodeURIComponent(sheet)}` : ''}`),
};

// React Query Hooks - Datasets
export function useDatasets(projectId: string) {
  return useQuery<Dataset[]>({
    queryKey: ["datasets", projectId],
    queryFn: () => datasetApi.getDatasetsByProject(projectId),
    enabled: !!projectId,
  });
}

export function useDataset(id: string | undefined) {
  return useQuery<Dataset>({
    queryKey: ["dataset", id],
    queryFn: () => datasetApi.getDataset(id!),
    enabled: !!id,
  });
}

export function useUploadDataset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, projectId, name, type }: { file: File; projectId: string; name: string; type: string }) =>
      datasetApi.uploadDataset(file, projectId, name, type),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["datasets", data.projectId] });
      queryClient.invalidateQueries({ queryKey: ["dataSources"] });
    },
  });
}

export function useDeleteDataset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: datasetApi.deleteDataset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
      queryClient.invalidateQueries({ queryKey: ["dataSources"] });
    },
  });
}

// React Query Hooks - Data Facade
export interface DataSource {
  id: string;
  name: string;
  type: string;
  sourceType: 'dataset' | 'external';
  sheetNames?: string[];
  metadata?: any;
}

export function useDataSources(projectId: string) {
  return useQuery<DataSource[]>({
    queryKey: ["dataSources", projectId],
    queryFn: () => dataFacadeApi.getSources(projectId),
    enabled: !!projectId,
  });
}

export function useSourceData(sourceId: string | undefined, sheet?: string) {
  return useQuery({
    queryKey: ["sourceData", sourceId, sheet],
    queryFn: () => dataFacadeApi.getData(sourceId!, sheet),
    enabled: !!sourceId,
  });
}

// AI API Types
export interface PropertyContext {
  propertyName?: string;
  propertyType?: string;
  location?: string;
  size?: string;
  yearBuilt?: string;
  occupancy?: string;
  askingPrice?: string;
  noi?: string;
  capRate?: string;
  tenants?: string[];
  amenities?: string[];
  additionalNotes?: string;
}

export interface MarketContext {
  location?: string;
  medianRent?: number;
  vacancyRate?: number;
  population?: number;
  employmentGrowth?: number;
  medianIncome?: number;
  marketTrends?: string;
}

export interface GenerateRequest {
  type: 'executive_summary' | 'investment_highlights' | 'market_commentary' | 'financial_analysis' | 'property_description' | 'custom';
  propertyContext?: PropertyContext;
  marketContext?: MarketContext;
  customPrompt?: string;
  existingContent?: string;
  tone?: 'professional' | 'compelling' | 'conservative';
}

// AI API Functions
export const aiApi = {
  generate: (request: GenerateRequest): Promise<{ content: string }> =>
    fetchApi("/api/ai/generate", {
      method: "POST",
      body: JSON.stringify(request),
    }),

  improve: (content: string, instruction: string): Promise<{ content: string }> =>
    fetchApi("/api/ai/improve", {
      method: "POST",
      body: JSON.stringify({ content, instruction }),
    }),

  suggestLayout: (contentDescription: string): Promise<{
    suggestedTemplate: string;
    reasoning: string;
    blocks: { type: string; content: string }[];
  }> =>
    fetchApi("/api/ai/suggest-layout", {
      method: "POST",
      body: JSON.stringify({ contentDescription }),
    }),
};

// AI Hooks
export function useAiGenerate() {
  return useMutation({
    mutationFn: aiApi.generate,
  });
}

export function useAiImprove() {
  return useMutation({
    mutationFn: ({ content, instruction }: { content: string; instruction: string }) =>
      aiApi.improve(content, instruction),
  });
}

export function useAiSuggestLayout() {
  return useMutation({
    mutationFn: aiApi.suggestLayout,
  });
}

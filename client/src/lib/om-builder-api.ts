import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface OmDocument {
  id: string;
  name: string;
  docType: string;
  status: 'draft' | 'published';
  version: number;
  brandKitId?: string;
  modelingProjectId?: string;
  dealId?: string;
  shareToken?: string;
  workingSnapshotJson?: any;
  createdAt: string;
  updatedAt: string;
}

export interface OmPage {
  id: string;
  omId: string;
  name: string;
  order: number;
  pageSize: string;
  orientation: string;
  width: number;
  height: number;
  content?: any;
}

export interface OmBlock {
  id: string;
  pageId: string;
  blockType: string;
  config: any;
  content?: any;
  order: number;
  dataBinding?: any;
}

export interface OmBrandKit {
  id: string;
  name: string;
  tokens: any;
  primaryColors?: string[];
  secondaryColors?: string[];
  accentColors?: string[];
  fontFamilies?: {
    heading?: string;
    body?: string;
    alt?: string;
  };
  autoImportedFromUrl?: string;
}

export interface OmAsset {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  sha256?: string;
  width?: number;
  height?: number;
  byteSize?: number;
  folder?: string;
  tags?: string[];
}

export interface BindingsCatalog {
  [source: string]: {
    label: string;
    fields: { key: string; label: string; type: string }[];
  };
}

export interface BrandScanResult {
  primaryColors: string[];
  secondaryColors: string[];
  accentColors: string[];
  fontFamilies: {
    heading?: string;
    body?: string;
    alt?: string;
  };
  logoUrl?: string;
  faviconUrl?: string;
  siteName?: string;
}

export function useOms(userId?: string, organizationId?: string) {
  return useQuery<OmDocument[]>({
    queryKey: ['/api/om-builder/oms', { userId, organizationId }],
    enabled: Boolean(userId || organizationId),
  });
}

export function useOm(omId: string | null) {
  return useQuery<OmDocument>({
    queryKey: ['/api/om-builder/oms', omId],
    enabled: Boolean(omId),
  });
}

export function useOmWithPages(omId: string | null) {
  return useQuery<{ om: OmDocument; pages: (OmPage & { blocks: OmBlock[] })[] }>({
    queryKey: ['/api/om-builder/oms', omId, 'full'],
    enabled: Boolean(omId),
  });
}

export function useCreateOm() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      name: string;
      docType?: string;
      templateId?: string;
      userId: string;
      organizationId?: string;
    }) => {
      return apiRequest('/api/om-builder/oms', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/om-builder/oms'] });
    },
  });
}

export function useUpdateOm(omId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Partial<OmDocument>) => {
      return apiRequest(`/api/om-builder/oms/${omId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/om-builder/oms', omId] });
    },
  });
}

export function useAutosaveOm(omId: string) {
  return useMutation({
    mutationFn: async (data: { snapshot: any; userId: string }) => {
      return apiRequest(`/api/om-builder/oms/${omId}/autosave`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });
}

export function usePublishOm(omId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { userId: string; changeSummary?: string }) => {
      return apiRequest(`/api/om-builder/oms/${omId}/publish`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/om-builder/oms', omId] });
    },
  });
}

export function useShareOm(omId: string) {
  return useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/om-builder/oms/${omId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });
}

export function useOmVersions(omId: string | null) {
  return useQuery({
    queryKey: ['/api/om-builder/oms', omId, 'versions'],
    enabled: Boolean(omId),
  });
}

export function useRestoreOmVersion(omId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (versionId: string) => {
      return apiRequest(`/api/om-builder/oms/${omId}/versions/${versionId}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/om-builder/oms', omId] });
    },
  });
}

export function useBrandKits(userId?: string, organizationId?: string) {
  return useQuery<OmBrandKit[]>({
    queryKey: ['/api/om-builder/brand-kits', { userId, organizationId }],
    enabled: Boolean(userId || organizationId),
  });
}

export function useCreateBrandKit() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Partial<OmBrandKit> & { userId: string }) => {
      return apiRequest('/api/om-builder/brand-kits', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/om-builder/brand-kits'] });
    },
  });
}

export function useScanBrandFromUrl() {
  return useMutation<BrandScanResult, Error, string>({
    mutationFn: async (url: string) => {
      return apiRequest('/api/om-builder/brand-kits/scan-url', {
        method: 'POST',
        body: JSON.stringify({ url }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });
}

export function useAutoImportBrandKit() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { url: string; userId: string; organizationId?: string; name?: string }) => {
      return apiRequest('/api/om-builder/brand-kits/auto-import', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/om-builder/brand-kits'] });
    },
  });
}

export function useAssets(organizationId?: string, userId?: string, folder?: string) {
  const params = new URLSearchParams();
  if (organizationId) params.set('organizationId', organizationId);
  if (userId) params.set('userId', userId);
  if (folder) params.set('folder', folder);
  
  return useQuery<OmAsset[]>({
    queryKey: ['/api/om-builder/assets', { organizationId, userId, folder }],
    enabled: Boolean(organizationId || userId),
  });
}

export function useSearchAssets(query: string, organizationId?: string, folder?: string) {
  return useQuery<OmAsset[]>({
    queryKey: ['/api/om-builder/assets/search', { query, organizationId, folder }],
    enabled: Boolean(query && query.length >= 2),
  });
}

export function useUploadAsset() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { file: File; userId: string; organizationId?: string; folder?: string; tags?: string[] }) => {
      const formData = new FormData();
      formData.append('file', data.file);
      formData.append('userId', data.userId);
      if (data.organizationId) formData.append('organizationId', data.organizationId);
      if (data.folder) formData.append('folder', data.folder);
      if (data.tags) formData.append('tags', JSON.stringify(data.tags));
      
      const response = await fetch('/api/om-builder/assets/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/om-builder/assets'] });
    },
  });
}

export function useDeleteAsset() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (assetId: string) => {
      return apiRequest(`/api/om-builder/assets/${assetId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/om-builder/assets'] });
    },
  });
}

export function useBindingsCatalog() {
  return useQuery<BindingsCatalog>({
    queryKey: ['/api/om-builder/bindings/catalog'],
  });
}

export function useResolveBindings() {
  return useMutation({
    mutationFn: async (data: {
      bindings: { key: string; source: string; field: string }[];
      projectId?: string;
      modelingProjectId?: string;
      dealId?: string;
    }) => {
      return apiRequest('/api/om-builder/resolve-bindings', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });
}

export function useOmTemplates(scope?: 'system' | 'organization' | 'user') {
  return useQuery({
    queryKey: ['/api/om-builder/templates', { scope }],
  });
}

export function useSeedTemplates() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      return apiRequest('/api/om-builder/seed-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/om-builder/templates'] });
    },
  });
}

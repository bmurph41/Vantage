import { apiRequest } from "@/lib/queryClient";
import type { 
  SalesComp, 
  InsertSalesComp, 
  UpdateSalesComp,
  CompColumn,
  InsertCompColumn,
  UpdateCompColumn,
  CompImport,
  Project,
  InsertProject,
  UpdateProject,
  ProjectComp,
  InsertProjectComp,
  SavedSearch,
  InsertSavedSearch,
  UpdateSavedSearch
} from "@shared/schema";

export interface CompsResponse {
  comps: SalesComp[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FilterParams {
  q?: string;
  state?: string;
  region?: string;
  saleYearMin?: number;
  saleYearMax?: number;
  priceMin?: number;
  priceMax?: number;
  capRateMin?: number;
  capRateMax?: number;
  occupancyMin?: number;
  occupancyMax?: number;
  wetSlipsMin?: number;
  wetSlipsMax?: number;
  dryRacksMin?: number;
  dryRacksMax?: number;
  ioBoth?: string;
  hasArticle?: boolean;
  disclosedOnly?: boolean;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export const salesCompsApi = {
  getAllIds: async (): Promise<{ ids: string[] }> => {
    const response = await apiRequest('GET', '/api/sales-comps/ids');
    return await response.json();
  },

  getComps: async (params: FilterParams = {}): Promise<CompsResponse> => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (key === 'columnFilters' && typeof value === 'object') {
          searchParams.append(key, JSON.stringify(value));
        } else {
          searchParams.append(key, value.toString());
        }
      }
    });
    
    const response = await apiRequest('GET', `/api/sales-comps?${searchParams}`);
    return await response.json();
  },

  getComp: async (id: string): Promise<SalesComp> => {
    const response = await apiRequest('GET', `/api/sales-comps/${id}`);
    return await response.json();
  },

  createComp: async (comp: InsertSalesComp): Promise<SalesComp> => {
    const response = await apiRequest('POST', '/api/sales-comps', comp);
    return await response.json();
  },

  updateComp: async (id: string, updates: UpdateSalesComp): Promise<SalesComp> => {
    const response = await apiRequest('PATCH', `/api/sales-comps/${id}`, updates);
    return await response.json();
  },

  deleteComp: async (id: string): Promise<void> => {
    await apiRequest('DELETE', `/api/sales-comps/${id}`);
  },

  bulkUpdate: async (ids: string[], updates: UpdateSalesComp): Promise<{ updated: number }> => {
    const response = await apiRequest('POST', '/api/sales-comps/bulk-update', { ids, updates });
    return await response.json();
  },

  bulkDelete: async (ids: string[]): Promise<{ deleted: number }> => {
    const response = await apiRequest('POST', '/api/sales-comps/bulk-delete', { ids });
    return await response.json();
  },

  getColumnUniqueValues: async (column: string): Promise<{ values: string[] }> => {
    const response = await apiRequest('GET', `/api/sales-comps/column-values/${column}`);
    return await response.json();
  },

  uploadFile: async (file: File): Promise<{ importId: string; analysis: any }> => {
    const formData = new FormData();
    formData.append('file', file);
    
    // Get CSRF token from cookie
    const csrfMatch = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
    const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : '';
    
    const headers: Record<string, string> = {};
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
    
    const response = await fetch('/api/sales-comps/upload', {
      method: 'POST',
      body: formData,
      headers,
      credentials: 'include',
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${response.status}: ${text}`);
    }
    
    return await response.json();
  },

  detectDuplicates: async (importId: string, mapping: Record<string, string>, normalization: any): Promise<any> => {
    const response = await apiRequest('POST', `/api/sales-comps/import/${importId}/detect-duplicates`, {
      mapping,
      normalization,
    });
    return await response.json();
  },

  previewImport: async (
    importId: string,
    mapping: Record<string, string>,
    normalization: any,
    importMode: 'insert' | 'update' | 'upsert' = 'upsert',
    updateBlankValues: boolean = false
  ): Promise<any> => {
    const response = await apiRequest('POST', `/api/sales-comps/import/${importId}/preview`, {
      mapping,
      normalization,
      importMode,
      updateBlankValues,
    });
    return await response.json();
  },

  commitImport: async (importId: string, mapping: Record<string, string>, normalization: any, excludedRows: number[] = [], parentPortfolioId?: string, importMode?: 'insert' | 'update' | 'upsert', updateBlankValues?: boolean): Promise<any> => {
    const response = await apiRequest('POST', `/api/sales-comps/import/${importId}/commit`, {
      mapping,
      normalization,
      excludedRows,
      parentPortfolioId,
      importMode,
      updateBlankValues,
    });
    return await response.json();
  },

  getImportStatus: async (importId: string): Promise<CompImport> => {
    const response = await apiRequest('GET', `/api/sales-comps/import/${importId}/status`);
    return await response.json();
  },
};

export const columnsApi = {
  getColumns: async (): Promise<CompColumn[]> => {
    const response = await apiRequest('GET', '/api/sales-comps/columns');
    return await response.json();
  },

  createColumn: async (column: InsertCompColumn): Promise<CompColumn> => {
    const response = await apiRequest('POST', '/api/sales-comps/columns', column);
    return await response.json();
  },

  updateColumn: async (id: string, updates: UpdateCompColumn): Promise<CompColumn> => {
    const response = await apiRequest('PATCH', `/api/sales-comps/columns/${id}`, updates);
    return await response.json();
  },

  deleteColumn: async (id: string): Promise<void> => {
    await apiRequest('DELETE', `/api/sales-comps/columns/${id}`);
  },
};

export interface ProjectWithStats extends Project {
  compCount?: number;
  lastUpdated?: string;
}

export interface ProjectCompsResponse {
  comps: (ProjectComp & {
    salesComp: SalesComp;
  })[];
}

export const savedSearchesApi = {
  getSavedSearches: async (): Promise<SavedSearch[]> => {
    const response = await apiRequest('GET', '/api/saved-searches');
    return await response.json();
  },

  getSavedSearch: async (id: string): Promise<SavedSearch> => {
    const response = await apiRequest('GET', `/api/saved-searches/${id}`);
    return await response.json();
  },

  createSavedSearch: async (search: InsertSavedSearch): Promise<SavedSearch> => {
    const response = await apiRequest('POST', '/api/saved-searches', search);
    return await response.json();
  },

  updateSavedSearch: async (id: string, updates: UpdateSavedSearch): Promise<SavedSearch> => {
    const response = await apiRequest('PATCH', `/api/saved-searches/${id}`, updates);
    return await response.json();
  },

  deleteSavedSearch: async (id: string): Promise<void> => {
    await apiRequest('DELETE', `/api/saved-searches/${id}`);
  },

  useSavedSearch: async (id: string): Promise<void> => {
    await apiRequest('POST', `/api/saved-searches/${id}/use`);
  },
};

export const projectsApi = {
  getProjects: async (): Promise<ProjectWithStats[]> => {
    const response = await apiRequest('GET', '/api/sc-projects');
    return await response.json();
  },

  getProject: async (id: string): Promise<Project> => {
    const response = await apiRequest('GET', `/api/sc-projects/${id}`);
    return await response.json();
  },

  createProject: async (project: InsertProject): Promise<{ project: Project; recommendations: any }> => {
    const response = await apiRequest('POST', '/api/sc-projects', project);
    return await response.json();
  },

  updateProject: async (id: string, updates: UpdateProject): Promise<Project> => {
    const response = await apiRequest('PUT', `/api/sc-projects/${id}`, updates);
    return await response.json();
  },

  deleteProject: async (id: string): Promise<void> => {
    await apiRequest('DELETE', `/api/sc-projects/${id}`);
  },

  getProjectComps: async (id: string): Promise<ProjectCompsResponse> => {
    const response = await apiRequest('GET', `/api/sc-projects/${id}/comps`);
    return await response.json();
  },

  addCompToProject: async (projectId: string, compData: InsertProjectComp): Promise<ProjectComp> => {
    const response = await apiRequest('POST', `/api/sc-projects/${projectId}/comps`, compData);
    return await response.json();
  },

  bulkAddCompsToProject: async (projectId: string, compIds: string[]): Promise<{ added: number; skipped: number }> => {
    const response = await apiRequest('POST', `/api/sc-projects/${projectId}/comps/bulk`, { salesCompIds: compIds });
    return await response.json();
  },

  bulkRemoveCompsFromProject: async (projectId: string, compIds: string[]): Promise<{ removed: number }> => {
    const response = await apiRequest('DELETE', `/api/sc-projects/${projectId}/comps/bulk`, { compIds });
    return await response.json();
  },

  removeCompFromProject: async (projectId: string, compId: string): Promise<void> => {
    await apiRequest('DELETE', `/api/sc-projects/${projectId}/comps/${compId}`);
  },

  autoPopulateProject: async (projectId: string, options?: { limit?: number; minScore?: number }): Promise<{
    success: boolean;
    addedCount: number;
    skippedCount: number;
    totalRecommendations: number;
    message: string;
  }> => {
    const response = await apiRequest('POST', `/api/sc-projects/${projectId}/auto-populate`, options || {});
    return await response.json();
  },
};

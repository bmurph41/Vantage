import { apiRequest } from "@/lib/queryClient";
import type { 
  RateComp, 
  InsertRateComp, 
  UpdateRateComp,
  RcColumn,
  InsertRcColumn,
  UpdateRcColumn,
  RcImport,
  RcProject,
  InsertRcProject,
  UpdateRcProject,
  RcProjectComp,
  InsertRcProjectComp,
  RcSavedSearch,
  InsertRcSavedSearch,
  UpdateRcSavedSearch
} from "@shared/schema";

export interface CompsResponse {
  comps: RateComp[];
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

export const rateCompsApi = {
  getAllIds: async (): Promise<{ ids: string[] }> => {
    const response = await apiRequest('GET', '/api/rate-comps/ids');
    return await response.json();
  },

  getComps: async (params: FilterParams = {}): Promise<CompsResponse> => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          searchParams.append(key, JSON.stringify(value));
        } else if (key === 'columnFilters' && typeof value === 'object') {
          searchParams.append(key, JSON.stringify(value));
        } else {
          searchParams.append(key, value.toString());
        }
      }
    });
    
    const response = await apiRequest('GET', `/api/rate-comps?${searchParams}`);
    return await response.json();
  },

  getComp: async (id: string): Promise<RateComp> => {
    const response = await apiRequest('GET', `/api/rate-comps/${id}`);
    return await response.json();
  },

  createComp: async (comp: InsertRateComp): Promise<RateComp> => {
    const response = await apiRequest('POST', '/api/rate-comps', comp);
    return await response.json();
  },

  updateComp: async (id: string, updates: UpdateRateComp): Promise<RateComp> => {
    const response = await apiRequest('PATCH', `/api/rate-comps/${id}`, updates);
    return await response.json();
  },

  deleteComp: async (id: string): Promise<void> => {
    await apiRequest('DELETE', `/api/rate-comps/${id}`);
  },

  bulkUpdate: async (ids: string[], updates: UpdateRateComp): Promise<{ updated: number }> => {
    const response = await apiRequest('POST', '/api/rate-comps/bulk-update', { ids, updates });
    return await response.json();
  },

  bulkDelete: async (ids: string[]): Promise<{ deleted: number }> => {
    const response = await apiRequest('POST', '/api/rate-comps/bulk-delete', { ids });
    return await response.json();
  },

  getColumnUniqueValues: async (column: string): Promise<{ values: string[] }> => {
    const response = await apiRequest('GET', `/api/rate-comps/column-values/${column}`);
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
    
    const response = await fetch('/api/rate-comps/upload', {
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
    const response = await apiRequest('POST', `/api/rate-comps/import/${importId}/detect-duplicates`, {
      mapping,
      normalization,
    });
    return await response.json();
  },

  commitImport: async (importId: string, mapping: Record<string, string>, normalization: any, excludedRows: number[] = [], parentPortfolioId?: string): Promise<any> => {
    const response = await apiRequest('POST', `/api/rate-comps/import/${importId}/commit`, {
      mapping,
      normalization,
      excludedRows,
      parentPortfolioId,
    });
    return await response.json();
  },

  getImportStatus: async (importId: string): Promise<RcImport> => {
    const response = await apiRequest('GET', `/api/rate-comps/import/${importId}/status`);
    return await response.json();
  },
};

export const columnsApi = {
  getColumns: async (): Promise<RcColumn[]> => {
    const response = await apiRequest('GET', '/api/rate-comps/columns');
    return await response.json();
  },

  createColumn: async (column: InsertRcColumn): Promise<RcColumn> => {
    const response = await apiRequest('POST', '/api/rate-comps/columns', column);
    return await response.json();
  },

  updateColumn: async (id: string, updates: UpdateRcColumn): Promise<RcColumn> => {
    const response = await apiRequest('PATCH', `/api/rate-comps/columns/${id}`, updates);
    return await response.json();
  },

  deleteColumn: async (id: string): Promise<void> => {
    await apiRequest('DELETE', `/api/rate-comps/columns/${id}`);
  },
};

export interface ProjectWithStats extends RcProject {
  compCount?: number;
  lastUpdated?: string;
}

export interface ProjectCompsResponse {
  comps: (RcProjectComp & {
    rateComp: RateComp;
  })[];
}

export const savedSearchesApi = {
  getSavedSearches: async (): Promise<RcSavedSearch[]> => {
    const response = await apiRequest('GET', '/api/rc-saved-searches');
    return await response.json();
  },

  getSavedSearch: async (id: string): Promise<RcSavedSearch> => {
    const response = await apiRequest('GET', `/api/rc-saved-searches/${id}`);
    return await response.json();
  },

  createSavedSearch: async (search: InsertRcSavedSearch): Promise<RcSavedSearch> => {
    const response = await apiRequest('POST', '/api/rc-saved-searches', search);
    return await response.json();
  },

  updateSavedSearch: async (id: string, updates: UpdateRcSavedSearch): Promise<RcSavedSearch> => {
    const response = await apiRequest('PATCH', `/api/rc-saved-searches/${id}`, updates);
    return await response.json();
  },

  deleteSavedSearch: async (id: string): Promise<void> => {
    await apiRequest('DELETE', `/api/rc-saved-searches/${id}`);
  },

  useSavedSearch: async (id: string): Promise<void> => {
    await apiRequest('POST', `/api/rc-saved-searches/${id}/use`);
  },
};

export const projectsApi = {
  getProjects: async (): Promise<ProjectWithStats[]> => {
    const response = await apiRequest('GET', '/api/rc-projects');
    return await response.json();
  },

  getProject: async (id: string): Promise<RcProject> => {
    const response = await apiRequest('GET', `/api/rc-projects/${id}`);
    return await response.json();
  },

  createProject: async (project: InsertRcProject): Promise<{ project: RcProject; recommendations: any }> => {
    const response = await apiRequest('POST', '/api/rc-projects', project);
    return await response.json();
  },

  updateProject: async (id: string, updates: UpdateRcProject): Promise<RcProject> => {
    const response = await apiRequest('PUT', `/api/rc-projects/${id}`, updates);
    return await response.json();
  },

  deleteProject: async (id: string): Promise<void> => {
    await apiRequest('DELETE', `/api/rc-projects/${id}`);
  },

  getProjectComps: async (id: string): Promise<ProjectCompsResponse> => {
    const response = await apiRequest('GET', `/api/rc-projects/${id}/comps`);
    return await response.json();
  },

  addCompToProject: async (projectId: string, compData: InsertRcProjectComp): Promise<RcProjectComp> => {
    const response = await apiRequest('POST', `/api/rc-projects/${projectId}/comps`, compData);
    return await response.json();
  },

  bulkAddCompsToProject: async (projectId: string, compIds: string[]): Promise<{ added: number; skipped: number }> => {
    const response = await apiRequest('POST', `/api/rc-projects/${projectId}/comps/bulk`, { rateCompIds: compIds });
    return await response.json();
  },

  bulkRemoveCompsFromProject: async (projectId: string, compIds: string[]): Promise<{ removed: number }> => {
    const response = await apiRequest('DELETE', `/api/rc-projects/${projectId}/comps/bulk`, { compIds });
    return await response.json();
  },

  removeCompFromProject: async (projectId: string, compId: string): Promise<void> => {
    await apiRequest('DELETE', `/api/rc-projects/${projectId}/comps/${compId}`);
  },
};

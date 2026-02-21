/**
 * Query Key Factory - Standardized cache invalidation across all modules
 * Phase 1B: Architecture Consolidation
 * 
 * This factory provides a consistent structure for TanStack Query keys,
 * enabling predictable cache invalidation patterns across cross-module relationships.
 * 
 * Usage:
 * - queryKey: queryKeys.crm.contacts.all()
 * - queryKey: queryKeys.crm.contacts.detail(contactId)
 * - invalidateQueries({ queryKey: queryKeys.crm.contacts.all() })
 */

export const queryKeys = {
  // CRM Module
  crm: {
    contacts: {
      all: () => ['/api/contacts'] as const,
      list: (filters?: Record<string, unknown>) => ['/api/contacts', { filters }] as const,
      detail: (id: string) => ['/api/contacts', id] as const,
      activities: (id: string) => ['/api/contacts', id, 'activities'] as const,
      deals: (id: string) => ['/api/contacts', id, 'deals'] as const,
      properties: (id: string) => ['/api/contacts', id, 'properties'] as const,
      pending: () => ['/api/crm/pending-contacts'] as const,
    },
    companies: {
      all: () => ['/api/companies'] as const,
      list: (filters?: Record<string, unknown>) => ['/api/companies', { filters }] as const,
      detail: (id: string) => ['/api/companies', id] as const,
      contacts: (id: string) => ['/api/companies', id, 'contacts'] as const,
      properties: (id: string) => ['/api/companies', id, 'properties'] as const,
      deals: (id: string) => ['/api/companies', id, 'deals'] as const,
      pending: () => ['/api/crm/pending-companies'] as const,
    },
    properties: {
      all: () => ['/api/properties'] as const,
      list: (filters?: Record<string, unknown>) => ['/api/properties', { filters }] as const,
      detail: (id: string) => ['/api/properties', id] as const,
      contacts: (id: string) => ['/api/properties', id, 'contacts'] as const,
      companies: (id: string) => ['/api/properties', id, 'companies'] as const,
      pending: () => ['/api/crm/pending-properties'] as const,
    },
    deals: {
      all: () => ['/api/deals'] as const,
      list: (filters?: Record<string, unknown>) => ['/api/deals', { filters }] as const,
      detail: (id: string) => ['/api/deals', id] as const,
      contacts: (id: string) => ['/api/deals', id, 'contacts'] as const,
      companies: (id: string) => ['/api/deals', id, 'companies'] as const,
      activities: (id: string) => ['/api/deals', id, 'activities'] as const,
      project: (id: string) => ['/api/deals', id, 'project'] as const, // Linked DD project
      modeling: (id: string) => ['/api/deals', id, 'modeling'] as const, // Linked modeling project
    },
    pipelines: {
      all: () => ['/api/crm/pipelines'] as const,
      detail: (id: string) => ['/api/crm/pipelines', id] as const,
      stages: (pipelineId: string) => ['/api/crm/pipelines', pipelineId, 'stages'] as const,
    },
    activities: {
      all: () => ['/api/activities'] as const,
      list: (filters?: Record<string, unknown>) => ['/api/activities', { filters }] as const,
      detail: (id: string) => ['/api/activities', id] as const,
    },
    lists: {
      all: () => ['/api/crm/lists'] as const,
      detail: (id: string) => ['/api/crm/lists', id] as const,
      members: (id: string) => ['/api/crm/lists', id, 'members'] as const,
    },
  },

  // Due Diligence Module
  dd: {
    projects: {
      all: () => ['/api/projects'] as const,
      list: (filters?: Record<string, unknown>) => ['/api/projects', { filters }] as const,
      detail: (id: string) => ['/api/projects', id] as const,
      tasks: (projectId: string) => ['/api/projects', projectId, 'tasks'] as const,
      timeline: (projectId: string) => ['/api/projects', projectId, 'timeline'] as const,
      deal: (projectId: string) => ['/api/projects', projectId, 'deal'] as const, // Linked CRM deal
      property: (projectId: string) => ['/api/projects', projectId, 'property'] as const, // Linked property
      modeling: (projectId: string) => ['/api/projects', projectId, 'modeling'] as const, // Linked modeling project
    },
    tasks: {
      all: () => ['/api/tasks'] as const,
      detail: (id: string) => ['/api/tasks', id] as const,
      byProject: (projectId: string) => ['/api/projects', projectId, 'tasks'] as const,
    },
    templates: {
      all: () => ['/api/project-templates'] as const,
      detail: (id: string) => ['/api/project-templates', id] as const,
    },
    fees: {
      byProject: (projectId: string) => ['/api/dd-fees', { projectId }] as const,
      detail: (id: string) => ['/api/dd-fees', id] as const,
    },
  },

  // Modeling Module
  modeling: {
    projects: {
      all: () => ['/api/modeling-projects'] as const,
      list: (filters?: Record<string, unknown>) => ['/api/modeling-projects', { filters }] as const,
      detail: (id: string) => ['/api/modeling-projects', id] as const,
      cases: (projectId: string) => ['/api/modeling-projects', projectId, 'cases'] as const,
      assumptions: (projectId: string) => ['/api/modeling-projects', projectId, 'assumptions'] as const,
      addbacks: (projectId: string) => ['/api/modeling-projects', projectId, 'addbacks'] as const,
      proforma: (projectId: string) => ['/api/modeling-projects', projectId, 'proforma'] as const,
      deal: (projectId: string) => ['/api/modeling-projects', projectId, 'deal'] as const, // Linked CRM deal
      ddProject: (projectId: string) => ['/api/modeling-projects', projectId, 'dd-project'] as const, // Linked DD project
      property: (projectId: string) => ['/api/modeling-projects', projectId, 'property'] as const, // Linked property
    },
    regions: {
      all: () => ['/api/modeling-regions'] as const,
    },
    pnl: {
      documents: () => ['/api/pnl/documents'] as const,
      document: (id: string) => ['/api/pnl/documents', id] as const,
      statements: (documentId: string) => ['/api/pnl/documents', documentId, 'statements'] as const,
      reviewQueue: () => ['/api/pnl/review'] as const,
    },
    omBuilder: {
      all: (params?: { userId?: string; organizationId?: string }) => 
        ['/api/om-builder/oms', params] as const,
      detail: (omId: string) => ['/api/om-builder/oms', omId] as const,
      full: (omId: string) => ['/api/om-builder/oms', omId, 'full'] as const,
      versions: (omId: string) => ['/api/om-builder/oms', omId, 'versions'] as const,
      brandKits: (params?: { userId?: string; organizationId?: string }) =>
        ['/api/om-builder/brand-kits', params] as const,
      assets: (params?: { organizationId?: string; userId?: string; folder?: string }) =>
        ['/api/om-builder/assets', params] as const,
      templates: (scope?: string) => ['/api/om-builder/templates', { scope }] as const,
    },
  },

  // Docket Module
  docket: {
    articles: {
      all: () => ['/api/docket/articles'] as const,
      list: (filters?: Record<string, unknown>) => ['/api/docket/articles', { filters }] as const,
      detail: (id: number) => ['/api/docket/articles', id] as const,
      trending: () => ['/api/docket/articles/trending'] as const,
      byEntity: (entityType: string, entityId: string) => 
        ['/api/docket/articles', 'by-entity', entityType, entityId] as const,
    },
    crmLinks: {
      byArticle: (articleId: number) => ['/api/docket/articles', articleId, 'crm-links'] as const,
      byEntity: (entityType: string, entityId: string) => 
        ['/api/docket/crm-links', entityType, entityId] as const,
    },
    categories: {
      all: () => ['/api/docket/categories/all'] as const,
    },
    sources: {
      all: () => ['/api/docket/sources'] as const,
      detail: (id: number) => ['/api/docket/sources', id] as const,
    },
    watchlists: {
      all: () => ['/api/docket/watchlists'] as const,
      detail: (id: string) => ['/api/docket/watchlists', id] as const,
    },
    savedSearches: {
      all: () => ['/api/docket/saved-searches'] as const,
      detail: (id: string) => ['/api/docket/saved-searches', id] as const,
    },
    analytics: {
      stats: () => ['/api/docket/analytics/stats'] as const,
    },
    notifications: {
      preferences: () => ['/api/docket/notification-preferences'] as const,
    },
  },

  // Sales Comps Module
  salesComps: {
    all: () => ['/api/sales-comps'] as const,
    list: (filters?: Record<string, unknown>) => ['/api/sales-comps', { filters }] as const,
    detail: (id: string) => ['/api/sales-comps', id] as const,
    projects: {
      all: () => ['/api/sc-projects'] as const,
      detail: (id: string) => ['/api/sc-projects', id] as const,
      comps: (projectId: string) => ['/api/sc-projects', projectId, 'comps'] as const,
    },
    pendingProfiles: () => ['/api/sales-comps/pending-property-profiles'] as const,
  },

  // Rate Comps Module
  rateComps: {
    all: () => ['/api/rate-comps'] as const,
    list: (filters?: Record<string, unknown>) => ['/api/rate-comps', { filters }] as const,
    detail: (id: string) => ['/api/rate-comps', id] as const,
    projects: {
      all: () => ['/api/rc-projects'] as const,
      detail: (id: string) => ['/api/rc-projects', id] as const,
      comps: (projectId: string) => ['/api/rc-projects', projectId, 'comps'] as const,
    },
  },

  // Rent Roll / RRA Module
  rentRoll: {
    locations: {
      all: () => ['/api/rra/locations'] as const,
      detail: (id: string) => ['/api/rra/locations', id] as const,
    },
    units: {
      byLocation: (locationId: string) => ['/api/rra/locations', locationId, 'units'] as const,
    },
    analytics: {
      customer: (locationId: string) => ['/api/rra/locations', locationId, 'analytics/customer'] as const,
    },
  },

  // Fund Management Module
  funds: {
    all: () => ['/api/funds'] as const,
    detail: (id: string) => ['/api/funds', id] as const,
    investments: (fundId: string) => ['/api/funds', fundId, 'investments'] as const,
    investors: (fundId: string) => ['/api/funds', fundId, 'investors'] as const,
  },

  // Virtual Data Room (VDR) Module
  vdr: {
    projects: {
      all: () => ['/api/vdr/projects'] as const,
      detail: (id: string) => ['/api/vdr/projects', id] as const,
    },
    folders: {
      byProject: (projectId: string) => ['/api/vdr/projects', projectId, 'folders'] as const,
    },
    files: {
      byFolder: (projectId: string, folderId: string) => 
        ['/api/vdr/projects', projectId, 'folders', folderId, 'files'] as const,
    },
  },

  // Analytics & Dashboard
  analytics: {
    kpis: () => ['/api/analytics/kpis'] as const,
    dashboard: () => ['/api/analytics/dashboard'] as const,
    widgets: () => ['/api/dashboard/widgets'] as const,
    snapshots: (params?: Record<string, unknown>) => ['/api/analytics/snapshots', params] as const,
  },

  // Bootstrap / App State
  app: {
    bootstrap: () => ['/api/bootstrap'] as const,
    user: () => ['/api/user'] as const,
    organization: () => ['/api/organization'] as const,
  },
} as const;

/**
 * Helper to invalidate all queries for a specific entity type
 * Useful when an entity is updated and related queries need to be refreshed
 */
export function getRelatedInvalidationKeys(entityType: 'contact' | 'company' | 'property' | 'deal' | 'project', entityId: string) {
  const keys: unknown[][] = [];
  
  switch (entityType) {
    case 'contact':
      keys.push(
        queryKeys.crm.contacts.all(),
        queryKeys.crm.contacts.detail(entityId),
        queryKeys.crm.contacts.activities(entityId),
        queryKeys.crm.contacts.deals(entityId),
        queryKeys.crm.contacts.properties(entityId),
        queryKeys.docket.crmLinks.byEntity('contact', entityId),
      );
      break;
    case 'company':
      keys.push(
        queryKeys.crm.companies.all(),
        queryKeys.crm.companies.detail(entityId),
        queryKeys.crm.companies.contacts(entityId),
        queryKeys.crm.companies.properties(entityId),
        queryKeys.crm.companies.deals(entityId),
        queryKeys.docket.crmLinks.byEntity('company', entityId),
      );
      break;
    case 'property':
      keys.push(
        queryKeys.crm.properties.all(),
        queryKeys.crm.properties.detail(entityId),
        queryKeys.crm.properties.contacts(entityId),
        queryKeys.crm.properties.companies(entityId),
        queryKeys.docket.crmLinks.byEntity('property', entityId),
      );
      break;
    case 'deal':
      keys.push(
        queryKeys.crm.deals.all(),
        queryKeys.crm.deals.detail(entityId),
        queryKeys.crm.deals.contacts(entityId),
        queryKeys.crm.deals.companies(entityId),
        queryKeys.crm.deals.activities(entityId),
        queryKeys.crm.deals.project(entityId),
        queryKeys.crm.deals.modeling(entityId),
        queryKeys.docket.crmLinks.byEntity('deal', entityId),
      );
      break;
    case 'project':
      keys.push(
        queryKeys.dd.projects.all(),
        queryKeys.dd.projects.detail(entityId),
        queryKeys.dd.projects.tasks(entityId),
        queryKeys.dd.projects.deal(entityId),
        queryKeys.dd.projects.property(entityId),
        queryKeys.dd.projects.modeling(entityId),
      );
      break;
  }
  
  return keys;
}

export type QueryKeys = typeof queryKeys;

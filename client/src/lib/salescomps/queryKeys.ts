export const queryKeys = {
  comps: {
    all: ['comps'] as const,
    lists: () => [...queryKeys.comps.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.comps.lists(), filters] as const,
    details: () => [...queryKeys.comps.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.comps.details(), id] as const,
    portfolios: ['comps', 'portfolios'] as const,
  },
  
  columns: {
    all: ['columns'] as const,
    list: () => [...queryKeys.columns.all, 'list'] as const,
  },

  imports: {
    all: ['imports'] as const,
    status: (id: string) => [...queryKeys.imports.all, 'status', id] as const,
  },

  projects: {
    all: ['projects'] as const,
    lists: () => [...queryKeys.projects.all, 'list'] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.projects.lists(), filters || {}] as const,
    details: () => [...queryKeys.projects.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.projects.details(), id] as const,
    comps: (id: string) => [...queryKeys.projects.detail(id), 'comps'] as const,
  },

  metrics: {
    all: ['metrics'] as const,
    
    available: () => [...queryKeys.metrics.all, 'available'] as const,
    
    series: {
      all: () => [...queryKeys.metrics.all, 'series'] as const,
      lists: () => [...queryKeys.metrics.series.all(), 'list'] as const,
      list: (filters: Record<string, any>) => [...queryKeys.metrics.series.lists(), filters] as const,
      details: () => [...queryKeys.metrics.series.all(), 'detail'] as const,
      detail: (key: string) => [...queryKeys.metrics.series.details(), key] as const,
      
      data: (key: string, query?: Record<string, any>) => [
        ...queryKeys.metrics.series.detail(key), 
        'data', 
        query || {}
      ] as const,
    },
    
    points: {
      all: () => [...queryKeys.metrics.all, 'points'] as const,
      series: (seriesId: string, query?: Record<string, any>) => [
        ...queryKeys.metrics.points.all(), 
        'series', 
        seriesId, 
        query || {}
      ] as const,
    },
    
    alerts: {
      all: () => [...queryKeys.metrics.all, 'alerts'] as const,
      lists: () => [...queryKeys.metrics.alerts.all(), 'list'] as const,
      list: (filters: Record<string, any>) => [...queryKeys.metrics.alerts.lists(), filters] as const,
      details: () => [...queryKeys.metrics.alerts.all(), 'detail'] as const,
      detail: (id: string) => [...queryKeys.metrics.alerts.details(), id] as const,
      series: (seriesId: string, filters?: Record<string, any>) => [...queryKeys.metrics.alerts.all(), 'series', seriesId, filters || {}] as const,
    },
    
    snapshot: (filters?: Record<string, any>) => [
      ...queryKeys.metrics.all, 
      'snapshot', 
      filters || {}
    ] as const,
    
    search: (params: Record<string, any>) => [
      ...queryKeys.metrics.all, 
      'search', 
      params
    ] as const,
    
    derived: {
      all: () => [...queryKeys.metrics.all, 'derived'] as const,
      medianCapRate: (query?: Record<string, any>) => [
        ...queryKeys.metrics.derived.all(), 
        'median-cap-rate', 
        query || {}
      ] as const,
      medianSalePrice: (query?: Record<string, any>) => [
        ...queryKeys.metrics.derived.all(), 
        'median-sale-price', 
        query || {}
      ] as const,
      metric: (metricType: string, query?: Record<string, any>) => [
        ...queryKeys.metrics.derived.all(), 
        metricType, 
        query || {}
      ] as const,
    },
    
    timeseries: {
      all: () => [...queryKeys.metrics.all, 'timeseries'] as const,
      metric: (metricKey: string, options?: Record<string, any>) => [
        ...queryKeys.metrics.timeseries.all(), 
        metricKey, 
        options || {}
      ] as const,
    },
  },
  
  scheduler: {
    all: ['scheduler'] as const,
    status: () => [...queryKeys.scheduler.all, 'status'] as const,
    jobs: {
      all: () => [...queryKeys.scheduler.all, 'jobs'] as const,
      history: (jobName?: string, limit?: number) => [
        ...queryKeys.scheduler.jobs.all(), 
        'history', 
        { jobName, limit }
      ] as const,
    },
  },
} as const;

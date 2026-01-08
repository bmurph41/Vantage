export type MapModule = 'sale_comps' | 'rate_comps' | 'demographics';

export type LayerType = 'subject' | 'sale_comp' | 'rate_comp' | 'poi' | 'census_tract';

export interface MapItem {
  id: string;
  module: MapModule;
  layerType: LayerType;
  title: string;
  lat: number;
  lng: number;
  address?: string;
  city?: string;
  state?: string;
  metrics: Record<string, unknown>;
  isSubject?: boolean;
}

export interface MapFilters {
  radius?: number;
  minPrice?: number;
  maxPrice?: number;
  minYear?: number;
  maxYear?: number;
  states?: string[];
  waterTypes?: string[];
  storageTypes?: string[];
  minWetSlips?: number;
  maxWetSlips?: number;
  minDryRacks?: number;
  maxDryRacks?: number;
  regions?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export interface MapConfig {
  module: MapModule;
  defaultVisibleLayers: LayerType[];
  filterSchema: MapFilters;
  endpoint: string;
  metricsConfig: {
    popup: string[];
    card: string[];
    sort: string[];
  };
  colors: {
    [key in LayerType]?: string;
  };
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface ClusterMarker {
  id: string;
  lat: number;
  lng: number;
  count: number;
  items: MapItem[];
}

export const SALE_COMPS_CONFIG: MapConfig = {
  module: 'sale_comps',
  defaultVisibleLayers: ['subject', 'sale_comp'],
  filterSchema: {},
  endpoint: '/api/sales-comps',
  metricsConfig: {
    popup: ['salePrice', 'saleYear', 'capRate', 'wetSlips', 'dryRacks'],
    card: ['salePrice', 'city', 'state', 'saleYear', 'wetSlips', 'dryRacks'],
    sort: ['salePrice', 'saleYear', 'wetSlips', 'dryRacks', 'city', 'state'],
  },
  colors: {
    subject: '#EA4335',
    sale_comp: '#4285F4',
  },
};

export const RATE_COMPS_CONFIG: MapConfig = {
  module: 'rate_comps',
  defaultVisibleLayers: ['subject', 'rate_comp'],
  filterSchema: {},
  endpoint: '/api/rate-comps',
  metricsConfig: {
    popup: ['marina', 'rateType', 'wetSlips', 'dryRacks', 'city', 'state'],
    card: ['marina', 'city', 'state', 'rateType', 'wetSlips', 'dryRacks'],
    sort: ['marina', 'city', 'state', 'wetSlips', 'dryRacks'],
  },
  colors: {
    subject: '#EA4335',
    rate_comp: '#34A853',
  },
};

export const formatMetricValue = (key: string, value: unknown): string => {
  if (value === null || value === undefined) return 'N/A';
  
  if (key === 'salePrice' || key === 'listPrice' || key === 'noi') {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      maximumFractionDigits: 0 
    }).format(Number(value));
  }
  
  if (key === 'capRate') {
    return `${(Number(value) / 100).toFixed(2)}%`;
  }
  
  if (key === 'saleYear' || key === 'saleMonth') {
    return String(value);
  }
  
  return String(value);
};

export const formatMetricLabel = (key: string): string => {
  const labels: Record<string, string> = {
    salePrice: 'Sale Price',
    listPrice: 'List Price',
    capRate: 'Cap Rate',
    noi: 'NOI',
    wetSlips: 'Wet Slips',
    dryRacks: 'Dry Racks',
    saleYear: 'Sale Year',
    saleMonth: 'Sale Month',
    city: 'City',
    state: 'State',
    region: 'Region',
    marina: 'Marina',
    rateType: 'Rate Type',
    waterType: 'Water Type',
    acres: 'Acres',
  };
  return labels[key] || key;
};

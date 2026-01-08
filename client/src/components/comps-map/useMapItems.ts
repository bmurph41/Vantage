import { useQuery } from '@tanstack/react-query';
import type { MapItem, MapFilters, MapConfig, LayerType } from './types';
import type { SalesComp, RateComp } from '@shared/schema';

interface UseMapItemsOptions {
  config: MapConfig;
  filters: MapFilters;
  enabled?: boolean;
}

export function useMapItems({ config, filters, enabled = true }: UseMapItemsOptions) {
  const endpoint = config.module === 'sale_comps' 
    ? '/api/sales-comps' 
    : '/api/rate-comps';

  const queryKey = [endpoint, 'map', filters];

  return useQuery<MapItem[]>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (filters.states?.length) {
        params.set('states', filters.states.join(','));
      }
      if (filters.minPrice) params.set('minPrice', String(filters.minPrice));
      if (filters.maxPrice) params.set('maxPrice', String(filters.maxPrice));
      if (filters.minYear) params.set('minYear', String(filters.minYear));
      if (filters.maxYear) params.set('maxYear', String(filters.maxYear));
      if (filters.waterTypes?.length) {
        params.set('waterTypes', filters.waterTypes.join(','));
      }
      if (filters.regions?.length) {
        params.set('regions', filters.regions.join(','));
      }
      if (filters.minWetSlips) params.set('minWetSlips', String(filters.minWetSlips));
      if (filters.maxWetSlips) params.set('maxWetSlips', String(filters.maxWetSlips));
      if (filters.minDryRacks) params.set('minDryRacks', String(filters.minDryRacks));
      if (filters.maxDryRacks) params.set('maxDryRacks', String(filters.maxDryRacks));

      const url = `${endpoint}?${params.toString()}`;
      const response = await fetch(url, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch map items');
      }

      const data = await response.json();
      const items: (SalesComp | RateComp)[] = data.comps || data.items || data || [];

      return items
        .filter(item => item.lat && item.lng)
        .map(item => transformToMapItem(item, config));
    },
    enabled,
    staleTime: 30000,
  });
}

function transformToMapItem(
  item: SalesComp | RateComp,
  config: MapConfig
): MapItem {
  const layerType: LayerType = config.module === 'sale_comps' ? 'sale_comp' : 'rate_comp';

  return {
    id: item.id,
    module: config.module,
    layerType,
    title: item.marina,
    lat: Number(item.lat),
    lng: Number(item.lng),
    address: item.address || undefined,
    city: item.city || undefined,
    state: item.state || undefined,
    metrics: {
      marina: item.marina,
      salePrice: item.salePrice,
      capRate: item.capRate,
      noi: item.noi,
      wetSlips: item.wetSlips,
      dryRacks: item.dryRacks,
      saleYear: item.saleYear,
      saleMonth: item.saleMonth,
      city: item.city,
      state: item.state,
      region: item.region,
      waterType: item.waterType || item.coastalType,
      acres: item.acres,
      listPrice: item.listPrice,
    },
  };
}

export function useSubjectProperty(propertyId?: string, config?: MapConfig) {
  return useQuery<MapItem | null>({
    queryKey: ['/api/crm/properties', propertyId, 'map'],
    queryFn: async () => {
      if (!propertyId) return null;
      
      const response = await fetch(`/api/crm/properties/${propertyId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        return null;
      }

      const property = await response.json();
      
      if (!property.lat || !property.lng) {
        return null;
      }

      return {
        id: property.id,
        module: config?.module || 'sale_comps',
        layerType: 'subject' as LayerType,
        title: property.title || property.name || 'Subject Property',
        lat: Number(property.lat),
        lng: Number(property.lng),
        address: property.address,
        city: property.city,
        state: property.state,
        metrics: {},
        isSubject: true,
      };
    },
    enabled: !!propertyId,
  });
}

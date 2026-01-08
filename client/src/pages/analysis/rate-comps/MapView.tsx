import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CompsMap, RATE_COMPS_CONFIG } from '@/components/comps-map';
import type { MapFilters, MapItem } from '@/components/comps-map/types';
import RateCompsHeader from '@/components/ratecomps/rate-comps/RateCompsHeader';
import type { RateComp } from '@shared/schema';

export default function RateCompsMapView() {
  const [filters, setFilters] = useState<MapFilters>(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      states: params.get('states')?.split(',').filter(Boolean) || undefined,
      radius: params.get('radius') ? Number(params.get('radius')) : undefined,
      waterTypes: params.get('waterTypes')?.split(',').filter(Boolean) || undefined,
      regions: params.get('regions')?.split(',').filter(Boolean) || undefined,
      minWetSlips: params.get('minWetSlips') ? Number(params.get('minWetSlips')) : undefined,
      maxWetSlips: params.get('maxWetSlips') ? Number(params.get('maxWetSlips')) : undefined,
      minDryRacks: params.get('minDryRacks') ? Number(params.get('minDryRacks')) : undefined,
      maxDryRacks: params.get('maxDryRacks') ? Number(params.get('maxDryRacks')) : undefined,
    };
  });

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.states?.length) params.set('states', filters.states.join(','));
    if (filters.radius) params.set('radius', String(filters.radius));
    if (filters.waterTypes?.length) params.set('waterTypes', filters.waterTypes.join(','));
    if (filters.regions?.length) params.set('regions', filters.regions.join(','));
    if (filters.minWetSlips) params.set('minWetSlips', String(filters.minWetSlips));
    if (filters.maxWetSlips) params.set('maxWetSlips', String(filters.maxWetSlips));
    if (filters.minDryRacks) params.set('minDryRacks', String(filters.minDryRacks));
    if (filters.maxDryRacks) params.set('maxDryRacks', String(filters.maxDryRacks));

    const queryString = params.toString();
    const newUrl = queryString 
      ? `${window.location.pathname}?${queryString}`
      : window.location.pathname;
    
    window.history.replaceState(null, '', newUrl);
  }, [filters]);

  const { data: rateComps = [], isLoading } = useQuery<RateComp[]>({
    queryKey: ['/api/rate-comps', 'map', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.states?.length) params.set('states', filters.states.join(','));
      if (filters.waterTypes?.length) params.set('waterTypes', filters.waterTypes.join(','));
      if (filters.regions?.length) params.set('regions', filters.regions.join(','));
      if (filters.minWetSlips) params.set('wetSlipsMin', String(filters.minWetSlips));
      if (filters.maxWetSlips) params.set('wetSlipsMax', String(filters.maxWetSlips));
      if (filters.minDryRacks) params.set('dryRacksMin', String(filters.minDryRacks));
      if (filters.maxDryRacks) params.set('dryRacksMax', String(filters.maxDryRacks));
      params.set('limit', '500');

      const response = await fetch(`/api/rate-comps?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to fetch rate comps');
      const data = await response.json();
      return data.comps || [];
    },
    staleTime: 30000,
  });

  const mapItems: MapItem[] = rateComps
    .filter(comp => comp.lat && comp.lng)
    .map(comp => ({
      id: comp.id,
      module: 'rate_comps' as const,
      layerType: 'rate_comp' as const,
      title: comp.marina,
      lat: Number(comp.lat),
      lng: Number(comp.lng),
      address: comp.address || undefined,
      city: comp.city || undefined,
      state: comp.state || undefined,
      metrics: {
        marina: comp.marina,
        wetSlips: comp.wetSlips,
        dryRacks: comp.dryRacks,
        city: comp.city,
        state: comp.state,
        region: comp.region,
        waterType: comp.waterType,
        rateType: comp.rateType,
        website: comp.website,
        source: comp.source,
      },
    }));

  return (
    <div className="flex flex-col h-screen" data-testid="rate-comps-map-page">
      <RateCompsHeader
        total={rateComps.length}
        hasData={rateComps.length > 0}
      />

      <div className="flex-1 overflow-hidden">
        <CompsMap
          config={RATE_COMPS_CONFIG}
          items={mapItems}
          isLoading={isLoading}
          filters={filters}
          onFiltersChange={setFilters}
        />
      </div>
    </div>
  );
}

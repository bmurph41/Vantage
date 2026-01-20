import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CompsMap, SALE_COMPS_CONFIG } from '@/components/comps-map';
import type { MapFilters, MapItem } from '@/components/comps-map/types';
import SalesCompsHeader from '@/components/salescomps/sales-comps/SalesCompsHeader';
import type { SalesComp } from '@shared/schema';

export default function SalesCompsMapView() {
  const [filters, setFilters] = useState<MapFilters>(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      states: params.get('states')?.split(',').filter(Boolean) || undefined,
      radius: params.get('radius') ? Number(params.get('radius')) : undefined,
      minPrice: params.get('minPrice') ? Number(params.get('minPrice')) : undefined,
      maxPrice: params.get('maxPrice') ? Number(params.get('maxPrice')) : undefined,
      minYear: params.get('minYear') ? Number(params.get('minYear')) : undefined,
      maxYear: params.get('maxYear') ? Number(params.get('maxYear')) : undefined,
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
    if (filters.minPrice) params.set('minPrice', String(filters.minPrice));
    if (filters.maxPrice) params.set('maxPrice', String(filters.maxPrice));
    if (filters.minYear) params.set('minYear', String(filters.minYear));
    if (filters.maxYear) params.set('maxYear', String(filters.maxYear));
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

  const { data: salesComps = [], isLoading } = useQuery<SalesComp[]>({
    queryKey: ['/api/sales-comps', 'map', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.states?.length) params.set('states', filters.states.join(','));
      if (filters.minPrice) params.set('priceMin', String(filters.minPrice));
      if (filters.maxPrice) params.set('priceMax', String(filters.maxPrice));
      if (filters.minYear) params.set('saleYearMin', String(filters.minYear));
      if (filters.maxYear) params.set('saleYearMax', String(filters.maxYear));
      if (filters.waterTypes?.length) params.set('waterTypes', filters.waterTypes.join(','));
      if (filters.regions?.length) params.set('regions', filters.regions.join(','));
      if (filters.minWetSlips) params.set('wetSlipsMin', String(filters.minWetSlips));
      if (filters.maxWetSlips) params.set('wetSlipsMax', String(filters.maxWetSlips));
      if (filters.minDryRacks) params.set('dryRacksMin', String(filters.minDryRacks));
      if (filters.maxDryRacks) params.set('dryRacksMax', String(filters.maxDryRacks));
      params.set('limit', '500');

      const response = await fetch(`/api/sales-comps?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to fetch sales comps');
      const data = await response.json();
      return data.comps || [];
    },
    staleTime: 30000,
  });

  const mapItems: MapItem[] = salesComps
    .filter(comp => comp.lat && comp.lng)
    .map(comp => ({
      id: comp.id,
      module: 'sale_comps' as const,
      layerType: 'sale_comp' as const,
      title: comp.marina,
      lat: Number(comp.lat),
      lng: Number(comp.lng),
      address: comp.address || undefined,
      city: comp.city || undefined,
      state: comp.state || undefined,
      metrics: {
        marina: comp.marina,
        salePrice: comp.salePrice,
        capRate: comp.capRate,
        noi: comp.noi,
        wetSlips: comp.wetSlips,
        dryRacks: comp.dryRacks,
        saleYear: comp.saleYear,
        saleMonth: comp.saleMonth,
        city: comp.city,
        state: comp.state,
        region: comp.region,
        waterType: comp.waterType || comp.coastalType,
        acres: comp.acres,
        listPrice: comp.listPrice,
      },
    }));

  return (
    <div className="flex flex-col h-screen" data-testid="sales-comps-map-page">
      <SalesCompsHeader
        total={salesComps.length}
        hasData={salesComps.length > 0}
      />

      <div className="flex-1 overflow-hidden" data-tour="comps-map">
        <CompsMap
          config={SALE_COMPS_CONFIG}
          items={mapItems}
          isLoading={isLoading}
          filters={filters}
          onFiltersChange={setFilters}
        />
      </div>
    </div>
  );
}

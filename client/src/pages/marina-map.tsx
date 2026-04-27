import { useLocation } from 'wouter';
import { ArrowLeft, Map as MapIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MarinaMapEmbed, { type MarinaLocation } from '@/components/marina-map/MarinaMapEmbed';

export default function MarinaMapPage() {
  const [, setLocation] = useLocation();

  const params = new URLSearchParams(window.location.search);
  const source = params.get('source') as string | null;

  const effectiveSource = source === 'projects' ? 'projects'
    : source === 'properties' ? 'properties'
    : source === 'comps' ? 'comps'
    : 'all';

  const pageTitles: Record<string, string> = {
    projects: 'Financial Model — Map View',
    properties: 'CRM Properties — Map View',
    comps: 'Sales Comps — Map View',
    all: 'All Marina Locations',
  };

  const sourceLabels: Record<string, string> = {
    projects: 'Financial Model',
    properties: 'CRM Property',
    comps: 'Sales Comp',
    all: 'Marina',
  };

  const backHrefs: Record<string, string> = {
    projects: '/modeling/projects',
    properties: '/properties',
    comps: '/analysis/sales-comps',
    all: '/dashboard',
  };

  const backLabels: Record<string, string> = {
    projects: 'Financial Model',
    properties: 'Properties',
    comps: 'Sales Comps',
    all: 'Dashboard',
  };

  const backHref = backHrefs[effectiveSource] ?? '/dashboard';
  const backLabel = backLabels[effectiveSource] ?? 'Dashboard';

  const handleLocationClick = (loc: MarinaLocation) => {
    if (loc.source === 'project') {
      setLocation(`/modeling/projects/${loc.id}`);
    } else if (loc.source === 'property') {
      setLocation(`/properties/${loc.id}`);
    } else if (loc.source === 'comp') {
      setLocation(`/analysis/sales-comps/${loc.id}`);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex items-center gap-3 px-5 py-3 border-b bg-white dark:bg-slate-900 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => setLocation(backHref)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {backLabel}
        </Button>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <MapIcon className="h-4 w-4 text-blue-600" />
          <h1 className="text-sm font-semibold">
            {pageTitles[effectiveSource] ?? 'Marina Map'}
          </h1>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <MarinaMapEmbed
          source={effectiveSource as any}
          sourceLabel={sourceLabels[effectiveSource] ?? 'Marina'}
          height="100%"
          showSearch
          showStateFilter
          showSourceFilter={effectiveSource === 'all'}
          showLayerToggles={effectiveSource === 'all'}
          showListPanel
          emptyMessage={
            effectiveSource === 'projects'
              ? 'No financial model projects with location data found. Add address info to your projects to see them here.'
              : 'No locations found.'
          }
          onLocationClick={handleLocationClick}
        />
      </div>
    </div>
  );
}

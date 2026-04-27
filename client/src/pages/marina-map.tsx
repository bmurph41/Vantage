import { useLocation } from 'wouter';
import { ArrowLeft, Map as MapIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MarinaMapEmbed, { type MarinaLocation, type MarinaMapEmbedProps } from '@/components/marina-map/MarinaMapEmbed';

type MarinaSource = MarinaMapEmbedProps['source'];

function resolveSource(raw: string | null): MarinaSource {
  if (raw === 'projects') return 'projects';
  if (raw === 'properties') return 'properties';
  if (raw === 'comps') return 'comps';
  if (raw === 'rate_comps') return 'rate_comps';
  if (raw === 'listings') return 'listings';
  if (raw === 'pipeline') return 'pipeline';
  if (raw === 'owned') return 'owned';
  return 'all';
}

const PAGE_TITLES: Record<MarinaSource, string> = {
  projects: 'Financial Model — Map View',
  properties: 'CRM Properties — Map View',
  comps: 'Sales Comps — Map View',
  rate_comps: 'Rate Comps — Map View',
  listings: 'Listings — Map View',
  pipeline: 'Pipeline Deals — Map View',
  owned: 'Owned Marinas — Map View',
  all: 'All Marina Locations',
};

const SOURCE_LABELS: Record<MarinaSource, string> = {
  projects: 'Financial Model',
  properties: 'CRM Property',
  comps: 'Sales Comp',
  rate_comps: 'Rate Comp',
  listings: 'Listing',
  pipeline: 'Pipeline Deal',
  owned: 'Marina',
  all: 'Marina',
};

const BACK_HREFS: Record<MarinaSource, string> = {
  projects: '/modeling/projects',
  properties: '/properties',
  comps: '/analysis/sales-comps',
  rate_comps: '/analysis/rate-comps',
  listings: '/dashboard',
  pipeline: '/pipeline/deal-board',
  owned: '/portfolio',
  all: '/dashboard',
};

const BACK_LABELS: Record<MarinaSource, string> = {
  projects: 'Financial Model',
  properties: 'Properties',
  comps: 'Sales Comps',
  rate_comps: 'Rate Comps',
  listings: 'Dashboard',
  pipeline: 'Deal Board',
  owned: 'Portfolio',
  all: 'Dashboard',
};

export default function MarinaMapPage() {
  const [, setLocation] = useLocation();

  const params = new URLSearchParams(window.location.search);
  const source: MarinaSource = resolveSource(params.get('source'));

  const handleLocationClick = (loc: MarinaLocation) => {
    if (loc.source === 'project') {
      setLocation(`/modeling/projects/${loc.id}`);
    } else if (loc.source === 'property') {
      setLocation(`/properties/${loc.id}`);
    } else if (loc.source === 'comp' || loc.source === 'rate_comp') {
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
          onClick={() => setLocation(BACK_HREFS[source])}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {BACK_LABELS[source]}
        </Button>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <MapIcon className="h-4 w-4 text-blue-600" />
          <h1 className="text-sm font-semibold">{PAGE_TITLES[source]}</h1>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <MarinaMapEmbed
          source={source}
          sourceLabel={SOURCE_LABELS[source]}
          height="100%"
          showSearch
          showStateFilter
          showSourceFilter={source === 'all'}
          showLayerToggles={source === 'all'}
          showListPanel
          emptyMessage={
            source === 'projects'
              ? 'No financial model projects with location data found. Add address info to your projects to see them here.'
              : 'No locations found.'
          }
          onLocationClick={handleLocationClick}
        />
      </div>
    </div>
  );
}

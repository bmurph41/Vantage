import SalesCompsHeader from '@/components/salescomps/sales-comps/SalesCompsHeader';
import MarinaMapEmbed from '@/components/marina-map/MarinaMapEmbed';
import { useLocation } from 'wouter';

export default function SalesCompsMapView() {
  const [, navigate] = useLocation();

  return (
    <div>
      <SalesCompsHeader />
      <MarinaMapEmbed
        source="comps"
        markerColor="#FBBC04"
        sourceLabel="Sales Comps"
        height="calc(100vh - 200px)"
        showSearch={true}
        showStateFilter={true}
        showSourceFilter={false}
        showLayerToggles={false}
        showListPanel={true}
        emptyMessage="No sales comps with location data found"
        onLocationClick={(loc) => {
          if (loc.id) navigate(`/analysis/sales-comps/${loc.id}`);
        }}
      />
    </div>
  );
}

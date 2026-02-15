import RateCompsHeader from '@/components/ratecomps/rate-comps/RateCompsHeader';
import MarinaMapEmbed from '@/components/marina-map/MarinaMapEmbed';
import { useLocation } from 'wouter';

export default function RateCompsMapView() {
  const [, navigate] = useLocation();

  return (
    <div>
      <RateCompsHeader />
      <MarinaMapEmbed
        source="rate_comps"
        markerColor="#34A853"
        sourceLabel="Rate Comps"
        height="calc(100vh - 200px)"
        showSearch={true}
        showStateFilter={true}
        showSourceFilter={false}
        showLayerToggles={false}
        showListPanel={true}
        emptyMessage="No rate comps with location data found"
        onLocationClick={(loc) => {
          if (loc.id) navigate(`/analysis/rate-comps/${loc.id}`);
        }}
      />
    </div>
  );
}

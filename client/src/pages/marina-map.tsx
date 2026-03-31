import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GoogleMap, Marker, MarkerClusterer, InfoWindow } from '@react-google-maps/api';
import { useGoogleMaps } from '@/lib/google-maps-provider';
import { useLocation } from 'wouter';
import {
  Anchor, Search, Filter, MapPin, Loader2, Building2, Calculator,
  BarChart3, ShoppingCart, ChevronDown, ChevronRight, X, Layers,
  Navigation, ExternalLink, DollarSign, Ship, Maximize2, List, Cpu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, CartesianGrid,
} from 'recharts';

interface MarinaLocation {
  id: string;
  source: 'property' | 'project' | 'comp' | 'listing';
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  lat: number | null;
  lng: number | null;
  price: number | null;
  slips: number | null;
  status: string | null;
  metrics: Record<string, any>;
}

interface MapStats {
  total: number;
  withCoordinates: number;
  bySource: Record<string, number>;
  byState: Record<string, number>;
}

interface MapResponse {
  locations: MarinaLocation[];
  stats: MapStats;
}

const SOURCE_COLORS: Record<string, string> = {
  property: '#4285F4',
  project: '#EA4335',
  comp: '#FBBC04',
  listing: '#34A853',
};

const SOURCE_LABELS: Record<string, string> = {
  property: 'CRM Properties',
  project: 'Financial Models',
  comp: 'Sales Comps',
  listing: 'Listings',
};

const SOURCE_ICONS: Record<string, typeof Anchor> = {
  property: Building2,
  project: Calculator,
  comp: BarChart3,
  listing: ShoppingCart,
};

const mapContainerStyle = { width: '100%', height: '100%' };
const defaultCenter = { lat: 29.7604, lng: -82.6368 };

const formatCurrency = (value: number | null): string => {
  if (!value) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
};

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
];

function createMarkerIcon(source: string, isSelected: boolean = false): google.maps.Symbol | google.maps.Icon | undefined {
  const color = SOURCE_COLORS[source] || '#666';
  const scale = isSelected ? 12 : 8;
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: isSelected ? 1 : 0.85,
    strokeColor: isSelected ? '#fff' : color,
    strokeWeight: isSelected ? 3 : 1.5,
    scale,
  };
}

// ─── INTELLIGENCE VIEW HELPERS ────────────────────────────────────────────────

const INTEL_TIER_COLOR: Record<string, string> = {
  'A+': '#00f5a0',
  'A': '#4ade80',
  'B': '#facc15',
  'C': '#f87171',
};

const INTEL_STATUS_COLOR: Record<string, string> = {
  'active': '#4ade80',
  'stabilized': '#00f5a0',
  'value-add': '#facc15',
  'distressed': '#f87171',
};

interface IntelProperty {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  slips: number;
  status: string;
  price: number | null;
  capRate: number | null;
  noi: number | null;
  source: string;
  score: number;
  tier: string;
  rawMetrics: Record<string, any>;
}

function normalizeCapRate(raw: any): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  if (isNaN(n) || n === 0) return null;
  // If stored in basis points (e.g. 718 = 7.18%), convert to percent
  return n > 50 ? n / 100 : n;
}

function computeScore(loc: MarinaLocation): number {
  let score = 0;
  const capRatePct = normalizeCapRate(loc.metrics?.capRate);
  const slips = loc.slips ?? 0;
  const status = (loc.status ?? '').toLowerCase();

  // Cap rate (0–35 pts): only available for comps
  if (capRatePct !== null) {
    score += Math.min(35, capRatePct * 4.4); // 7.95%+ = 35pts
  } else {
    score += 12; // partial credit — no cap rate available
  }

  // Slips / scale (0–25 pts)
  score += Math.min(25, slips / 10);

  // Price available (0–15 pts)
  if (loc.price && loc.price > 0) score += 15;
  else score += 5;

  // Status (0–25 pts)
  if (status === 'stabilized') score += 25;
  else if (status === 'active') score += 20;
  else if (status === 'value-add' || status === 'value add') score += 13;
  else if (status === 'distressed') score += 4;
  else score += 12; // unknown/null

  return Math.round(Math.min(100, Math.max(0, score)));
}

function computeTier(score: number): string {
  if (score >= 85) return 'A+';
  if (score >= 70) return 'A';
  if (score >= 55) return 'B';
  return 'C';
}

function toIntelProperty(loc: MarinaLocation): IntelProperty {
  const score = computeScore(loc);
  const capRatePct = normalizeCapRate(loc.metrics?.capRate);
  const noi = loc.metrics?.noi ? Number(loc.metrics.noi) : null;
  return {
    id: loc.id,
    name: loc.name,
    address: [loc.address, loc.city, loc.state].filter(Boolean).join(', ') || 'No address',
    lat: loc.lat!,
    lng: loc.lng!,
    slips: loc.slips ?? 0,
    status: loc.status ?? 'Unknown',
    price: loc.price,
    capRate: capRatePct,
    noi: noi,
    source: SOURCE_LABELS[loc.source] ?? loc.source,
    score,
    tier: computeTier(score),
    rawMetrics: loc.metrics ?? {},
  };
}

const MAP_W = 800;
const MAP_H = 520;

function computeGeoBounds(properties: IntelProperty[]) {
  if (properties.length === 0) {
    return { minLat: 25, maxLat: 50, minLng: -125, maxLng: -65 };
  }
  let minLat = properties[0].lat, maxLat = properties[0].lat;
  let minLng = properties[0].lng, maxLng = properties[0].lng;
  for (const p of properties) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  const latPad = Math.max((maxLat - minLat) * 0.15, 0.3);
  const lngPad = Math.max((maxLng - minLng) * 0.15, 0.3);
  return {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLng: minLng - lngPad,
    maxLng: maxLng + lngPad,
  };
}

function latLngToXY(
  lat: number, lng: number,
  geo: { minLat: number; maxLat: number; minLng: number; maxLng: number }
) {
  const x = ((lng - geo.minLng) / (geo.maxLng - geo.minLng)) * MAP_W;
  const y = MAP_H - ((lat - geo.minLat) / (geo.maxLat - geo.minLat)) * MAP_H;
  return { x, y };
}

// ─── INTELLIGENCE SUB-COMPONENTS ─────────────────────────────────────────────

function IntelScoreBadge({ score, tier }: { score: number; tier: string }) {
  const color = INTEL_TIER_COLOR[tier] ?? '#4a9fd5';
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%', border: `2px solid ${color}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: `${color}18`, flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 8, color, letterSpacing: 1 }}>{tier}</span>
      </div>
    </div>
  );
}

function IntelPill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600,
      background: `${color}20`, color, border: `1px solid ${color}40`, letterSpacing: 0.5,
    }}>{label}</span>
  );
}

function IntelStatBlock({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{ background: '#0d1b2a', borderRadius: 6, padding: '10px 14px', border: '1px solid #1e3a5f' }}>
      <div style={{ fontSize: 10, color: '#4a7fa5', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: accent || '#e8f4fd', fontFamily: "'IBM Plex Mono', monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#4a7fa5', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function IntelHeatMapCanvas({
  properties, selected, onSelect,
}: {
  properties: IntelProperty[];
  selected: IntelProperty | null;
  onSelect: (p: IntelProperty | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const geo = useMemo(() => computeGeoBounds(properties), [properties]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, MAP_W, MAP_H);

    // Background
    const grad = ctx.createLinearGradient(0, 0, MAP_W, MAP_H);
    grad.addColorStop(0, '#060f1a');
    grad.addColorStop(1, '#071828');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    // Grid lines
    ctx.strokeStyle = '#0e2338';
    ctx.lineWidth = 1;
    for (let x = 0; x < MAP_W; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, MAP_H); ctx.stroke(); }
    for (let y = 0; y < MAP_H; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(MAP_W, y); ctx.stroke(); }

    // Heat blobs
    properties.forEach(p => {
      const { x, y } = latLngToXY(p.lat, p.lng, geo);
      const radius = 60 + (p.slips || 0) * 0.25;
      const intensity = p.score / 100;
      const heatGrad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      const color = intensity > 0.85 ? '0,245,160' : intensity > 0.75 ? '74,222,128' : intensity > 0.65 ? '250,204,21' : '248,113,113';
      heatGrad.addColorStop(0, `rgba(${color},${0.3 * intensity})`);
      heatGrad.addColorStop(0.5, `rgba(${color},${0.12 * intensity})`);
      heatGrad.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = heatGrad;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Markers
    properties.forEach(p => {
      const { x, y } = latLngToXY(p.lat, p.lng, geo);
      const isSelected = selected?.id === p.id;
      const isHovered = hoverId === p.id;
      const color = INTEL_TIER_COLOR[p.tier] ?? '#4a9fd5';
      const r = isSelected ? 12 : isHovered ? 10 : 7;

      if (isSelected) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.4;
        ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.2;
        ctx.beginPath(); ctx.arc(x, y, 32, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = isSelected || isHovered ? color : `${color}cc`;
      ctx.shadowColor = color;
      ctx.shadowBlur = isSelected ? 16 : 8;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      if (isSelected || isHovered) {
        ctx.fillStyle = '#e8f4fd';
        ctx.font = "bold 11px 'IBM Plex Mono', monospace";
        ctx.textAlign = 'center';
        const nameShort = p.name.split(' ').slice(0, 2).join(' ');
        ctx.fillText(nameShort, x, y - r - 6);
      }
    });
  }, [properties, selected, hoverId, geo]);

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (MAP_W / rect.width);
    const my = (e.clientY - rect.top) * (MAP_H / rect.height);
    let closest: IntelProperty | null = null;
    let minDist = 30;
    properties.forEach(p => {
      const { x, y } = latLngToXY(p.lat, p.lng, geo);
      const d = Math.hypot(mx - x, my - y);
      if (d < minDist) { minDist = d; closest = p; }
    });
    onSelect(closest);
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (MAP_W / rect.width);
    const my = (e.clientY - rect.top) * (MAP_H / rect.height);
    let found: string | null = null;
    properties.forEach(p => {
      const { x, y } = latLngToXY(p.lat, p.lng, geo);
      if (Math.hypot(mx - x, my - y) < 20) found = p.id;
    });
    setHoverId(found);
  }

  return (
    <canvas
      ref={canvasRef} width={MAP_W} height={MAP_H}
      onClick={handleCanvasClick} onMouseMove={handleMouseMove}
      style={{ width: '100%', height: '100%', cursor: hoverId ? 'pointer' : 'default', borderRadius: 8 }}
    />
  );
}

function IntelPropertyList({
  properties, selected, onSelect, filterTier,
}: {
  properties: IntelProperty[];
  selected: IntelProperty | null;
  onSelect: (p: IntelProperty | null) => void;
  filterTier: string;
}) {
  const filtered = filterTier === 'ALL' ? properties : properties.filter(p => p.tier === filterTier);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', flex: 1 }}>
      {filtered.length === 0 && (
        <div style={{ color: '#3a6080', fontSize: 11, textAlign: 'center', padding: '24px 0' }}>
          No properties in this tier
        </div>
      )}
      {filtered.map(p => {
        const color = INTEL_TIER_COLOR[p.tier] ?? '#4a9fd5';
        return (
          <div key={p.id} onClick={() => onSelect(p.id === selected?.id ? null : p)}
            style={{
              padding: '10px 12px', borderRadius: 6, cursor: 'pointer',
              background: selected?.id === p.id ? '#0e2a42' : '#0a1a2a',
              border: `1px solid ${selected?.id === p.id ? color + '80' : '#1a3050'}`,
              transition: 'all 0.15s',
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#c8e6f7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                <div style={{ fontSize: 10, color: '#3a6080', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.address}</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                  <IntelPill label={p.source} color="#4a7fa5" />
                  {p.status !== 'Unknown' && (
                    <IntelPill label={p.status} color={INTEL_STATUS_COLOR[(p.status ?? '').toLowerCase()] ?? '#4a7fa5'} />
                  )}
                </div>
              </div>
              <div style={{ marginLeft: 8, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <IntelScoreBadge score={p.score} tier={p.tier} />
                {p.capRate !== null && (
                  <div style={{ fontSize: 10, color: '#4a7fa5', fontFamily: 'monospace' }}>{p.capRate.toFixed(2)}% cap</div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function IntelPropertyDetail({
  property: p, onClose,
}: {
  property: IntelProperty | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState('overview');
  if (!p) return null;
  const color = INTEL_TIER_COLOR[p.tier] ?? '#4a9fd5';

  const radarData = [
    { subject: 'Score', value: p.score },
    { subject: 'Cap Rate', value: p.capRate !== null ? Math.min(100, p.capRate * 12) : 0 },
    { subject: 'Scale', value: Math.min(100, (p.slips || 0) / 2.5) },
    { subject: 'Priced', value: p.price ? 80 : 20 },
    { subject: 'Status', value: (p.status ?? '').toLowerCase() === 'stabilized' ? 100 : (p.status ?? '').toLowerCase() === 'active' ? 75 : (p.status ?? '').toLowerCase() === 'value-add' ? 50 : 20 },
  ];

  const revenueData = [
    ...(p.noi ? [{ name: 'NOI', value: p.noi }] : []),
    ...(p.rawMetrics?.fuelRevenue ? [{ name: 'Fuel', value: Number(p.rawMetrics.fuelRevenue) }] : []),
    ...(p.rawMetrics?.storageRevenue ? [{ name: 'Storage', value: Number(p.rawMetrics.storageRevenue) }] : []),
    ...(p.rawMetrics?.serviceRevenue ? [{ name: 'Service', value: Number(p.rawMetrics.serviceRevenue) }] : []),
  ];

  const tabs = ['overview', 'financials', 'context'];

  return (
    <div style={{
      background: '#070f1a', border: `1px solid ${color}40`, borderRadius: 10,
      display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #0e2338', background: '#08141f' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <IntelScoreBadge score={p.score} tier={p.tier} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e8f4fd' }}>{p.name}</div>
                <div style={{ fontSize: 10, color: '#3a6080' }}>{p.address}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
              <IntelPill label={p.source} color="#4a7fa5" />
              {p.status !== 'Unknown' && (
                <IntelPill label={p.status} color={INTEL_STATUS_COLOR[(p.status ?? '').toLowerCase()] ?? '#4a7fa5'} />
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#3a6080', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 0, marginTop: 12, borderBottom: '1px solid #0e2338' }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: 'none', border: 'none', borderBottom: `2px solid ${tab === t ? color : 'transparent'}`,
              color: tab === t ? color : '#3a6080', padding: '6px 12px', cursor: 'pointer',
              fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, transition: 'all 0.15s',
            }}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <IntelStatBlock label="Price" value={p.price ? formatCurrency(p.price) : 'N/A'} sub="Asking / Sale" />
              <IntelStatBlock label="Slips" value={p.slips > 0 ? p.slips.toLocaleString() : 'N/A'} sub="Total capacity" />
              {p.capRate !== null && (
                <IntelStatBlock label="Cap Rate" value={`${p.capRate.toFixed(2)}%`} sub="Going-in" accent={color} />
              )}
              {p.noi !== null && (
                <IntelStatBlock label="NOI" value={`$${(p.noi / 1000).toFixed(0)}K`} sub="Annual" accent={color} />
              )}
              {p.price && p.slips > 0 && (
                <IntelStatBlock
                  label="$/Slip"
                  value={`$${Math.round(p.price / p.slips).toLocaleString()}`}
                  sub="Per slip"
                  accent={color}
                />
              )}
              {p.rawMetrics?.saleYear && (
                <IntelStatBlock label="Sale Year" value={p.rawMetrics.saleYear} sub="Comp date" />
              )}
              {p.rawMetrics?.bodyOfWater && (
                <IntelStatBlock label="Body of Water" value={p.rawMetrics.bodyOfWater} sub="Location" />
              )}
              {p.rawMetrics?.region && (
                <IntelStatBlock label="Region" value={p.rawMetrics.region} />
              )}
            </div>
            <div style={{ background: '#0a1a2a', borderRadius: 6, padding: 12, border: '1px solid #1e3a5f' }}>
              <div style={{ fontSize: 10, color: '#4a7fa5', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Signal Radar</div>
              <ResponsiveContainer width="100%" height={150}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#1e3a5f" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#4a7fa5', fontSize: 9 }} />
                  <Radar name={p.name} dataKey="value" stroke={color} fill={color} fillOpacity={0.15} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {tab === 'financials' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {revenueData.length > 0 ? (
              <div style={{ background: '#0a1a2a', borderRadius: 6, padding: 12, border: '1px solid #1e3a5f' }}>
                <div style={{ fontSize: 10, color: '#4a7fa5', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Revenue Breakdown</div>
                <ResponsiveContainer width="100%" height={130}>
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#0e2338" />
                    <XAxis dataKey="name" tick={{ fill: '#4a7fa5', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#4a7fa5', fontSize: 9 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                    <ReTooltip
                      formatter={(v: number) => [`$${v.toLocaleString()}`, '']}
                      contentStyle={{ background: '#07111c', border: '1px solid #1e3a5f', borderRadius: 4 }}
                    />
                    <Bar dataKey="value" fill={color} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ color: '#3a6080', fontSize: 11, textAlign: 'center', padding: '20px 0', border: '1px solid #1e3a5f', borderRadius: 6 }}>
                Revenue breakdown not available for this source type
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <IntelStatBlock label="Price" value={p.price ? formatCurrency(p.price) : 'N/A'} sub="Asking / Sale" />
              {p.capRate !== null && (
                <IntelStatBlock label="Cap Rate" value={`${p.capRate.toFixed(2)}%`} sub="Going-in" accent={color} />
              )}
              {p.noi !== null && (
                <IntelStatBlock label="NOI" value={`$${(p.noi / 1000).toFixed(0)}K`} sub="Net operating income" accent={color} />
              )}
              {p.price && p.slips > 0 && (
                <IntelStatBlock label="Price / Slip" value={`$${Math.round(p.price / p.slips).toLocaleString()}`} sub="Per slip" />
              )}
            </div>
          </div>
        )}

        {tab === 'context' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#0a1a2a', borderRadius: 6, padding: 12, border: '1px solid #1e3a5f' }}>
              <div style={{ fontSize: 10, color: '#4a7fa5', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Data Source</div>
              <IntelPill label={p.source} color="#4a9fd5" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {p.rawMetrics?.wetSlips != null && (
                <IntelStatBlock label="Wet Slips" value={Number(p.rawMetrics.wetSlips).toLocaleString()} />
              )}
              {p.rawMetrics?.drySlips != null && (
                <IntelStatBlock label="Dry Slips" value={Number(p.rawMetrics.drySlips).toLocaleString()} />
              )}
              {p.rawMetrics?.dryRacks != null && (
                <IntelStatBlock label="Dry Racks" value={Number(p.rawMetrics.dryRacks).toLocaleString()} />
              )}
              {p.rawMetrics?.totalCapacity != null && (
                <IntelStatBlock label="Total Capacity" value={Number(p.rawMetrics.totalCapacity).toLocaleString()} />
              )}
              {p.rawMetrics?.totalStorageUnits != null && (
                <IntelStatBlock label="Storage Units" value={Number(p.rawMetrics.totalStorageUnits).toLocaleString()} />
              )}
              {p.rawMetrics?.bodyOfWater && (
                <IntelStatBlock label="Body of Water" value={p.rawMetrics.bodyOfWater} />
              )}
              {p.rawMetrics?.region && (
                <IntelStatBlock label="Region" value={p.rawMetrics.region} />
              )}
              {p.rawMetrics?.dealOutcome && (
                <IntelStatBlock label="Deal Outcome" value={p.rawMetrics.dealOutcome} />
              )}
            </div>
            <div style={{ background: '#0a1a2a', borderRadius: 6, padding: 12, border: '1px solid #1e3a5f' }}>
              <div style={{ fontSize: 10, color: '#4a7fa5', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Investment Grade Explanation</div>
              <div style={{ fontSize: 11, color: '#4a7fa5', lineHeight: 1.6 }}>
                Score of <span style={{ color, fontWeight: 700 }}>{p.score}</span> ({p.tier}) based on{' '}
                {[
                  p.capRate !== null && `cap rate (${p.capRate.toFixed(1)}%)`,
                  p.slips > 0 && `${p.slips} slips`,
                  p.price && 'priced asset',
                  p.status !== 'Unknown' && `${p.status} status`,
                ].filter(Boolean).join(', ') || 'available metrics'}.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function IntelligenceView({ locations }: { locations: MarinaLocation[] }) {
  const [selected, setSelected] = useState<IntelProperty | null>(null);
  const [filterTier, setFilterTier] = useState('ALL');
  const tiers = ['ALL', 'A+', 'A', 'B', 'C'];

  const allIntel = useMemo(() => {
    return locations
      .filter(l => l.lat != null && l.lng != null)
      .map(toIntelProperty);
  }, [locations]);

  const filtered = filterTier === 'ALL' ? allIntel : allIntel.filter(p => p.tier === filterTier);

  const marketStats = useMemo(() => {
    const withCap = allIntel.filter(p => p.capRate !== null);
    const withSlips = allIntel.filter(p => p.slips > 0);
    return {
      avgCapRate: withCap.length > 0 ? (withCap.reduce((s, p) => s + p.capRate!, 0) / withCap.length).toFixed(2) : 'N/A',
      totalSlips: allIntel.reduce((s, p) => s + p.slips, 0),
      totalValue: allIntel.filter(p => p.price).reduce((s, p) => s + (p.price ?? 0), 0),
      count: allIntel.length,
    };
  }, [allIntel]);

  if (allIntel.length === 0) {
    return (
      <div style={{
        background: '#040d16', color: '#4a7fa5', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
      }}>
        No properties with coordinates available. Add coordinates to your marinas to use Intelligence View.
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: "'IBM Plex Sans', 'Helvetica Neue', sans-serif",
      background: '#040d16', color: '#c8e6f7', height: '100%', display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left sidebar */}
        <div style={{ width: 270, borderRight: '1px solid #0e2338', display: 'flex', flexDirection: 'column', background: '#050e1b', flexShrink: 0 }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #0e2338' }}>
            <div style={{ fontSize: 9, color: '#4a7fa5', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Filter by Grade</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {tiers.map(t => {
                const c = INTEL_TIER_COLOR[t];
                return (
                  <button key={t} onClick={() => setFilterTier(t)} style={{
                    background: filterTier === t ? (c ? `${c}20` : '#0e2a42') : 'none',
                    border: `1px solid ${filterTier === t ? (c || '#4a9fd5') : '#1a3050'}`,
                    borderRadius: 4, padding: '3px 8px', fontSize: 10, fontWeight: 600,
                    color: filterTier === t ? (c || '#4a9fd5') : '#3a6080',
                    cursor: 'pointer',
                  }}>{t}</button>
                );
              })}
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: '#2a5070' }}>
              {filtered.length} propert{filtered.length !== 1 ? 'ies' : 'y'} · {filtered.reduce((s, p) => s + p.slips, 0).toLocaleString()} slips
            </div>
          </div>
          <div style={{ flex: 1, padding: '8px 10px', overflowY: 'auto' }}>
            <IntelPropertyList
              properties={filtered}
              selected={selected}
              onSelect={setSelected}
              filterTier={filterTier}
            />
          </div>
        </div>

        {/* Center canvas */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <IntelHeatMapCanvas properties={filtered} selected={selected} onSelect={setSelected} />

          {/* Legend */}
          <div style={{
            position: 'absolute', bottom: 14, left: 14, background: '#05101edd',
            border: '1px solid #0e2338', borderRadius: 6, padding: '8px 12px', backdropFilter: 'blur(8px)',
          }}>
            <div style={{ fontSize: 9, color: '#4a7fa5', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Investment Grade</div>
            {([['A+', '85–100 · Top Tier'], ['A', '70–84 · Strong'], ['B', '55–69 · Value-Add'], ['C', '0–54 · Distressed']] as [string, string][]).map(([t, l]) => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: INTEL_TIER_COLOR[t] }} />
                <span style={{ fontSize: 10, color: '#4a7fa5' }}><b style={{ color: INTEL_TIER_COLOR[t] }}>{t}</b> — {l}</span>
              </div>
            ))}
          </div>

          {/* Market summary */}
          <div style={{
            position: 'absolute', top: 14, right: 14, background: '#05101edd',
            border: '1px solid #0e2338', borderRadius: 6, padding: '10px 14px', backdropFilter: 'blur(8px)', minWidth: 160,
          }}>
            <div style={{ fontSize: 9, color: '#4a7fa5', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Portfolio Overview</div>
            {[
              { label: 'Properties Mapped', value: marketStats.count.toString() },
              { label: 'Avg Cap Rate', value: marketStats.avgCapRate !== 'N/A' ? `${marketStats.avgCapRate}%` : 'N/A' },
              { label: 'Total Slips', value: marketStats.totalSlips.toLocaleString() },
              { label: 'Total Value', value: marketStats.totalValue > 0 ? `$${(marketStats.totalValue / 1e6).toFixed(1)}M` : 'N/A' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 5 }}>
                <span style={{ fontSize: 10, color: '#3a6080' }}>{row.label}</span>
                <span style={{ fontSize: 10, color: '#c8e6f7', fontFamily: 'monospace', fontWeight: 700 }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right detail panel */}
        <div style={{
          width: selected ? 350 : 0, flexShrink: 0, overflow: 'hidden',
          transition: 'width 0.25s', borderLeft: '1px solid #0e2338', background: '#070f1a',
        }}>
          {selected && (
            <div style={{ width: 350, height: '100%', padding: 10 }}>
              <IntelPropertyDetail property={selected} onClose={() => setSelected(null)} />
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div style={{
        height: 26, borderTop: '1px solid #0e2338', background: '#040b13',
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 16, flexShrink: 0,
      }}>
        <span style={{ fontSize: 9, color: '#2a5070', letterSpacing: 0.5 }}>{allIntel.length} properties indexed · live data</span>
        <span style={{ fontSize: 9, color: '#2a5070' }}>·</span>
        <span style={{ fontSize: 9, color: '#2a5070' }}>Heat Map: Concentration by Score × Slip Count</span>
        <span style={{ fontSize: 9, color: '#2a5070', marginLeft: 'auto' }}>MarinaMatch Intelligence</span>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function MarinaMapPage() {
  const [, navigate] = useLocation();
  const { isLoaded, loadError } = useGoogleMaps();
  const mapRef = useRef<google.maps.Map | null>(null);
  
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<MarinaLocation | null>(null);
  const [visibleSources, setVisibleSources] = useState<Set<string>>(new Set(['property', 'project', 'comp', 'listing']));
  const [viewMode, setViewMode] = useState<'map' | 'split' | 'intelligence'>('split');
  const [listExpanded, setListExpanded] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const queryUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (sourceFilter && sourceFilter !== 'all') params.set('source', sourceFilter);
    if (stateFilter && stateFilter !== 'all') params.set('state', stateFilter);
    if (debouncedSearch) params.set('search', debouncedSearch);
    const qs = params.toString();
    return `/api/marina-map/locations${qs ? `?${qs}` : ''}`;
  }, [sourceFilter, stateFilter, debouncedSearch]);

  const { data, isLoading, error } = useQuery<MapResponse>({
    queryKey: [queryUrl],
  });

  const locations = data?.locations || [];
  const stats = data?.stats;

  const mappableLocations = useMemo(() => 
    locations.filter(l => l.lat != null && l.lng != null && visibleSources.has(l.source)),
    [locations, visibleSources]
  );

  const listLocations = useMemo(() =>
    locations.filter(l => visibleSources.has(l.source)),
    [locations, visibleSources]
  );

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  useEffect(() => {
    if (mapRef.current && mappableLocations.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      mappableLocations.forEach(loc => {
        if (loc.lat && loc.lng) bounds.extend({ lat: loc.lat, lng: loc.lng });
      });
      mapRef.current.fitBounds(bounds, 60);
    }
  }, [mappableLocations]);

  const toggleSource = (source: string) => {
    setVisibleSources(prev => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  };

  const navigateToSource = (loc: MarinaLocation) => {
    if (loc.source === 'property') navigate(`/crm/properties`);
    else if (loc.source === 'project') navigate(`/modeling/projects/${loc.id}`);
    else if (loc.source === 'comp') navigate(`/analysis/sales-comps`);
    else if (loc.source === 'listing') navigate(`/analysis/sales-comps`);
  };

  const focusOnLocation = (loc: MarinaLocation) => {
    setSelectedLocation(loc);
    if (mapRef.current && loc.lat && loc.lng) {
      mapRef.current.panTo({ lat: loc.lat, lng: loc.lng });
      mapRef.current.setZoom(14);
    }
  };

  if (loadError || error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center space-y-3">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto" />
            <h3 className="text-lg font-semibold">{loadError ? 'Map Unavailable' : 'Error Loading Data'}</h3>
            <p className="text-sm text-muted-foreground">
              {loadError ? 'Unable to load Google Maps. Please check the API key configuration.' : 'Failed to load marina data. Please try refreshing the page.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-60px)]">
      <div className="px-4 py-3 border-b bg-white dark:bg-slate-900 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30">
            <Anchor className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Marina Map</h1>
            <p className="text-xs text-muted-foreground">
              {stats ? `${stats.total} marinas across ${Object.keys(stats.byState).length} states` : 'Loading...'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-1 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search marinas by name..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              className="pl-9 h-9"
            />
            {searchText && (
              <button onClick={() => setSearchText('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-[100px] h-9">
              <SelectValue placeholder="State" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {US_STATES.map(st => (
                <SelectItem key={st} value={st}>{st}{stats?.byState[st] ? ` (${stats.byState[st]})` : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="properties">Properties</SelectItem>
              <SelectItem value="projects">Models</SelectItem>
              <SelectItem value="comps">Sales Comps</SelectItem>
              <SelectItem value="listings">Listings</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={viewMode === 'map' ? 'default' : 'outline'}
                  size="sm"
                  className="h-8"
                  onClick={() => setViewMode('map')}
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Full Map</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={viewMode === 'split' ? 'default' : 'outline'}
                  size="sm"
                  className="h-8"
                  onClick={() => setViewMode('split')}
                >
                  <List className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Map + List</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={viewMode === 'intelligence' ? 'default' : 'outline'}
                  size="sm"
                  className="h-8"
                  onClick={() => setViewMode('intelligence')}
                >
                  <Cpu className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Intelligence View</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {viewMode !== 'intelligence' && (
        <div className="px-3 py-2 border-b bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2 flex-wrap">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground mr-1">Layers:</span>
          {Object.entries(SOURCE_LABELS).map(([key, label]) => {
            const Icon = SOURCE_ICONS[key];
            const count = stats?.bySource[key] || 0;
            const active = visibleSources.has(key);
            return (
              <button
                key={key}
                onClick={() => toggleSource(key)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
                  active
                    ? "bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 shadow-sm"
                    : "bg-transparent border-transparent text-muted-foreground opacity-50 hover:opacity-80"
                )}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: active ? SOURCE_COLORS[key] : '#ccc' }}
                />
                <Icon className="h-3 w-3" />
                <span>{label}</span>
                <span className="text-muted-foreground">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {viewMode === 'intelligence' ? (
          isLoading ? (
            <div className="flex items-center justify-center h-full" style={{ background: '#040d16' }}>
              <div className="text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin mx-auto" style={{ color: '#4a9fd5' }} />
                <p style={{ color: '#4a7fa5', fontSize: 13 }}>Loading intelligence data...</p>
              </div>
            </div>
          ) : (
            <IntelligenceView locations={locations} />
          )
        ) : (
          <div className={cn("h-full flex overflow-hidden", viewMode === 'map' ? '' : '')}>
            <div className={cn("flex-1 relative", viewMode === 'split' ? 'min-w-0' : '')}>
              {!isLoaded ? (
                <div className="flex items-center justify-center h-full bg-slate-100 dark:bg-slate-800">
                  <div className="text-center space-y-3">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">Loading map...</p>
                  </div>
                </div>
              ) : (
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={defaultCenter}
                  zoom={5}
                  onLoad={onMapLoad}
                  onClick={() => setSelectedLocation(null)}
                  options={{
                    mapTypeControl: true,
                    mapTypeControlOptions: { position: google.maps.ControlPosition.TOP_RIGHT },
                    streetViewControl: false,
                    fullscreenControl: false,
                    zoomControl: true,
                    styles: [
                      { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#c8e0f0' }] },
                      { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4a90b8' }] },
                    ],
                  }}
                >
                  <MarkerClusterer
                    options={{
                      imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m',
                      maxZoom: 14,
                      minimumClusterSize: 4,
                    }}
                  >
                    {(clusterer) => (
                      <>
                        {mappableLocations.map((loc) => (
                          <Marker
                            key={`${loc.source}-${loc.id}`}
                            position={{ lat: loc.lat!, lng: loc.lng! }}
                            icon={createMarkerIcon(loc.source, selectedLocation?.id === loc.id && selectedLocation?.source === loc.source)}
                            clusterer={clusterer}
                            onClick={() => setSelectedLocation(loc)}
                            title={loc.name}
                          />
                        ))}
                      </>
                    )}
                  </MarkerClusterer>

                  {selectedLocation && selectedLocation.lat && selectedLocation.lng && (
                    <InfoWindow
                      position={{ lat: selectedLocation.lat, lng: selectedLocation.lng }}
                      onCloseClick={() => setSelectedLocation(null)}
                    >
                      <div className="p-1 min-w-[220px] max-w-[300px]">
                        <div className="flex items-start gap-2 mb-2">
                          <div
                            className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                            style={{ backgroundColor: SOURCE_COLORS[selectedLocation.source] }}
                          />
                          <div className="min-w-0">
                            <h3 className="font-semibold text-sm leading-tight">{selectedLocation.name}</h3>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {[selectedLocation.city, selectedLocation.state].filter(Boolean).join(', ')}
                            </p>
                          </div>
                        </div>
                        {selectedLocation.address && (
                          <p className="text-xs text-gray-600 mb-2">{selectedLocation.address}</p>
                        )}
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs border-t pt-2 mt-1">
                          {selectedLocation.price && (
                            <div>
                              <span className="text-gray-500">Price: </span>
                              <span className="font-medium">{formatCurrency(selectedLocation.price)}</span>
                            </div>
                          )}
                          {selectedLocation.slips && (
                            <div>
                              <span className="text-gray-500">Slips: </span>
                              <span className="font-medium">{selectedLocation.slips.toLocaleString()}</span>
                            </div>
                          )}
                          {selectedLocation.status && (
                            <div>
                              <span className="text-gray-500">Status: </span>
                              <span className="font-medium capitalize">{selectedLocation.status}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-gray-500">Source: </span>
                            <span className="font-medium">{SOURCE_LABELS[selectedLocation.source]}</span>
                          </div>
                          {selectedLocation.metrics?.capRate && (
                            <div>
                              <span className="text-gray-500">Cap Rate: </span>
                              <span className="font-medium">{(Number(selectedLocation.metrics.capRate) / 100).toFixed(1)}%</span>
                            </div>
                          )}
                          {selectedLocation.metrics?.bodyOfWater && (
                            <div className="col-span-2">
                              <span className="text-gray-500">Water: </span>
                              <span className="font-medium">{selectedLocation.metrics.bodyOfWater}</span>
                            </div>
                          )}
                        </div>
                        <div className="mt-2 pt-2 border-t">
                          <button
                            onClick={() => navigateToSource(selectedLocation)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View Details
                          </button>
                        </div>
                      </div>
                    </InfoWindow>
                  )}
                </GoogleMap>
              )}

              {isLoading && (
                <div className="absolute top-3 left-3 bg-white dark:bg-slate-800 rounded-lg shadow-lg px-3 py-2 flex items-center gap-2 z-10">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <span className="text-xs font-medium">Loading marina locations...</span>
                </div>
              )}
            </div>

            {viewMode === 'split' && (
              <div className="w-[360px] border-l bg-white dark:bg-slate-900 flex flex-col overflow-hidden flex-shrink-0">
                <div className="px-3 py-2.5 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {listLocations.length} Marina{listLocations.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setListExpanded(!listExpanded)}>
                    {listExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </Button>
                </div>

                {listExpanded && (
                  <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                      <div className="p-3 space-y-3">
                        {Array.from({ length: 8 }).map((_, i) => (
                          <div key={i} className="space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                            <Skeleton className="h-3 w-1/3" />
                          </div>
                        ))}
                      </div>
                    ) : listLocations.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        <MapPin className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-medium">No marinas found</p>
                        <p className="text-xs mt-1">Try adjusting your filters</p>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {listLocations.map((loc) => {
                          const isActive = selectedLocation?.id === loc.id && selectedLocation?.source === loc.source;
                          return (
                            <button
                              key={`${loc.source}-${loc.id}`}
                              className={cn(
                                "w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                                isActive && "bg-blue-50 dark:bg-blue-950/20 border-l-2 border-l-blue-500"
                              )}
                              onClick={() => focusOnLocation(loc)}
                            >
                              <div className="flex items-start gap-2.5">
                                <div
                                  className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                                  style={{ backgroundColor: SOURCE_COLORS[loc.source] }}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-medium truncate">{loc.name}</p>
                                    {!loc.lat && (
                                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 flex-shrink-0 text-amber-600 border-amber-300">
                                        No coords
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {[loc.city, loc.state].filter(Boolean).join(', ') || loc.address || 'No location'}
                                  </p>
                                  <div className="flex items-center gap-3 mt-1 text-xs">
                                    {loc.price && (
                                      <span className="font-medium text-green-600">{formatCurrency(loc.price)}</span>
                                    )}
                                    {loc.slips && (
                                      <span className="text-muted-foreground">
                                        <Ship className="inline h-3 w-3 mr-0.5" />{loc.slips} slips
                                      </span>
                                    )}
                                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                                      {SOURCE_LABELS[loc.source]?.split(' ')[0]}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {stats && (
                  <div className="border-t px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">With Coordinates</span>
                        <p className="font-medium">{stats.withCoordinates} / {stats.total}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">States Covered</span>
                        <p className="font-medium">{Object.keys(stats.byState).length}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

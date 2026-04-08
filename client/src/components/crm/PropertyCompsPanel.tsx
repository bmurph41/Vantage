/**
 * PropertyCompsPanel
 *
 * Renders Sales Comps and Rate Comps inline on the Property CRM record.
 * - Sales comps: filtered by asset class + proximity, showing cap rate,
 *   $/slip, sale date, price. Includes market median row.
 * - Rate comps: market rent by slip/unit type for the submarket.
 *
 * Usage:
 *   <PropertyCompsPanel
 *     propertyId={property.id}
 *     assetClass={property.type}
 *     latitude={property.latitude}
 *     longitude={property.longitude}
 *     city={property.city}
 *     state={property.state}
 *   />
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp, MapPin, Calendar, DollarSign,
  ExternalLink, BarChart3, Anchor,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PropertyCompsPanelProps {
  propertyId: string;
  assetClass?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  state?: string | null;
  /** $/slip or $/SF label depending on asset class */
  unitLabel?: string;
  className?: string;
}

function fmtCurrency(v: number | string | null | undefined, compact = false): string {
  if (v == null || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '—';
  if (compact) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtPct(v: number | string | null | undefined): string {
  if (v == null || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '—';
  // Values stored as 0.065 → show as 6.5%, or as 6.5 → show as 6.5%
  const pct = n < 1 ? n * 100 : n;
  return `${pct.toFixed(2)}%`;
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function PropertyCompsPanel({
  propertyId,
  assetClass,
  latitude,
  longitude,
  city,
  state,
  unitLabel = '$/slip',
  className,
}: PropertyCompsPanelProps) {
  const [radiusMiles, setRadiusMiles] = useState(50);

  // ── Sales Comps ──────────────────────────────────────────────
  const salesParams = new URLSearchParams();
  if (assetClass) salesParams.set('type', assetClass);
  if (latitude && longitude) {
    salesParams.set('lat', String(latitude));
    salesParams.set('lng', String(longitude));
    salesParams.set('radiusMiles', String(radiusMiles));
  } else if (state) {
    salesParams.set('state', state);
  }
  salesParams.set('limit', '10');
  salesParams.set('sortBy', 'saleDate');
  salesParams.set('sortDir', 'desc');

  const { data: salesData, isLoading: loadingSales } = useQuery({
    queryKey: ['property-sales-comps', propertyId, assetClass, latitude, longitude, radiusMiles],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sales-comps?${salesParams.toString()}`);
      const d = await res.json();
      return Array.isArray(d) ? d : d?.comps ?? d?.data ?? [];
    },
    enabled: !!propertyId,
    staleTime: 120_000,
  });

  // ── Rate Comps ───────────────────────────────────────────────
  const rateParams = new URLSearchParams();
  if (assetClass) rateParams.set('type', assetClass);
  if (state) rateParams.set('state', state);
  if (city) rateParams.set('city', city);
  rateParams.set('limit', '8');

  const { data: rateData, isLoading: loadingRates } = useQuery({
    queryKey: ['property-rate-comps', propertyId, assetClass, city, state],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/rate-comps?${rateParams.toString()}`);
      const d = await res.json();
      return Array.isArray(d) ? d : d?.comps ?? d?.data ?? [];
    },
    enabled: !!propertyId,
    staleTime: 120_000,
  });

  const salesComps = salesData ?? [];
  const rateComps = rateData ?? [];

  // Compute market medians
  const salesCapRates = salesComps
    .map((c: any) => parseFloat(c.capRate ?? c.cap_rate ?? ''))
    .filter(Number.isFinite);
  const salesPrices = salesComps
    .map((c: any) => parseFloat(c.salePrice ?? c.sale_price ?? ''))
    .filter(Number.isFinite);
  const medCapRate = salesCapRates.length ? median(salesCapRates) : null;
  const medPrice = salesPrices.length ? median(salesPrices) : null;

  const avgRate = rateComps.length
    ? rateComps.reduce((s: number, c: any) => s + parseFloat(c.monthlyRate ?? c.rate ?? c.monthly_rate ?? '0'), 0) / rateComps.length
    : null;

  return (
    <div className={cn('space-y-2', className)}>
      <Tabs defaultValue="sales">
        <div className="flex items-center justify-between mb-2">
          <TabsList className="h-7">
            <TabsTrigger value="sales" className="text-xs h-6 px-2.5">
              Sales Comps
              {salesComps.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[9px] h-3.5 px-1">{salesComps.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="rates" className="text-xs h-6 px-2.5">
              Rate Comps
              {rateComps.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[9px] h-3.5 px-1">{rateComps.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <Link href="/analysis/sales-comps">
            <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-blue-600 px-2">
              Full Comps <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>

        {/* ── SALES COMPS TAB ── */}
        <TabsContent value="sales" className="mt-0 space-y-2">
          {/* Market medians */}
          {(medCapRate != null || medPrice != null) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {medCapRate != null && (
                <div className="rounded-md bg-muted/60 px-3 py-2">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Market Median Cap</p>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{fmtPct(medCapRate / 100)}</p>
                </div>
              )}
              {medPrice != null && (
                <div className="rounded-md bg-muted/60 px-3 py-2">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Median Price</p>
                  <p className="text-sm font-semibold">{fmtCurrency(medPrice, true)}</p>
                </div>
              )}
            </div>
          )}

          {loadingSales ? (
            <div className="space-y-1.5">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded" />)}
            </div>
          ) : salesComps.length === 0 ? (
            <EmptyState icon={BarChart3} message="No sales comps found" sub="Adjust radius or add comps manually" />
          ) : (
            <div className="divide-y divide-border rounded-lg border overflow-hidden">
              {salesComps.slice(0, 6).map((comp: any, i: number) => (
                <SalesCompRow key={comp.id ?? i} comp={comp} unitLabel={unitLabel} />
              ))}
              {salesComps.length > 6 && (
                <div className="px-3 py-2 text-[10px] text-muted-foreground text-center bg-muted/30">
                  +{salesComps.length - 6} more comps —{' '}
                  <Link href="/analysis/sales-comps" className="text-blue-600 hover:underline">view all</Link>
                </div>
              )}
            </div>
          )}

          {/* Radius control */}
          {latitude && longitude && (
            <div className="flex items-center gap-2 pt-1">
              <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="text-[10px] text-muted-foreground">Radius:</span>
              {[25, 50, 100, 200].map(r => (
                <button
                  key={r}
                  onClick={() => setRadiusMiles(r)}
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded border transition-colors',
                    radiusMiles === r
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary',
                  )}
                >
                  {r}mi
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── RATE COMPS TAB ── */}
        <TabsContent value="rates" className="mt-0 space-y-2">
          {avgRate != null && (
            <div className="rounded-md bg-muted/60 px-3 py-2 flex items-center justify-between">
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Avg Market Rate</p>
                <p className="text-sm font-semibold">{fmtCurrency(avgRate)}<span className="text-[10px] font-normal text-muted-foreground">/mo</span></p>
              </div>
              <Anchor className="h-4 w-4 text-muted-foreground" />
            </div>
          )}

          {loadingRates ? (
            <div className="space-y-1.5">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full rounded" />)}
            </div>
          ) : rateComps.length === 0 ? (
            <EmptyState icon={DollarSign} message="No rate comps found" sub="Add rate comps for this submarket" />
          ) : (
            <div className="divide-y divide-border rounded-lg border overflow-hidden">
              {rateComps.slice(0, 8).map((comp: any, i: number) => (
                <RateCompRow key={comp.id ?? i} comp={comp} />
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <Link href="/analysis/rate-comps">
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-blue-600 px-2">
                Manage Rate Comps <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SalesCompRow({ comp, unitLabel }: { comp: any; unitLabel: string }) {
  const name = comp.marina ?? comp.name ?? comp.address ?? 'Unknown';
  const location = [comp.city, comp.state].filter(Boolean).join(', ') || '—';
  const saleDate = comp.saleDate ?? comp.sale_date
    ? `${comp.saleMonth ?? comp.sale_month ? String(comp.saleMonth ?? comp.sale_month).padStart(2, '0') + '/' : ''}${comp.saleYear ?? comp.sale_year ?? comp.saleDate ?? comp.sale_date}`
    : '—';
  const price = fmtCurrency(comp.salePrice ?? comp.sale_price, true);
  const capRate = fmtPct(comp.capRate ?? comp.cap_rate);

  return (
    <div className="px-3 py-2 flex items-start gap-2 bg-card hover:bg-muted/30 transition-colors text-xs">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{name}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <MapPin className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground truncate">{location}</span>
        </div>
      </div>
      <div className="flex-shrink-0 text-right space-y-0.5">
        <p className="font-semibold">{price}</p>
        <div className="flex items-center gap-1.5 justify-end">
          {capRate !== '—' && (
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">{capRate}</span>
          )}
          {saleDate !== '—' && (
            <span className="text-[10px] text-muted-foreground">{saleDate}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function RateCompRow({ comp }: { comp: any }) {
  const name = comp.marina ?? comp.name ?? comp.address ?? 'Unknown';
  const slipType = comp.slipType ?? comp.slip_type ?? comp.storageType ?? comp.storage_type ?? '';
  const rate = comp.monthlyRate ?? comp.rate ?? comp.monthly_rate;
  const occupancy = comp.occupancyRate ?? comp.occupancy_rate;

  return (
    <div className="px-3 py-2 flex items-center gap-2 bg-card hover:bg-muted/30 transition-colors text-xs">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{name}</p>
        {slipType && <p className="text-[10px] text-muted-foreground truncate capitalize">{slipType}</p>}
      </div>
      <div className="flex-shrink-0 text-right space-y-0.5">
        {rate && <p className="font-semibold">{fmtCurrency(rate)}<span className="text-[10px] font-normal text-muted-foreground">/mo</span></p>}
        {occupancy != null && (
          <p className="text-[10px] text-muted-foreground">{(parseFloat(occupancy) * 100).toFixed(0)}% occ.</p>
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, message, sub }: { icon: typeof BarChart3; message: string; sub: string }) {
  return (
    <div className="rounded-lg border border-dashed p-4 text-center">
      <Icon className="h-6 w-6 mx-auto text-muted-foreground/40 mb-1.5" />
      <p className="text-xs font-medium text-muted-foreground">{message}</p>
      <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>
    </div>
  );
}

export default PropertyCompsPanel;

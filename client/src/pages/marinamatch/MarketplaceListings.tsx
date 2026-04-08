/**
 * MarketplaceListings.tsx
 * ─────────────────────────────────────────────────────────────────────────
 * World-class institutional marketplace — live scraped listings from top
 * CRE sources with one-click pipeline ingestion, advanced filters, multiple
 * views, and deal scoring.
 *
 * API contracts (existing endpoints):
 *  GET  /api/listings/v2/listings           → Liv2ListingCurrent[]
 *  GET  /api/listings/v2/listings/:id       → { listing, assets, payloadHistory }
 *  GET  /api/listings/v2/marketplace/sources → { sources[], allowedDomains[] }
 *  POST /api/marinamatch/sourced-deals       → SourcedDeal  (Add to Pipeline)
 *
 * New endpoint added via marketplace-pipeline-route.ts (see companion file):
 *  POST /api/listings/v2/listings/:id/pipeline → proxies to sourced-deals
 */

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import {
  Building2,
  Anchor,
  MapPin,
  DollarSign,
  TrendingUp,
  BarChart3,
  Filter,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Table,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  PlusCircle,
  Bookmark,
  BookmarkCheck,
  RefreshCw,
  X,
  Check,
  AlertCircle,
  Clock,
  Zap,
  Globe,
  Star,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Info,
  Eye,
  Layers,
  Tag,
  Waves,
  Ship,
  Home,
  Truck,
  Factory,
  TreePine,
  Store,
  HelpCircle,
  Activity,
  Badge as BadgeIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Types ────────────────────────────────────────────────────────────────────

type ListingType = "marina" | "rv_park" | "mixed_use" | "land" | "business_only" | "other";
type ListingStatus = "active" | "under_contract" | "sold" | "unknown";
type ViewMode = "grid" | "list" | "table";
type SortField = "askingPrice" | "capRate" | "noi" | "revenue" | "slips" | "updatedAt" | "publishedAt";
type SortDir = "asc" | "desc";

interface Listing {
  id: string;
  canonicalListingId: string;
  sourceId: string;
  domain: string;
  title: string | null;
  listingType: ListingType | null;
  status: ListingStatus | null;
  askingPrice: number | null;
  currency: string | null;
  address1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  lat: string | null;
  lng: string | null;
  description: string | null;
  acreage: string | null;
  waterfrontFeet: number | null;
  slips: number | null;
  dryRacks: number | null;
  occupancy: number | null;
  capRate: string | null;
  noi: number | null;
  revenue: number | null;
  yearBuilt: number | null;
  zoning: string | null;
  brokerName: string | null;
  brokerCompany: string | null;
  brokerPhone: string | null;
  brokerEmail: string | null;
  heroImageUrl: string | null;
  imageCount: number | null;
  sourceUrl: string | null;
  publishedAt: string | null;
  lastExtractedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MarketplaceSource {
  id: string;
  name: string;
  domain: string;
  isActive: boolean;
  lastScrapedAt?: string;
  createdAt: string;
}

interface Filters {
  search: string;
  assetClasses: ListingType[];
  states: string[];
  priceMin: number | null;
  priceMax: number | null;
  capRateMin: number | null;
  capRateMax: number | null;
  noiMin: number | null;
  slipsMin: number | null;
  slipsMax: number | null;
  sources: string[];
  statuses: ListingStatus[];
  showBookmarkedOnly: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ASSET_CLASSES: { type: ListingType | "coming_soon"; label: string; icon: any; live: boolean }[] = [
  { type: "marina", label: "Marinas", icon: Anchor, live: true },
  { type: "rv_park", label: "RV Parks", icon: Truck, live: true },
  { type: "mixed_use", label: "Mixed Use", icon: Layers, live: true },
  { type: "land", label: "Land", icon: TreePine, live: true },
  { type: "business_only", label: "Business Only", icon: Store, live: true },
  { type: "other", label: "Other Marine", icon: Ship, live: true },
  { type: "coming_soon", label: "Self-Storage", icon: Home, live: false },
  { type: "coming_soon", label: "Industrial", icon: Factory, live: false },
  { type: "coming_soon", label: "Multifamily", icon: Building2, live: false },
  { type: "coming_soon", label: "Retail", icon: Store, live: false },
];

const STATUS_CONFIG: Record<ListingStatus, { label: string; color: string; dot: string }> = {
  active: { label: "Active", color: "text-emerald-700 bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
  under_contract: { label: "Under Contract", color: "text-amber-700 bg-amber-50 border-amber-200", dot: "bg-amber-500" },
  sold: { label: "Sold", color: "text-slate-600 bg-slate-100 border-slate-200", dot: "bg-slate-400" },
  unknown: { label: "Status TBD", color: "text-slate-500 bg-slate-50 border-slate-200", dot: "bg-slate-300" },
};

const SOURCE_COLORS: Record<string, string> = {
  "loopnet.com": "bg-blue-600",
  "crexi.com": "bg-violet-600",
  "marinabrokers.com": "bg-cyan-600",
  "merrittsmith.com": "bg-teal-600",
  "yachtworld.com": "bg-sky-600",
  "boats.com": "bg-indigo-600",
  "sunbeltnetwork.com": "bg-orange-600",
  "waterfrontventures.com": "bg-emerald-600",
  "marineassetpartners.com": "bg-slate-600",
  "marinaproperties.com": "bg-blue-700",
  "coastalmarinainvestments.com": "bg-teal-700",
  "firstboatmarinas.com": "bg-cyan-700",
  "marinamaxpartners.com": "bg-indigo-700",
};

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: "updatedAt", label: "Recently Updated" },
  { field: "publishedAt", label: "Date Listed" },
  { field: "askingPrice", label: "Asking Price" },
  { field: "capRate", label: "Cap Rate" },
  { field: "noi", label: "NOI" },
  { field: "revenue", label: "Revenue" },
  { field: "slips", label: "Slip Count" },
];

const DEFAULT_FILTERS: Filters = {
  search: "",
  assetClasses: [],
  states: [],
  priceMin: null,
  priceMax: null,
  capRateMin: null,
  capRateMax: null,
  noiMin: null,
  slipsMin: null,
  slipsMax: null,
  sources: [],
  statuses: ["active"],
  showBookmarkedOnly: false,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt$$(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtPct(n: string | number | null | undefined): string {
  if (n == null) return "—";
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(v)) return "—";
  return `${v.toFixed(2)}%`;
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

function sourceName(domain: string): string {
  const map: Record<string, string> = {
    "loopnet.com": "LoopNet",
    "crexi.com": "Crexi",
    "marinabrokers.com": "MarinaBrokers",
    "merrittsmith.com": "Merritt Smith",
    "yachtworld.com": "YachtWorld",
    "boats.com": "Boats.com",
    "sunbeltnetwork.com": "Sunbelt",
    "waterfrontventures.com": "WF Ventures",
    "marineassetpartners.com": "Marine Asset Partners",
    "marinaproperties.com": "Marina Properties",
    "coastalmarinainvestments.com": "Coastal Marina",
    "firstboatmarinas.com": "FirstBoat",
    "marinamaxpartners.com": "MarinaMax",
  };
  return map[domain] || domain.replace("www.", "").split(".")[0];
}

function locationStr(l: Listing): string {
  const parts = [l.city, l.state].filter(Boolean);
  return parts.join(", ") || l.country || "Location not disclosed";
}

function assetTypeLabel(t: ListingType | null): string {
  const map: Record<ListingType, string> = {
    marina: "Marina",
    rv_park: "RV Park",
    mixed_use: "Mixed Use",
    land: "Land",
    business_only: "Business",
    other: "Marine / Other",
  };
  return t ? map[t] : "Unknown Type";
}

function hasFinancials(l: Listing): boolean {
  return !!(l.askingPrice || l.capRate || l.noi || l.revenue);
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function MarketplaceListings() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [view, setView] = useState<ViewMode>("grid");
  const [sortField, setSortField] = useState<SortField>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [pipelineTarget, setPipelineTarget] = useState<Listing | null>(null);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const PER_PAGE = 48;

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: rawListings = [], isLoading, isFetching, refetch, dataUpdatedAt } = useQuery<Listing[]>({
    queryKey: ["/api/listings/v2/listings", filters.states[0], filters.sources[0]],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "500" });
      if (filters.states.length === 1) params.set("state", filters.states[0]);
      if (filters.sources.length === 1) params.set("domain", filters.sources[0]);
      const res = await fetch(`/api/listings/v2/listings?${params}`);
      if (!res.ok) throw new Error("Failed to load listings");
      return res.json();
    },
  });

  const { data: sourcesData } = useQuery<{ sources: MarketplaceSource[]; allowedDomains: string[] }>({
    queryKey: ["/api/listings/v2/marketplace/sources"],
    queryFn: async () => {
      const res = await fetch("/api/listings/v2/marketplace/sources");
      if (!res.ok) return { sources: [], allowedDomains: [] };
      return res.json();
    },
  });

  const { data: selectedDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["/api/listings/v2/listings", selectedListing?.canonicalListingId],
    queryFn: async () => {
      const res = await fetch(`/api/listings/v2/listings/${selectedListing!.canonicalListingId}`);
      if (!res.ok) return null;
      return res.json() as Promise<{ listing: Listing; assets: any[]; payloadHistory: any[] }>;
    },
    enabled: !!selectedListing,
  });

  // ── Client-side filtering & sorting ────────────────────────────────────────

  const filteredListings = useMemo(() => {
    let result = [...rawListings];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(l =>
        l.title?.toLowerCase().includes(q) ||
        l.city?.toLowerCase().includes(q) ||
        l.state?.toLowerCase().includes(q) ||
        l.brokerCompany?.toLowerCase().includes(q) ||
        l.description?.toLowerCase().includes(q)
      );
    }
    if (filters.assetClasses.length > 0) {
      result = result.filter(l => l.listingType && filters.assetClasses.includes(l.listingType));
    }
    if (filters.states.length > 1) {
      result = result.filter(l => l.state && filters.states.includes(l.state));
    }
    if (filters.sources.length > 0) {
      result = result.filter(l => filters.sources.includes(l.domain));
    }
    if (filters.statuses.length > 0) {
      result = result.filter(l => {
        const s = l.status || "unknown";
        return filters.statuses.includes(s as ListingStatus);
      });
    }
    if (filters.priceMin != null) {
      result = result.filter(l => l.askingPrice != null && l.askingPrice >= filters.priceMin!);
    }
    if (filters.priceMax != null) {
      result = result.filter(l => l.askingPrice != null && l.askingPrice <= filters.priceMax!);
    }
    if (filters.capRateMin != null) {
      result = result.filter(l => {
        const cr = l.capRate ? parseFloat(l.capRate) : null;
        return cr != null && cr >= filters.capRateMin!;
      });
    }
    if (filters.noiMin != null) {
      result = result.filter(l => l.noi != null && l.noi >= filters.noiMin!);
    }
    if (filters.slipsMin != null) {
      result = result.filter(l => l.slips != null && l.slips >= filters.slipsMin!);
    }
    if (filters.slipsMax != null) {
      result = result.filter(l => l.slips != null && l.slips <= filters.slipsMax!);
    }
    if (filters.showBookmarkedOnly) {
      result = result.filter(l => bookmarks.has(l.canonicalListingId));
    }

    // Sort
    result.sort((a, b) => {
      let av: any, bv: any;
      switch (sortField) {
        case "askingPrice": av = a.askingPrice ?? -Infinity; bv = b.askingPrice ?? -Infinity; break;
        case "capRate": av = a.capRate ? parseFloat(a.capRate) : -Infinity; bv = b.capRate ? parseFloat(b.capRate) : -Infinity; break;
        case "noi": av = a.noi ?? -Infinity; bv = b.noi ?? -Infinity; break;
        case "revenue": av = a.revenue ?? -Infinity; bv = b.revenue ?? -Infinity; break;
        case "slips": av = a.slips ?? -Infinity; bv = b.slips ?? -Infinity; break;
        case "publishedAt": av = a.publishedAt ? new Date(a.publishedAt).getTime() : 0; bv = b.publishedAt ? new Date(b.publishedAt).getTime() : 0; break;
        default: av = new Date(a.updatedAt).getTime(); bv = new Date(b.updatedAt).getTime();
      }
      return sortDir === "desc" ? bv - av : av - bv;
    });

    return result;
  }, [rawListings, filters, sortField, sortDir, bookmarks]);

  const pagedListings = filteredListings.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages = Math.ceil(filteredListings.length / PER_PAGE);

  // ── Active filter count ────────────────────────────────────────────────────

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.search) n++;
    if (filters.assetClasses.length) n++;
    if (filters.states.length) n++;
    if (filters.sources.length) n++;
    if (filters.priceMin != null || filters.priceMax != null) n++;
    if (filters.capRateMin != null) n++;
    if (filters.noiMin != null) n++;
    if (filters.slipsMin != null || filters.slipsMax != null) n++;
    if (filters.statuses.length !== 1 || filters.statuses[0] !== "active") n++;
    if (filters.showBookmarkedOnly) n++;
    return n;
  }, [filters]);

  const toggleBookmark = useCallback((id: string) => {
    setBookmarks(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(0);
  };

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [filters, sortField, sortDir]);

  // ── Source health ──────────────────────────────────────────────────────────
  const activeSources = sourcesData?.sources ?? [];
  const allDomains = [...new Set(rawListings.map(l => l.domain))].sort();

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <TooltipProvider>
      <div className="flex h-full min-h-0 bg-slate-50 dark:bg-slate-950">

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside
          className={cn(
            "flex-shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-200 overflow-y-auto",
            sidebarOpen ? "w-72" : "w-0 overflow-hidden"
          )}
        >
          <FilterSidebar
            filters={filters}
            onChange={f => setFilters(f)}
            onClear={clearFilters}
            domains={allDomains}
            activeCount={activeFilterCount}
          />
        </aside>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col">

          {/* Toolbar */}
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
            <div className="flex items-center gap-3 flex-wrap">

              {/* Sidebar toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSidebarOpen(o => !o)}
                className="flex-shrink-0"
              >
                {sidebarOpen ? <ChevronLeft className="h-4 w-4 mr-1" /> : <Filter className="h-4 w-4 mr-1" />}
                {sidebarOpen ? "Hide" : "Filters"}
                {!sidebarOpen && activeFilterCount > 0 && (
                  <span className="ml-1 bg-blue-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </Button>

              {/* Search */}
              <div className="relative flex-1 min-w-48 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  className="pl-8 h-8 text-sm"
                  placeholder="Search listings, cities, brokers…"
                  value={filters.search}
                  onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                />
                {filters.search && (
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => setFilters(f => ({ ...f, search: "" }))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Sort */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Select value={sortField} onValueChange={v => setSortField(v as SortField)}>
                  <SelectTrigger className="h-8 text-xs w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map(o => (
                      <SelectItem key={o.field} value={o.field} className="text-xs">{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
                >
                  {sortDir === "desc" ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
                </Button>
              </div>

              <div className="flex-1" />

              {/* Stats pill */}
              <div className="text-xs text-slate-500 flex-shrink-0 hidden sm:block">
                <span className="font-semibold text-slate-800 dark:text-slate-200">{filteredListings.length.toLocaleString()}</span>
                <span className="mx-1">of</span>
                <span>{rawListings.length.toLocaleString()}</span>
                <span className="ml-1">listings</span>
                {dataUpdatedAt && (
                  <span className="ml-2 text-slate-400">· synced {formatDistanceToNow(dataUpdatedAt)} ago</span>
                )}
              </div>

              {/* Refresh */}
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0" onClick={() => refetch()}>
                <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
              </Button>

              {/* View toggle */}
              <div className="flex border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden flex-shrink-0">
                {(["grid", "list", "table"] as ViewMode[]).map(v => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={cn(
                      "h-8 w-8 flex items-center justify-center transition-colors",
                      view === v
                        ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    {v === "grid" ? <LayoutGrid className="h-3.5 w-3.5" /> :
                     v === "list" ? <List className="h-3.5 w-3.5" /> :
                     <Table className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Active filter chips */}
            {activeFilterCount > 0 && (
              <div className="flex gap-1.5 flex-wrap mt-2">
                {filters.assetClasses.map(ac => (
                  <FilterChip key={ac} label={assetTypeLabel(ac)} onRemove={() =>
                    setFilters(f => ({ ...f, assetClasses: f.assetClasses.filter(x => x !== ac) }))} />
                ))}
                {filters.states.map(s => (
                  <FilterChip key={s} label={s} onRemove={() =>
                    setFilters(f => ({ ...f, states: f.states.filter(x => x !== s) }))} />
                ))}
                {filters.sources.map(d => (
                  <FilterChip key={d} label={sourceName(d)} onRemove={() =>
                    setFilters(f => ({ ...f, sources: f.sources.filter(x => x !== d) }))} />
                ))}
                {(filters.priceMin != null || filters.priceMax != null) && (
                  <FilterChip
                    label={`Price: ${filters.priceMin != null ? fmt$$(filters.priceMin) : "Any"} – ${filters.priceMax != null ? fmt$$(filters.priceMax) : "Any"}`}
                    onRemove={() => setFilters(f => ({ ...f, priceMin: null, priceMax: null }))}
                  />
                )}
                {filters.capRateMin != null && (
                  <FilterChip label={`Cap Rate ≥ ${filters.capRateMin}%`} onRemove={() =>
                    setFilters(f => ({ ...f, capRateMin: null }))} />
                )}
                {filters.noiMin != null && (
                  <FilterChip label={`NOI ≥ ${fmt$$(filters.noiMin)}`} onRemove={() =>
                    setFilters(f => ({ ...f, noiMin: null }))} />
                )}
                {filters.showBookmarkedOnly && (
                  <FilterChip label="Saved only" onRemove={() =>
                    setFilters(f => ({ ...f, showBookmarkedOnly: false }))} />
                )}
                <button
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium px-1"
                  onClick={clearFilters}
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* Source health strip */}
          <SourceHealthStrip domains={allDomains} listingCounts={
            Object.fromEntries(allDomains.map(d => [d, rawListings.filter(l => l.domain === d).length]))
          } />

          {/* Listings body */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <LoadingState view={view} />
            ) : filteredListings.length === 0 ? (
              <EmptyState hasFilters={activeFilterCount > 0} onClear={clearFilters} />
            ) : view === "table" ? (
              <ListingTable
                listings={pagedListings}
                bookmarks={bookmarks}
                onToggleBookmark={toggleBookmark}
                onSelect={setSelectedListing}
                onAddToPipeline={setPipelineTarget}
                sortField={sortField}
                sortDir={sortDir}
                onSort={toggleSort}
              />
            ) : view === "list" ? (
              <div className="space-y-2">
                {pagedListings.map(l => (
                  <ListingRowCard
                    key={l.id}
                    listing={l}
                    isBookmarked={bookmarks.has(l.canonicalListingId)}
                    onToggleBookmark={() => toggleBookmark(l.canonicalListingId)}
                    onSelect={() => setSelectedListing(l)}
                    onAddToPipeline={() => setPipelineTarget(l)}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {pagedListings.map(l => (
                  <ListingCard
                    key={l.id}
                    listing={l}
                    isBookmarked={bookmarks.has(l.canonicalListingId)}
                    onToggleBookmark={() => toggleBookmark(l.canonicalListingId)}
                    onSelect={() => setSelectedListing(l)}
                    onAddToPipeline={() => setPipelineTarget(l)}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-slate-600">
                  Page {page + 1} of {totalPages}
                </span>
                <Button variant="outline" size="sm" disabled={page === totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ── Detail Panel ─────────────────────────────────────────────────── */}
        {selectedListing && (
          <ListingDetailPanel
            listing={selectedListing}
            detail={selectedDetail ?? null}
            isLoading={detailLoading}
            isBookmarked={bookmarks.has(selectedListing.canonicalListingId)}
            onToggleBookmark={() => toggleBookmark(selectedListing.canonicalListingId)}
            onClose={() => setSelectedListing(null)}
            onAddToPipeline={() => { setPipelineTarget(selectedListing); }}
          />
        )}

        {/* ── Add to Pipeline Modal ────────────────────────────────────────── */}
        {pipelineTarget && (
          <AddToPipelineModal
            listing={pipelineTarget}
            onClose={() => setPipelineTarget(null)}
            onSuccess={() => {
              setPipelineTarget(null);
              toast({
                title: "Added to Pipeline",
                description: `"${pipelineTarget.title || "Listing"}" is now in your sourced deals queue.`,
              });
            }}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

// ─── Filter Chip ──────────────────────────────────────────────────────────────

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
      {label}
      <button onClick={onRemove} className="hover:text-blue-900"><X className="h-3 w-3" /></button>
    </span>
  );
}

// ─── Source Health Strip ──────────────────────────────────────────────────────

function SourceHealthStrip({ domains, listingCounts }: { domains: string[]; listingCounts: Record<string, number> }) {
  if (domains.length === 0) return null;
  return (
    <div className="bg-slate-900 dark:bg-slate-950 px-4 py-2 flex items-center gap-3 overflow-x-auto">
      <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest flex-shrink-0">Live Sources</span>
      {domains.map(d => (
        <div key={d} className="flex items-center gap-1.5 flex-shrink-0">
          <span className={cn("h-1.5 w-1.5 rounded-full", SOURCE_COLORS[d] || "bg-slate-400")} />
          <span className="text-slate-300 text-[11px]">{sourceName(d)}</span>
          <span className="text-slate-500 text-[11px]">({listingCounts[d]})</span>
        </div>
      ))}
    </div>
  );
}

// ─── Filter Sidebar ───────────────────────────────────────────────────────────

function FilterSidebar({
  filters,
  onChange,
  onClear,
  domains,
  activeCount,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  onClear: () => void;
  domains: string[];
  activeCount: number;
}) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeCount > 0 && (
            <span className="bg-blue-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">{activeCount}</span>
          )}
        </span>
        {activeCount > 0 && (
          <button className="text-xs text-slate-400 hover:text-slate-600" onClick={onClear}>Reset</button>
        )}
      </div>

      {/* Asset Class */}
      <FilterSection title="Asset Class">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {ASSET_CLASSES.map(ac => (
            <button
              key={`${ac.type}-${ac.label}`}
              disabled={!ac.live}
              onClick={() => {
                if (!ac.live || ac.type === "coming_soon") return;
                const t = ac.type as ListingType;
                set({
                  assetClasses: filters.assetClasses.includes(t)
                    ? filters.assetClasses.filter(x => x !== t)
                    : [...filters.assetClasses, t],
                });
              }}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium border transition-all",
                !ac.live && "opacity-40 cursor-not-allowed",
                ac.live && ac.type !== "coming_soon" && filters.assetClasses.includes(ac.type as ListingType)
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300 hover:text-blue-700"
              )}
            >
              <ac.icon className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{ac.label}</span>
              {!ac.live && <span className="ml-auto text-[8px] uppercase tracking-wide opacity-70">Soon</span>}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Status */}
      <FilterSection title="Status">
        <div className="space-y-1.5">
          {(["active", "under_contract", "sold", "unknown"] as ListingStatus[]).map(s => {
            const cfg = STATUS_CONFIG[s];
            return (
              <label key={s} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={filters.statuses.includes(s)}
                  onCheckedChange={checked => {
                    set({
                      statuses: checked
                        ? [...filters.statuses, s]
                        : filters.statuses.filter(x => x !== s),
                    });
                  }}
                />
                <span className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                  <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
                  {cfg.label}
                </span>
              </label>
            );
          })}
        </div>
      </FilterSection>

      {/* Geography */}
      <FilterSection title="State / Region">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 max-h-44 overflow-y-auto">
          {US_STATES.map(s => (
            <button
              key={s}
              onClick={() => {
                set({
                  states: filters.states.includes(s)
                    ? filters.states.filter(x => x !== s)
                    : [...filters.states, s],
                });
              }}
              className={cn(
                "text-[11px] font-mono py-0.5 rounded border text-center transition-all",
                filters.states.includes(s)
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "border-slate-200 text-slate-600 hover:border-blue-300"
              )}
            >
              {s}
            </button>
          ))}
        </div>
        {filters.states.length > 0 && (
          <button className="text-xs text-slate-400 hover:text-slate-600 mt-1" onClick={() => set({ states: [] })}>
            Clear states
          </button>
        )}
      </FilterSection>

      {/* Price Range */}
      <FilterSection title="Asking Price">
        <div className="flex gap-2">
          <div>
            <Label className="text-[10px] text-slate-500 uppercase tracking-wide">Min</Label>
            <PriceInput
              value={filters.priceMin}
              onChange={v => set({ priceMin: v })}
              placeholder="$0"
            />
          </div>
          <div>
            <Label className="text-[10px] text-slate-500 uppercase tracking-wide">Max</Label>
            <PriceInput
              value={filters.priceMax}
              onChange={v => set({ priceMax: v })}
              placeholder="No max"
            />
          </div>
        </div>
      </FilterSection>

      {/* Cap Rate */}
      <FilterSection title="Cap Rate (min %)">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            step="0.25"
            min="0"
            max="30"
            className="h-8 text-sm"
            placeholder="e.g. 6.5"
            value={filters.capRateMin ?? ""}
            onChange={e => set({ capRateMin: e.target.value ? parseFloat(e.target.value) : null })}
          />
          {filters.capRateMin != null && (
            <button onClick={() => set({ capRateMin: null })}><X className="h-3.5 w-3.5 text-slate-400" /></button>
          )}
        </div>
      </FilterSection>

      {/* NOI */}
      <FilterSection title="NOI (min)">
        <PriceInput value={filters.noiMin} onChange={v => set({ noiMin: v })} placeholder="$0" />
      </FilterSection>

      {/* Slips */}
      <FilterSection title="Slip Count">
        <div className="flex gap-2">
          <div>
            <Label className="text-[10px] text-slate-500 uppercase tracking-wide">Min</Label>
            <Input
              type="number"
              className="h-8 text-sm w-20"
              placeholder="Any"
              value={filters.slipsMin ?? ""}
              onChange={e => set({ slipsMin: e.target.value ? parseInt(e.target.value) : null })}
            />
          </div>
          <div>
            <Label className="text-[10px] text-slate-500 uppercase tracking-wide">Max</Label>
            <Input
              type="number"
              className="h-8 text-sm w-20"
              placeholder="Any"
              value={filters.slipsMax ?? ""}
              onChange={e => set({ slipsMax: e.target.value ? parseInt(e.target.value) : null })}
            />
          </div>
        </div>
      </FilterSection>

      {/* Sources */}
      <FilterSection title="Data Sources">
        <div className="space-y-1.5">
          {domains.map(d => (
            <label key={d} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={filters.sources.includes(d)}
                onCheckedChange={checked => {
                  set({
                    sources: checked
                      ? [...filters.sources, d]
                      : filters.sources.filter(x => x !== d),
                  });
                }}
              />
              <span className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                <span className={cn("h-1.5 w-1.5 rounded-full", SOURCE_COLORS[d] || "bg-slate-400")} />
                {sourceName(d)}
              </span>
            </label>
          ))}
          {domains.length === 0 && (
            <p className="text-xs text-slate-400">No sources loaded yet</p>
          )}
        </div>
      </FilterSection>

      {/* Bookmarked */}
      <label className="flex items-center gap-2 cursor-pointer">
        <Checkbox
          checked={filters.showBookmarkedOnly}
          onCheckedChange={checked => set({ showBookmarkedOnly: !!checked })}
        />
        <span className="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1">
          <Bookmark className="h-3 w-3" />
          Saved listings only
        </span>
      </label>

      {/* Asset class expansion notice */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-gradient-to-br from-blue-50 to-slate-50 dark:from-blue-950 dark:to-slate-900">
        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-1">
          <Zap className="h-3 w-3 text-blue-500" />
          Asset Class Expansion
        </p>
        <p className="text-[11px] text-slate-600 dark:text-slate-400">
          Select any asset class above to queue automated scraping. Self-storage, industrial, multifamily, and retail coverage launching soon.
        </p>
      </div>
    </div>
  );
}

// ─── Filter Section ───────────────────────────────────────────────────────────

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        className="flex items-center justify-between w-full mb-2"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">{title}</span>
        {open ? <ChevronDown className="h-3 w-3 text-slate-400" /> : <ChevronRight className="h-3 w-3 text-slate-400" />}
      </button>
      {open && children}
    </div>
  );
}

// ─── Price Input ──────────────────────────────────────────────────────────────

function PriceInput({ value, onChange, placeholder }: { value: number | null; onChange: (v: number | null) => void; placeholder: string }) {
  const [raw, setRaw] = useState(value != null ? String(value) : "");

  const commit = () => {
    const cleaned = raw.replace(/[$,\s]/g, "");
    const n = parseFloat(cleaned);
    onChange(isNaN(n) ? null : n);
  };

  return (
    <Input
      className="h-8 text-sm"
      placeholder={placeholder}
      value={raw}
      onChange={e => setRaw(e.target.value)}
      onBlur={commit}
    />
  );
}

// ─── Listing Card (Grid) ──────────────────────────────────────────────────────

function ListingCard({
  listing: l,
  isBookmarked,
  onToggleBookmark,
  onSelect,
  onAddToPipeline,
}: {
  listing: Listing;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onSelect: () => void;
  onAddToPipeline: () => void;
}) {
  const status = l.status ?? "unknown";
  const statusCfg = STATUS_CONFIG[status as ListingStatus] ?? STATUS_CONFIG.unknown;

  return (
    <div className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden hover:border-blue-300 hover:shadow-md transition-all duration-150 flex flex-col">
      
      {/* Hero image */}
      <div className="relative h-44 bg-slate-100 dark:bg-slate-800 overflow-hidden cursor-pointer" onClick={onSelect}>
        {l.heroImageUrl ? (
          <img
            src={l.heroImageUrl}
            alt={l.title ?? "Listing"}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Anchor className="h-12 w-12 text-slate-300 dark:text-slate-600" />
          </div>
        )}

        {/* Source badge */}
        <div className="absolute top-2 left-2">
          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full text-white", SOURCE_COLORS[l.domain] || "bg-slate-500")}>
            {sourceName(l.domain)}
          </span>
        </div>

        {/* Status badge */}
        <div className="absolute top-2 right-2">
          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1", statusCfg.color)}>
            <span className={cn("h-1 w-1 rounded-full", statusCfg.dot)} />
            {statusCfg.label}
          </span>
        </div>

        {/* Image count */}
        {(l.imageCount ?? 0) > 1 && (
          <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
            <Eye className="h-2.5 w-2.5" />
            {l.imageCount}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3 flex flex-col flex-1">
        {/* Type tag */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
            {assetTypeLabel(l.listingType)}
          </span>
          <button onClick={onToggleBookmark} className="text-slate-300 hover:text-amber-500 transition-colors">
            {isBookmarked ? <BookmarkCheck className="h-4 w-4 text-amber-500" /> : <Bookmark className="h-4 w-4" />}
          </button>
        </div>

        {/* Title */}
        <h3
          className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-snug mb-1.5 line-clamp-2 cursor-pointer hover:text-blue-700"
          onClick={onSelect}
        >
          {l.title || "Untitled Listing"}
        </h3>

        {/* Location */}
        <p className="text-xs text-slate-500 flex items-center gap-1 mb-3">
          <MapPin className="h-3 w-3 flex-shrink-0" />
          {locationStr(l)}
        </p>

        {/* Metrics grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 mb-3">
          <MetricCell label="Price" value={fmt$$(l.askingPrice)} highlight />
          <MetricCell label="Cap Rate" value={fmtPct(l.capRate)} />
          <MetricCell label="NOI" value={fmt$$(l.noi)} />
          <MetricCell label="Revenue" value={fmt$$(l.revenue)} />
          {l.slips != null && <MetricCell label="Slips" value={fmtNum(l.slips)} />}
          {l.dryRacks != null && <MetricCell label="Dry Racks" value={fmtNum(l.dryRacks)} />}
          {l.acreage && <MetricCell label="Acres" value={parseFloat(l.acreage).toFixed(1)} />}
          {l.waterfrontFeet != null && <MetricCell label="WF Feet" value={fmtNum(l.waterfrontFeet)} />}
        </div>

        {/* Broker */}
        {l.brokerName && (
          <p className="text-[11px] text-slate-400 mb-3 truncate">
            {l.brokerName}{l.brokerCompany ? ` · ${l.brokerCompany}` : ""}
          </p>
        )}

        <div className="flex-1" />

        {/* Actions */}
        <div className="flex gap-2 mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            size="sm"
            className="flex-1 h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
            onClick={onAddToPipeline}
          >
            <PlusCircle className="h-3 w-3 mr-1" />
            Add to Pipeline
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onSelect}
          >
            <Eye className="h-3 w-3" />
          </Button>
          {l.sourceUrl && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => window.open(l.sourceUrl!, "_blank")}
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Metric Cell ──────────────────────────────────────────────────────────────

function MetricCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={cn(
        "text-sm font-mono font-semibold",
        highlight ? "text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-300",
        value === "—" && "text-slate-300 dark:text-slate-600"
      )}>
        {value}
      </p>
    </div>
  );
}

// ─── Listing Row Card (List view) ─────────────────────────────────────────────

function ListingRowCard({
  listing: l,
  isBookmarked,
  onToggleBookmark,
  onSelect,
  onAddToPipeline,
}: {
  listing: Listing;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onSelect: () => void;
  onAddToPipeline: () => void;
}) {
  const statusCfg = STATUS_CONFIG[l.status ?? "unknown"] ?? STATUS_CONFIG.unknown;
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3 flex items-center gap-4 hover:border-blue-300 hover:shadow-sm transition-all group">
      {/* Thumbnail */}
      <div
        className="h-14 w-20 flex-shrink-0 rounded-md bg-slate-100 dark:bg-slate-800 overflow-hidden cursor-pointer"
        onClick={onSelect}
      >
        {l.heroImageUrl ? (
          <img src={l.heroImageUrl} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Anchor className="h-5 w-5 text-slate-300" />
          </div>
        )}
      </div>

      {/* Title + location */}
      <div className="flex-1 min-w-0" onClick={onSelect}>
        <div className="flex items-center gap-2 mb-0.5">
          <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded text-white", SOURCE_COLORS[l.domain] || "bg-slate-500")}>
            {sourceName(l.domain)}
          </span>
          <span className="text-[10px] text-slate-400">{assetTypeLabel(l.listingType)}</span>
        </div>
        <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate cursor-pointer hover:text-blue-700">
          {l.title || "Untitled Listing"}
        </p>
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <MapPin className="h-2.5 w-2.5" />{locationStr(l)}
        </p>
      </div>

      {/* Metrics row */}
      <div className="hidden md:flex items-center gap-6 flex-shrink-0">
        <div className="text-center">
          <p className="text-[10px] text-slate-400">Price</p>
          <p className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200">{fmt$$(l.askingPrice)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-400">Cap</p>
          <p className="text-sm font-mono font-semibold text-slate-700 dark:text-slate-300">{fmtPct(l.capRate)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-400">NOI</p>
          <p className="text-sm font-mono font-semibold text-slate-700 dark:text-slate-300">{fmt$$(l.noi)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-400">Slips</p>
          <p className="text-sm font-mono font-semibold text-slate-700 dark:text-slate-300">{fmtNum(l.slips)}</p>
        </div>
      </div>

      {/* Status */}
      <span className={cn("hidden lg:flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border", statusCfg.color)}>
        <span className={cn("h-1 w-1 rounded-full", statusCfg.dot)} />{statusCfg.label}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button onClick={onToggleBookmark} className="text-slate-300 hover:text-amber-500 transition-colors p-1">
          {isBookmarked ? <BookmarkCheck className="h-4 w-4 text-amber-500" /> : <Bookmark className="h-4 w-4" />}
        </button>
        <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={onAddToPipeline}>
          <PlusCircle className="h-3 w-3 mr-1" />
          Add
        </Button>
        {l.sourceUrl && (
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => window.open(l.sourceUrl!, "_blank")}>
            <ExternalLink className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Listing Table ────────────────────────────────────────────────────────────

function ListingTable({
  listings,
  bookmarks,
  onToggleBookmark,
  onSelect,
  onAddToPipeline,
  sortField,
  sortDir,
  onSort,
}: {
  listings: Listing[];
  bookmarks: Set<string>;
  onToggleBookmark: (id: string) => void;
  onSelect: (l: Listing) => void;
  onAddToPipeline: (l: Listing) => void;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
}) {
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-slate-300" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-blue-500" /> : <ArrowDown className="h-3 w-3 text-blue-500" />;
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Source</th>
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Listing</th>
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Location</th>
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Type</th>
              <SortTH field="askingPrice" label="Price" current={sortField} dir={sortDir} onSort={onSort} />
              <SortTH field="capRate" label="Cap" current={sortField} dir={sortDir} onSort={onSort} />
              <SortTH field="noi" label="NOI" current={sortField} dir={sortDir} onSort={onSort} />
              <SortTH field="revenue" label="Revenue" current={sortField} dir={sortDir} onSort={onSort} />
              <SortTH field="slips" label="Slips" current={sortField} dir={sortDir} onSort={onSort} />
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Status</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {listings.map(l => {
              const sc = STATUS_CONFIG[l.status ?? "unknown"] ?? STATUS_CONFIG.unknown;
              return (
                <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="px-3 py-2">
                    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded text-white", SOURCE_COLORS[l.domain] || "bg-slate-500")}>
                      {sourceName(l.domain)}
                    </span>
                  </td>
                  <td className="px-3 py-2 max-w-xs">
                    <p
                      className="font-medium text-slate-900 dark:text-slate-100 truncate cursor-pointer hover:text-blue-700"
                      onClick={() => onSelect(l)}
                    >
                      {l.title || "Untitled"}
                    </p>
                    {l.brokerName && <p className="text-[11px] text-slate-400 truncate">{l.brokerName}</p>}
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">{locationStr(l)}</td>
                  <td className="px-3 py-2 text-[11px] text-slate-500">{assetTypeLabel(l.listingType)}</td>
                  <td className="px-3 py-2 font-mono font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{fmt$$(l.askingPrice)}</td>
                  <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300">{fmtPct(l.capRate)}</td>
                  <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">{fmt$$(l.noi)}</td>
                  <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">{fmt$$(l.revenue)}</td>
                  <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300">{fmtNum(l.slips)}</td>
                  <td className="px-3 py-2">
                    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full border flex items-center gap-1 w-fit", sc.color)}>
                      <span className={cn("h-1 w-1 rounded-full", sc.dot)} />{sc.label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onToggleBookmark(l.canonicalListingId)} className="text-slate-300 hover:text-amber-500">
                        {bookmarks.has(l.canonicalListingId) ? <BookmarkCheck className="h-3.5 w-3.5 text-amber-500" /> : <Bookmark className="h-3.5 w-3.5" />}
                      </button>
                      <Button size="sm" className="h-6 text-[11px] bg-blue-600 hover:bg-blue-700 text-white" onClick={() => onAddToPipeline(l)}>
                        + Pipeline
                      </Button>
                      {l.sourceUrl && (
                        <button onClick={() => window.open(l.sourceUrl!, "_blank")} className="text-slate-400 hover:text-slate-600">
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortTH({ field, label, current, dir, onSort }: {
  field: SortField; label: string; current: SortField; dir: SortDir; onSort: (f: SortField) => void;
}) {
  return (
    <th
      className="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest cursor-pointer hover:text-slate-800 select-none"
      onClick={() => onSort(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        {current === field
          ? dir === "asc" ? <ArrowUp className="h-2.5 w-2.5 text-blue-500" /> : <ArrowDown className="h-2.5 w-2.5 text-blue-500" />
          : <ArrowUpDown className="h-2.5 w-2.5 text-slate-300" />}
      </span>
    </th>
  );
}

// ─── Listing Detail Panel ─────────────────────────────────────────────────────

function ListingDetailPanel({
  listing: l,
  detail,
  isLoading,
  isBookmarked,
  onToggleBookmark,
  onClose,
  onAddToPipeline,
}: {
  listing: Listing;
  detail: { listing: Listing; assets: any[]; payloadHistory: any[] } | null;
  isLoading: boolean;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onClose: () => void;
  onAddToPipeline: () => void;
}) {
  const full = detail?.listing ?? l;
  const assets = detail?.assets ?? [];
  const statusCfg = STATUS_CONFIG[l.status ?? "unknown"] ?? STATUS_CONFIG.unknown;

  return (
    <div className="w-full md:w-[480px] flex-shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded text-white", SOURCE_COLORS[l.domain] || "bg-slate-500")}>
              {sourceName(l.domain)}
            </span>
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1", statusCfg.color)}>
              <span className={cn("h-1 w-1 rounded-full", statusCfg.dot)} />{statusCfg.label}
            </span>
          </div>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-base leading-snug">{l.title || "Untitled Listing"}</h2>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
            <MapPin className="h-3 w-3" />{locationStr(l)}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={onToggleBookmark} className="text-slate-300 hover:text-amber-500 transition-colors">
            {isBookmarked ? <BookmarkCheck className="h-5 w-5 text-amber-500" /> : <Bookmark className="h-5 w-5" />}
          </button>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-0.5 hover:bg-slate-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : (
          <>
            {/* Gallery */}
            {(full.heroImageUrl || assets.length > 0) && (
              <div className="relative h-56 bg-slate-100 dark:bg-slate-800">
                <img
                  src={full.heroImageUrl ?? assets[0]?.assetUrlNormalized}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                {assets.length > 1 && (
                  <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded">
                    +{assets.length - 1} photos
                  </div>
                )}
              </div>
            )}

            <div className="p-5 space-y-5">
              {/* Key metrics */}
              <div>
                <SectionLabel>Financial Snapshot</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <DetailMetric label="Asking Price" value={fmt$$(full.askingPrice)} size="lg" accent />
                  <DetailMetric label="Cap Rate" value={fmtPct(full.capRate)} size="lg" />
                  <DetailMetric label="NOI" value={fmt$$(full.noi)} />
                  <DetailMetric label="Gross Revenue" value={fmt$$(full.revenue)} />
                  <DetailMetric label="Occupancy" value={full.occupancy != null ? `${full.occupancy}%` : "—"} />
                  <DetailMetric label="Year Built" value={full.yearBuilt != null ? String(full.yearBuilt) : "—"} />
                </div>
              </div>

              {/* Property metrics */}
              {(full.slips || full.dryRacks || full.waterfrontFeet || full.acreage) && (
                <div>
                  <SectionLabel>Property Details</SectionLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {full.slips != null && <DetailMetric label="Wet Slips" value={fmtNum(full.slips)} />}
                    {full.dryRacks != null && <DetailMetric label="Dry Racks" value={fmtNum(full.dryRacks)} />}
                    {full.waterfrontFeet != null && <DetailMetric label="Waterfront (ft)" value={fmtNum(full.waterfrontFeet)} />}
                    {full.acreage && <DetailMetric label="Acreage" value={`${parseFloat(full.acreage).toFixed(1)} ac`} />}
                    {full.zoning && <DetailMetric label="Zoning" value={full.zoning} />}
                    <DetailMetric label="Asset Type" value={assetTypeLabel(full.listingType)} />
                  </div>
                </div>
              )}

              {/* Description */}
              {full.description && (
                <div>
                  <SectionLabel>Description</SectionLabel>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-6">
                    {full.description}
                  </p>
                </div>
              )}

              {/* Broker */}
              {(full.brokerName || full.brokerCompany) && (
                <div>
                  <SectionLabel>Listing Broker</SectionLabel>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                    <p className="font-medium text-sm text-slate-800 dark:text-slate-200">{full.brokerName}</p>
                    {full.brokerCompany && <p className="text-xs text-slate-500">{full.brokerCompany}</p>}
                    <div className="mt-2 flex gap-3">
                      {full.brokerPhone && (
                        <a href={`tel:${full.brokerPhone}`} className="text-xs text-blue-600 hover:underline">{full.brokerPhone}</a>
                      )}
                      {full.brokerEmail && (
                        <a href={`mailto:${full.brokerEmail}`} className="text-xs text-blue-600 hover:underline">{full.brokerEmail}</a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Provenance */}
              <div>
                <SectionLabel>Data Provenance</SectionLabel>
                <div className="space-y-1.5 text-xs text-slate-500">
                  <div className="flex justify-between">
                    <span>Source</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{sourceName(l.domain)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Synced</span>
                    <span>{full.lastExtractedAt ? format(new Date(full.lastExtractedAt), "MMM d, yyyy") : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>First Seen</span>
                    <span>{format(new Date(full.createdAt), "MMM d, yyyy")}</span>
                  </div>
                  {full.publishedAt && (
                    <div className="flex justify-between">
                      <span>Published</span>
                      <span>{format(new Date(full.publishedAt), "MMM d, yyyy")}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Listing ID</span>
                    <span className="font-mono text-[10px]">{full.canonicalListingId.slice(0, 16)}…</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer actions */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
        <Button
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          onClick={onAddToPipeline}
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          Add to Pipeline
        </Button>
        <div className="flex gap-2">
          {l.sourceUrl && (
            <Button variant="outline" className="flex-1" size="sm" onClick={() => window.open(l.sourceUrl!, "_blank")}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Original Listing
            </Button>
          )}
          <Button variant="outline" className="flex-1" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">{children}</p>;
}

function DetailMetric({ label, value, size, accent }: { label: string; value: string; size?: "lg"; accent?: boolean }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
      <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className={cn(
        "font-mono font-semibold",
        size === "lg" ? "text-base" : "text-sm",
        accent ? "text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-300",
        value === "—" && "text-slate-300 dark:text-slate-600"
      )}>
        {value}
      </p>
    </div>
  );
}

// ─── Add to Pipeline Modal ────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { value: "new", label: "New — Inbox", description: "Unreviewed, just arrived" },
  { value: "reviewing", label: "Reviewing", description: "Under initial evaluation" },
  { value: "qualified", label: "Qualified", description: "Passed initial screens" },
] as const;

function AddToPipelineModal({
  listing: l,
  onClose,
  onSuccess,
}: {
  listing: Listing;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [stage, setStage] = useState<"new" | "reviewing" | "qualified">("new");
  const [notes, setNotes] = useState("");
  const [dealName, setDealName] = useState(l.title || "");

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        propertyName: dealName || l.title || "Untitled",
        status: stage,
        sourceType: "web_scrape",
        address: l.address1,
        city: l.city,
        state: l.state,
        askingPrice: l.askingPrice?.toString(),
        grossRevenue: l.revenue?.toString(),
        noi: l.noi?.toString(),
        capRate: l.capRate,
        totalSlips: l.slips,
        notes,
        externalId: l.canonicalListingId,
        externalUrl: l.sourceUrl,
        externalSource: l.domain,
        rawData: {
          domain: l.domain,
          listingType: l.listingType,
          acreage: l.acreage,
          waterfrontFeet: l.waterfrontFeet,
          dryRacks: l.dryRacks,
          yearBuilt: l.yearBuilt,
          brokerName: l.brokerName,
          brokerCompany: l.brokerCompany,
          brokerPhone: l.brokerPhone,
          brokerEmail: l.brokerEmail,
          heroImageUrl: l.heroImageUrl,
          scrapedAt: l.updatedAt,
        },
      };
      return apiRequest("POST", "/api/marinamatch/sourced-deals", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/marinamatch/sourced-deals"] });
      onSuccess();
    },
    onError: (err: any) => {
      // If duplicate, still show info
      if (err?.message?.includes("duplicate") || err?.status === 409) {
        toast({
          title: "Already in Pipeline",
          description: "This listing is already in your sourced deals. It has been flagged as a duplicate.",
        });
        onClose();
      } else {
        toast({
          title: "Error",
          description: err.message || "Failed to add to pipeline",
          variant: "destructive",
        });
      }
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-blue-600" />
            Add to Pipeline
          </DialogTitle>
          <DialogDescription>
            This listing will be added to your Sourced Deals queue, auto-scored against your investment mandates.
          </DialogDescription>
        </DialogHeader>

        {/* Listing summary */}
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 flex gap-3">
          <div className="h-14 w-16 rounded-md bg-slate-200 dark:bg-slate-700 overflow-hidden flex-shrink-0">
            {l.heroImageUrl && (
              <img src={l.heroImageUrl} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">{l.title || "Untitled"}</p>
            <p className="text-xs text-slate-500">{locationStr(l)}</p>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{fmt$$(l.askingPrice)}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Deal name */}
          <div>
            <Label className="text-xs">Deal Name</Label>
            <Input
              value={dealName}
              onChange={e => setDealName(e.target.value)}
              placeholder="e.g. Palm Harbor Marina — 220 Slips"
              className="mt-1"
            />
          </div>

          {/* Stage */}
          <div>
            <Label className="text-xs mb-2 block">Initial Stage</Label>
            <div className="space-y-2">
              {PIPELINE_STAGES.map(s => (
                <label key={s.value} className="flex items-center gap-3 cursor-pointer p-2.5 rounded-lg border transition-all hover:bg-slate-50"
                  style={{ borderColor: stage === s.value ? "#2563eb" : undefined, background: stage === s.value ? "#eff6ff" : undefined }}>
                  <input type="radio" name="stage" value={s.value} checked={stage === s.value}
                    onChange={() => setStage(s.value)} className="text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{s.label}</p>
                    <p className="text-xs text-slate-500">{s.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Initial observations, source context, follow-up items…"
              rows={3}
              className="mt-1 text-sm"
            />
          </div>

          {/* Auto-score notice */}
          <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <Zap className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              This deal will be automatically scored against all your active investment mandates. Check the Sourced Deals tab to see results.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Adding…</>
            ) : (
              <><PlusCircle className="h-4 w-4 mr-2" />Add to Pipeline</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Loading / Empty States ───────────────────────────────────────────────────

function LoadingState({ view }: { view: ViewMode }) {
  if (view === "grid") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 rounded-xl overflow-hidden">
            <Skeleton className="h-44 w-full rounded-none" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {[1,2,3,4].map(j => <Skeleton key={j} className="h-8" />)}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <Anchor className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
        {hasFilters ? "No listings match your filters" : "No listings loaded yet"}
      </h3>
      <p className="text-sm text-slate-500 mb-4 max-w-sm">
        {hasFilters
          ? "Try adjusting your filters or clearing them to see all available listings."
          : "Listings are scraped automatically from configured sources. Check the Data Sources tab to verify sources are active."}
      </p>
      {hasFilters && (
        <Button variant="outline" onClick={onClear}>
          <X className="h-4 w-4 mr-2" />
          Clear Filters
        </Button>
      )}
    </div>
  );
}

export default MarketplaceListings;

import { useMemo } from "react";
import { Link, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowRight, Building2, Store, Anchor, Factory, Warehouse, Home, Utensils,
  Users, DollarSign, Percent, TrendingUp, Briefcase, Wrench, Car, ShoppingCart,
  Fuel, Ship, BookOpen, CreditCard, BarChart3, Megaphone, Plus, ExternalLink,
  Sparkles, FileText, Layers,
} from "lucide-react";
import { useEnabledOpsModules } from "@/hooks/use-enabled-ops-modules";
import {
  ASSET_CLASS_CATALOGS,
  getAssetClassCatalog,
  hasAssetClassCatalog,
} from "@shared/asset-class-catalog";
import {
  OPS_MODULE_DEFINITIONS,
  getOpsModulesForAssetClass,
  type OpsModuleKey,
} from "@shared/asset-class-ops-modules";
import { ASSET_CLASS_BY_ID, ASSET_CLASS_GROUPS, LISTING_CATEGORIES } from "@shared/marketplace/asset-class-taxonomy";

/** Bespoke-page registry — asset class key → route of the bespoke experience.
 *  When present, the landing renders an "Open detailed view" CTA. */
const BESPOKE_PAGE_ROUTES: Record<string, string> = {
  marina: "/operations/dockit",
  yacht_club: "/operations/dockit",
  dry_storage_facility: "/operations/dockit",
  hotel: "/operations/hotel",
  hotel_full_service: "/operations/hotel",
  hotel_limited_service: "/operations/hotel",
  hotel_boutique: "/operations/hotel",
  extended_stay: "/operations/hotel",
  resort: "/operations/hotel",
  waterfront_resort: "/operations/hotel",
  multifamily: "/operations/multifamily",
  apartment_garden: "/operations/multifamily",
  apartment_midrise: "/operations/multifamily",
  apartment_highrise: "/operations/multifamily",
  student_housing: "/operations/multifamily",
  senior_housing: "/operations/multifamily",
  assisted_living: "/operations/multifamily",
  manufactured_home_park: "/operations/multifamily",
  mobile_home: "/operations/multifamily",
  retail: "/operations/retail-office",
  office: "/operations/retail-office",
  medical_office: "/operations/retail-office",
  shopping_center_strip: "/operations/retail-office",
  shopping_center_neighborhood: "/operations/retail-office",
  shopping_center_power: "/operations/retail-office",
  shopping_mall: "/operations/retail-office",
  office_class_a: "/operations/retail-office",
  office_class_b: "/operations/retail-office",
  office_class_c: "/operations/retail-office",
  office_flex: "/operations/retail-office",
  coworking: "/operations/retail-office",
  self_storage: "/operations/self-storage",
  self_storage_facility: "/operations/self-storage",
};

/** Icon lookup by marketplace group. */
const GROUP_ICON: Record<string, any> = {
  marina_waterfront: Anchor,
  hospitality: Home,
  multifamily: Home,
  office: Building2,
  retail: Store,
  industrial: Warehouse,
  self_storage: Warehouse,
  land: Layers,
  specialty_cre: Building2,
  food_beverage: Utensils,
  retail_business: Store,
  services: Wrench,
  tech_saas: Sparkles,
  ecommerce: ShoppingCart,
  manufacturing: Factory,
  distribution_logistics: Warehouse,
  healthcare_business: Briefcase,
  automotive_business: Car,
  education: Users,
  entertainment_recreation: Sparkles,
  construction_trades: Wrench,
  professional_services: Briefcase,
  personal_care: Users,
  franchise: Store,
  note_sale: FileText,
};

const MODULE_ICON: Record<OpsModuleKey, any> = {
  fuel: Fuel,
  ship_store: ShoppingCart,
  dockage: Anchor,
  service: Wrench,
  boat_rentals: Ship,
  boat_club: Users,
  boat_sales: DollarSign,
  rent_roll: Home,
  commercial_tenants: Building2,
  bookkeeping: BookOpen,
  payroll: CreditCard,
  budgeting: BarChart3,
  marketing: Megaphone,
  hotel_ops: Home,
  multifamily_ops: Home,
  retail_office_ops: Store,
  self_storage_ops: Warehouse,
};

const MODULE_DESCRIPTION: Record<OpsModuleKey, string> = {
  fuel: "Fuel pumps, inventory, margins, reconciliation",
  ship_store: "POS, inventory, sales reports, analytics",
  dockage: "Slips, reservations, seasonal assignments",
  service: "Work orders, parts, technician scheduling",
  boat_rentals: "Rental fleet, bookings, utilization",
  boat_club: "Members, reservations, fleet usage",
  boat_sales: "Listings, deals, broker commission tracking",
  rent_roll: "Leases, renewals, occupancy, collections",
  commercial_tenants: "Commercial leases, CAM, recoveries",
  bookkeeping: "GL, chart of accounts, journal entries, reconciliation",
  payroll: "Employees, pay runs, benefits, tax filings",
  budgeting: "Operating budgets, variance, forecasts",
  marketing: "Campaigns, landing pages, lead capture",
  hotel_ops: "Room types, ADR/RevPAR, revenue management",
  multifamily_ops: "Units, lease expiry, turn tracking",
  retail_office_ops: "Tenant improvement, CAM, lease admin",
  self_storage_ops: "Unit mix, rate management, occupancy",
};

function formatCategoryBadge(category?: string) {
  if (!category) return "Asset Class";
  return LISTING_CATEGORIES[category as keyof typeof LISTING_CATEGORIES] || category;
}

export default function AssetClassOpsLanding() {
  const [, params] = useRoute<{ assetClassKey: string }>("/operations/asset/:assetClassKey");
  const assetClassKey = params?.assetClassKey ?? "";
  const { assets, isLoading: assetsLoading } = useEnabledOpsModules();

  const taxonomyEntry = ASSET_CLASS_BY_ID[assetClassKey];
  const catalogEntry = hasAssetClassCatalog(assetClassKey) ? getAssetClassCatalog(assetClassKey) : null;
  const opsModules = useMemo(() => getOpsModulesForAssetClass(assetClassKey), [assetClassKey]);
  const bespokeRoute = BESPOKE_PAGE_ROUTES[assetClassKey];

  const label = taxonomyEntry?.label || catalogEntry?.label || assetClassKey;
  const category = catalogEntry?.category || taxonomyEntry?.category;
  const group = catalogEntry?.group || taxonomyEntry?.group;
  const groupLabel = group ? ASSET_CLASS_GROUPS[group as keyof typeof ASSET_CLASS_GROUPS] : undefined;
  const HeaderIcon = (group && GROUP_ICON[group]) || Building2;

  const ownedOfThisClass = useMemo(
    () => assets.filter((a) => a.assetType === assetClassKey),
    [assets, assetClassKey],
  );
  const ownedCount = ownedOfThisClass.length;
  const isOperatingBusiness = category === "operating_business" || category === "franchise";

  if (!taxonomyEntry && !catalogEntry) {
    return (
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="container mx-auto py-10 px-4">
          <Card>
            <CardContent className="py-16 text-center">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-700 mb-1">Unknown Asset Class</h3>
              <p className="text-sm text-gray-500 mb-4">
                We couldn't find metadata for <code className="px-1.5 py-0.5 rounded bg-gray-100">{assetClassKey}</code>.
              </p>
              <Link href="/operations">
                <Button variant="outline">Back to Operations</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="container mx-auto py-6 px-4 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-50 rounded-xl">
              <HeaderIcon className="h-7 w-7 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{label} Operations</h1>
                {category && (
                  <Badge variant="secondary" className="text-xs">
                    {formatCategoryBadge(category)}
                  </Badge>
                )}
                {groupLabel && (
                  <Badge variant="outline" className="text-xs">
                    {groupLabel}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {isOperatingBusiness
                  ? `Ops workspace for ${label.toLowerCase()} — financials, people, and marketing.`
                  : `Ops workspace for ${label.toLowerCase()} assets — leasing, financials, and property management.`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {bespokeRoute && (
              <Link href={bespokeRoute}>
                <Button className="gap-2">
                  Open detailed view
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </Link>
            )}
            <Link href="/operations">
              <Button variant="outline" size="sm">All Operations</Button>
            </Link>
          </div>
        </div>

        {/* Summary KPIs — branch on category */}
        {assetsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : isOperatingBusiness ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard icon={Briefcase} label="Businesses" value={ownedCount} iconColor="text-blue-600" bg="bg-blue-50" />
            <KpiCard icon={DollarSign} label="Revenue MTD" value="—" iconColor="text-green-600" bg="bg-green-50" />
            <KpiCard icon={TrendingUp} label="EBITDA MTD" value="—" iconColor="text-purple-600" bg="bg-purple-50" />
            <KpiCard icon={Users} label="Headcount" value="—" iconColor="text-orange-600" bg="bg-orange-50" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard icon={Building2} label="Properties" value={ownedCount} iconColor="text-blue-600" bg="bg-blue-50" />
            <KpiCard icon={DollarSign} label="Revenue MTD" value="—" iconColor="text-green-600" bg="bg-green-50" />
            <KpiCard icon={TrendingUp} label="NOI MTD" value="—" iconColor="text-purple-600" bg="bg-purple-50" />
            <KpiCard icon={Percent} label="Occupancy" value="—" iconColor="text-orange-600" bg="bg-orange-50" />
          </div>
        )}

        {/* Zero-state CTA */}
        {ownedCount === 0 && !assetsLoading && (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <Plus className="h-8 w-8 mx-auto mb-3 text-gray-400" />
              <h3 className="text-base font-semibold text-gray-800 mb-1">
                No {label.toLowerCase()} {isOperatingBusiness ? "businesses" : "properties"} yet
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Add one to unlock the KPIs and module data for this asset class.
              </p>
              <Link href="/crm/properties">
                <Button variant="outline" size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add {isOperatingBusiness ? "business" : "property"}
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Ops Modules */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">
            Available Modules
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {opsModules.map((moduleKey) => {
              const def = OPS_MODULE_DEFINITIONS[moduleKey];
              const Icon = MODULE_ICON[moduleKey] || Briefcase;
              return (
                <Link key={moduleKey} href={def.route}>
                  <Card className="hover:shadow-md hover:border-blue-200 transition-all cursor-pointer h-full group">
                    <CardContent className="pt-5 pb-4 px-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-blue-50 transition-colors">
                          <Icon className="h-5 w-5 text-gray-600 group-hover:text-blue-600 transition-colors" />
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900">{def.label}</h3>
                      <p className="text-xs text-gray-500 mt-1">{MODULE_DESCRIPTION[moduleKey]}</p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Profit Centers */}
        {catalogEntry && catalogEntry.profitCenters.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider text-gray-700">
                {isOperatingBusiness ? "Revenue Streams" : "Profit Centers"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {catalogEntry.profitCenters.map((pc) => (
                  <div key={pc.id} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">{pc.name}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">{pc.category}</Badge>
                    </div>
                    <p className="text-xs text-gray-500">{pc.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Amenities (CRE only) */}
        {catalogEntry && catalogEntry.amenities.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider text-gray-700">
                Typical Amenities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {catalogEntry.amenities.map((a) => (
                  <Badge key={a.id} variant="secondary" className="text-xs">{a.name}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon, label, value, iconColor, bg,
}: { icon: any; label: string; value: number | string; iconColor: string; bg: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          </div>
          <div className={`p-2.5 ${bg} rounded-lg`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

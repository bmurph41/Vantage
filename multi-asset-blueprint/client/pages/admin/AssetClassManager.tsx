/**
 * Admin Asset Class Manager Page
 *
 * Enable/disable asset classes available on the platform.
 * Configure per-class settings like default data sources, modules, and templates.
 *
 * Add to: client/src/pages/admin/AssetClassManager.tsx
 * Register in App.tsx: <Route path="/admin/asset-classes" component={AssetClassManager} />
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Layers,
  Home,
  Building,
  Building2,
  Palmtree,
  Anchor,
  Truck,
  Warehouse,
  Hotel,
  Store,
  Factory,
  LandPlot,
  Loader2,
  Seed,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface AssetClass {
  id: string;
  key: string;
  label: string;
  shortLabel: string;
  category: string;
  description: string | null;
  icon: string;
  enabled: boolean;
  sortOrder: number;
  config: Record<string, any>;
  enabledModules: string[];
  defaultDataSources: string[];
  coaTaxonomyPackKey: string | null;
  ddTemplateKey: string | null;
}

const ICON_MAP: Record<string, any> = {
  Home, Building, Building2, Palmtree, Anchor, Truck, Warehouse, Hotel, Store, Factory, LandPlot,
};

const CATEGORY_COLORS: Record<string, string> = {
  residential: "bg-blue-100 text-blue-800",
  commercial: "bg-purple-100 text-purple-800",
  hospitality: "bg-amber-100 text-amber-800",
  specialty: "bg-teal-100 text-teal-800",
  land: "bg-green-100 text-green-800",
};

const MODULE_LABELS: Record<string, string> = {
  crm: "CRM",
  salesComps: "Sales Comps",
  modeling: "Modeling",
  proForma: "Pro Forma",
  rentRoll: "Rent Roll",
  fuelSales: "Fuel Sales",
  shipStore: "Ship Store",
  vdr: "Data Room",
  dueDiligence: "Due Diligence",
  docket: "Docket",
};

export default function AssetClassManager() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ assetClasses: AssetClass[] }>({
    queryKey: ["/api/admin/asset-classes"],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) =>
      apiRequest("PATCH", `/api/admin/asset-classes/${key}`, { enabled }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/asset-classes"] });
    },
  });

  const seedMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/admin/asset-classes/seed"),
    onSuccess: () => {
      toast({ title: "Asset classes seeded successfully" });
      qc.invalidateQueries({ queryKey: ["/api/admin/asset-classes"] });
    },
    onError: () => toast({ title: "Failed to seed asset classes", variant: "destructive" }),
  });

  const assetClasses = data?.assetClasses || [];

  const categories = ["residential", "commercial", "hospitality", "specialty", "land"];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="h-6 w-6" />
            Asset Classes
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure which property types are available to users on the platform.
          </p>
        </div>
        <Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
          {seedMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Seed className="h-4 w-4 mr-2" />
          )}
          Seed Defaults
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Classes</p>
                <p className="text-2xl font-bold">{assetClasses.length}</p>
              </div>
              <Layers className="h-8 w-8 text-gray-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Enabled</p>
                <p className="text-2xl font-bold text-green-600">{assetClasses.filter((a) => a.enabled).length}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Disabled</p>
                <p className="text-2xl font-bold text-gray-400">{assetClasses.filter((a) => !a.enabled).length}</p>
              </div>
              <XCircle className="h-8 w-8 text-gray-300 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 justify-center py-12 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading asset classes...
        </div>
      ) : assetClasses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              No asset classes configured. Click "Seed Defaults" to populate the standard set.
            </p>
            <Button onClick={() => seedMutation.mutate()}>
              <Seed className="h-4 w-4 mr-2" />
              Seed Default Asset Classes
            </Button>
          </CardContent>
        </Card>
      ) : (
        categories.map((category) => {
          const classesInCategory = assetClasses.filter((a) => a.category === category);
          if (classesInCategory.length === 0) return null;

          return (
            <div key={category}>
              <h2 className="text-lg font-semibold mb-3 capitalize">{category}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {classesInCategory.map((ac) => {
                  const IconComponent = ICON_MAP[ac.icon] || Home;
                  const catColor = CATEGORY_COLORS[ac.category] || "bg-gray-100 text-gray-800";

                  return (
                    <Card key={ac.id} className={`transition-opacity ${ac.enabled ? "" : "opacity-60"}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${ac.enabled ? "bg-primary/10" : "bg-gray-100"}`}>
                              <IconComponent className={`h-5 w-5 ${ac.enabled ? "text-primary" : "text-gray-400"}`} />
                            </div>
                            <div>
                              <CardTitle className="text-base">{ac.label}</CardTitle>
                              <Badge className={`${catColor} text-[10px] mt-1`}>
                                {ac.category}
                              </Badge>
                            </div>
                          </div>
                          <Switch
                            checked={ac.enabled}
                            onCheckedChange={(checked) =>
                              toggleMutation.mutate({ key: ac.key, enabled: checked })
                            }
                            disabled={toggleMutation.isPending}
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {ac.description && (
                          <p className="text-xs text-muted-foreground">{ac.description}</p>
                        )}

                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Modules</p>
                          <div className="flex flex-wrap gap-1">
                            {(ac.enabledModules || []).map((mod: string) => (
                              <Badge key={mod} variant="secondary" className="text-[10px]">
                                {MODULE_LABELS[mod] || mod}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {(ac.defaultDataSources || []).length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Data Sources</p>
                            <div className="flex flex-wrap gap-1">
                              {ac.defaultDataSources.map((ds: string) => (
                                <Badge key={ds} variant="outline" className="text-[10px]">
                                  {ds.replace(/_/g, " ")}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {ac.config && Object.keys(ac.config).length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Config</p>
                            <div className="text-xs bg-muted rounded p-2 font-mono">
                              {Object.entries(ac.config).map(([k, v]) => (
                                <div key={k}>
                                  {k}: {JSON.stringify(v)}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

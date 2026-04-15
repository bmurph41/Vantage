/**
 * Admin Asset Class Manager Page
 *
 * Manage platform asset classes — enable/disable, create new, edit, delete.
 * All changes are DB-driven and reflected immediately across the platform.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DialogDescription } from "@/components/ui/dialog";
import {
  Layers, Home, Building, Building2, Anchor, Truck, Warehouse, Hotel, Store,
  Factory, LandPlot, Loader2, Sprout, Plus, Trash2, CheckCircle2, XCircle,
} from "lucide-react";

interface AssetClass {
  id: string;
  key: string;
  label: string;
  shortLabel: string | null;
  category: string;
  description: string | null;
  icon: string | null;
  enabled: boolean;
  sortOrder: number;
  config: Record<string, any>;
  enabledModules: string[];
  defaultDataSources: string[];
  coaTaxonomyPackKey: string | null;
  ddTemplateKey: string | null;
  sizeLabel: string | null;
  occLabel: string | null;
  priceUnit: string | null;
  revenueStreams: string[];
  demandKey: string | null;
  group: string | null;
  color: string | null;
}

const ICON_MAP: Record<string, any> = {
  Home, Building, Building2, Anchor, Truck, Warehouse, Hotel, Store, Factory, LandPlot,
};

const CATEGORY_COLORS: Record<string, string> = {
  residential: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  commercial: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  hospitality: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  specialty: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  land: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

const createSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers, underscores only"),
  label: z.string().min(1).max(100),
  shortLabel: z.string().max(30).optional(),
  category: z.string().min(1),
  description: z.string().optional(),
  group: z.string().optional(),
  color: z.string().optional(),
  sizeLabel: z.string().optional(),
  occLabel: z.string().optional(),
  priceUnit: z.string().optional(),
  demandKey: z.string().optional(),
  revenueStreams: z.string().optional(),
  enabled: z.boolean().optional().default(false),
});

type CreateFormValues = z.infer<typeof createSchema>;

export default function AssetClassManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AssetClass | null>(null);

  const { data, isLoading } = useQuery<{ assetClasses: AssetClass[] }>({
    queryKey: ["/api/admin/asset-classes"],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) =>
      apiRequest("PATCH", `/api/admin/asset-classes/${key}`, { enabled }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/asset-classes"] });
      qc.invalidateQueries({ queryKey: ["/api/asset-classes"] });
    },
    onError: () => toast({ title: "Failed to update asset class", variant: "destructive" }),
  });

  const seedMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/admin/asset-classes/seed"),
    onSuccess: (res: { message?: string } | undefined) => {
      toast({ title: res?.message || "Asset classes seeded successfully" });
      qc.invalidateQueries({ queryKey: ["/api/admin/asset-classes"] });
      qc.invalidateQueries({ queryKey: ["/api/asset-classes"] });
    },
    onError: () => toast({ title: "Failed to seed asset classes", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (key: string) => apiRequest("DELETE", `/api/admin/asset-classes/${key}`),
    onSuccess: () => {
      toast({ title: "Asset class deleted" });
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["/api/admin/asset-classes"] });
      qc.invalidateQueries({ queryKey: ["/api/asset-classes"] });
    },
    onError: () => toast({ title: "Failed to delete asset class", variant: "destructive" }),
  });

  const assetClasses = data?.assetClasses || [];
  const groups = [...new Set(assetClasses.map((a) => a.group || a.category))];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="h-6 w-6" />
            Asset Classes
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage platform asset class types — all dropdowns and forms pull from this list.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
            {seedMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sprout className="h-4 w-4 mr-2" />}
            Seed All 36 Types
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Asset Class
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Classes</p>
                <p className="text-2xl font-bold">{assetClasses.length}</p>
              </div>
              <Layers className="h-8 w-8 text-muted-foreground opacity-40" />
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
              <CheckCircle2 className="h-8 w-8 text-green-400 opacity-40" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Disabled</p>
                <p className="text-2xl font-bold text-muted-foreground">{assetClasses.filter((a) => !a.enabled).length}</p>
              </div>
              <XCircle className="h-8 w-8 text-muted-foreground opacity-40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading asset classes...
        </div>
      ) : assetClasses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              No asset classes configured. Click "Seed All 36 Types" to populate the canonical set.
            </p>
            <Button onClick={() => seedMutation.mutate()}>
              <Sprout className="h-4 w-4 mr-2" />
              Seed All 36 Types
            </Button>
          </CardContent>
        </Card>
      ) : (
        groups.map((group) => {
          const inGroup = assetClasses.filter((a) => (a.group || a.category) === group);
          if (inGroup.length === 0) return null;
          return (
            <div key={group}>
              <h2 className="text-base font-semibold mb-2 text-muted-foreground uppercase tracking-wide text-xs">
                {group}
              </h2>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">On</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Size / Occ / Price</TableHead>
                      <TableHead>Revenue Streams</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inGroup.map((ac) => {
                      const IconComponent = ICON_MAP[ac.icon || ""] || Home;
                      const catColor = CATEGORY_COLORS[ac.category] || "bg-gray-100 text-gray-800";
                      return (
                        <TableRow key={ac.id} className={ac.enabled ? "" : "opacity-50"}>
                          <TableCell>
                            <Switch
                              checked={ac.enabled}
                              onCheckedChange={(checked) => toggleMutation.mutate({ key: ac.key, enabled: checked })}
                              disabled={toggleMutation.isPending}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-5 h-5 rounded flex items-center justify-center"
                                style={{ backgroundColor: ac.color || "#94a3b8" }}
                              >
                                <IconComponent className="h-3 w-3 text-white" />
                              </div>
                              <code className="text-xs font-mono bg-muted px-1 rounded">{ac.key}</code>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-sm">{ac.label}</div>
                            {ac.shortLabel && <div className="text-xs text-muted-foreground">{ac.shortLabel}</div>}
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-[10px] ${catColor}`}>{ac.category}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {[ac.sizeLabel, ac.occLabel, ac.priceUnit].filter(Boolean).join(" / ") || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {(ac.revenueStreams || []).join(", ") || "—"}
                          </TableCell>
                          <TableCell>
                            {ac.color ? (
                              <div className="flex items-center gap-1.5">
                                <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: ac.color }} />
                                <span className="text-xs font-mono text-muted-foreground">{ac.color}</span>
                              </div>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(ac)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            </div>
          );
        })
      )}

      <CreateAssetClassDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["/api/admin/asset-classes"] });
          qc.invalidateQueries({ queryKey: ["/api/asset-classes"] });
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete asset class?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{deleteTarget?.label}</strong> (<code>{deleteTarget?.key}</code>) from the platform. Any references to this key in existing data will not be affected but will show as unknown.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.key)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CreateAssetClassDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      key: "",
      label: "",
      shortLabel: "",
      category: "commercial",
      description: "",
      group: "",
      color: "#6366f1",
      sizeLabel: "",
      occLabel: "",
      priceUnit: "",
      demandKey: "",
      revenueStreams: "",
      enabled: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: CreateFormValues) => {
      const streams = values.revenueStreams
        ? values.revenueStreams.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      return apiRequest("POST", "/api/admin/asset-classes", {
        ...values,
        revenueStreams: streams,
      });
    },
    onSuccess: () => {
      toast({ title: "Asset class created successfully" });
      form.reset();
      onOpenChange(false);
      onSuccess();
    },
    onError: (err: Error) => {
      toast({ title: err?.message || "Failed to create asset class", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            New Asset Class
          </DialogTitle>
          <DialogDescription>
            Add a new asset class type to the platform. All dropdowns and forms will include it immediately.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="key" render={({ field }) => (
                <FormItem>
                  <FormLabel>Key <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. boat_club" className="font-mono" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="label" render={({ field }) => (
                <FormItem>
                  <FormLabel>Label <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. Boat Club" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="shortLabel" render={({ field }) => (
                <FormItem>
                  <FormLabel>Short Label</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. Boat Club" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input {...field} placeholder="residential, commercial, hospitality, specialty, land" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="group" render={({ field }) => (
                <FormItem>
                  <FormLabel>Group</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. Waterfront, Hospitality, Retail" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="color" render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <div className="flex gap-2 items-center">
                    <FormControl><Input {...field} placeholder="#6366f1" className="font-mono" /></FormControl>
                    <div className="w-8 h-8 rounded border flex-shrink-0" style={{ backgroundColor: field.value || "#6366f1" }} />
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="sizeLabel" render={({ field }) => (
                <FormItem>
                  <FormLabel>Size Label</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. Slips, Units, Sq Ft" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="occLabel" render={({ field }) => (
                <FormItem>
                  <FormLabel>Occupancy Label</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. Occ %, Slip Occ %" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="priceUnit" render={({ field }) => (
                <FormItem>
                  <FormLabel>Price Unit</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. Slip, Unit, Sq Ft" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="demandKey" render={({ field }) => (
                <FormItem>
                  <FormLabel>Demand Key</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. Boat Ownership %" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="revenueStreams" render={({ field }) => (
              <FormItem>
                <FormLabel>Revenue Streams</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Comma-separated, e.g. Fuel Revenue, Storage Revenue, Service Revenue" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl><Textarea {...field} placeholder="Brief description of this asset class type" rows={2} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="enabled" render={({ field }) => (
              <FormItem className="flex items-center gap-2">
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="!mt-0">Enable immediately</FormLabel>
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Asset Class
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

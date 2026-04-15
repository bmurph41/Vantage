import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";
import BrokerDashboardLayout from "./BrokerDashboardLayout";
import {
  useAdvisoryPackages,
  useCreateAdvisoryPackage,
  useUpdateAdvisoryPackage,
  useDeleteAdvisoryPackage,
  type AdvisoryPackage,
} from "@/hooks/use-broker-dashboard";

interface Deliverable {
  title: string;
  description: string;
  frequency: string;
}

interface PackageForm {
  name: string;
  tagline: string;
  description: string;
  deliverables: Deliverable[];
  priceMonthlyCents: string;
  priceAnnualCents: string;
  cadence: string;
  externalPaymentUrl: string;
  maxSubscribers: string;
}

const EMPTY_FORM: PackageForm = {
  name: "",
  tagline: "",
  description: "",
  deliverables: [],
  priceMonthlyCents: "",
  priceAnnualCents: "",
  cadence: "monthly",
  externalPaymentUrl: "",
  maxSubscribers: "",
};

export default function BrokerAdvisoryPackages() {
  const { toast } = useToast();
  const { data, isLoading } = useAdvisoryPackages();
  const createMut = useCreateAdvisoryPackage();
  const updateMut = useUpdateAdvisoryPackage();
  const deleteMut = useDeleteAdvisoryPackage();

  const [editing, setEditing] = useState<AdvisoryPackage | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<PackageForm>(EMPTY_FORM);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (pkg: AdvisoryPackage) => {
    setEditing(pkg);
    setForm({
      name: pkg.name || "",
      tagline: pkg.tagline || "",
      description: pkg.description || "",
      deliverables: Array.isArray(pkg.deliverables) ? (pkg.deliverables as Deliverable[]) : [],
      priceMonthlyCents: pkg.priceMonthlyCents != null ? String(pkg.priceMonthlyCents) : "",
      priceAnnualCents: pkg.priceAnnualCents != null ? String(pkg.priceAnnualCents) : "",
      cadence: pkg.cadence || "monthly",
      externalPaymentUrl: pkg.externalPaymentUrl || "",
      maxSubscribers: pkg.maxSubscribers != null ? String(pkg.maxSubscribers) : "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload: Partial<AdvisoryPackage> = {
      name: form.name.trim(),
      tagline: form.tagline || null,
      description: form.description || null,
      deliverables: form.deliverables,
      priceMonthlyCents: form.priceMonthlyCents ? Number(form.priceMonthlyCents) : null,
      priceAnnualCents: form.priceAnnualCents ? Number(form.priceAnnualCents) : null,
      cadence: form.cadence,
      externalPaymentUrl: form.externalPaymentUrl || null,
      maxSubscribers: form.maxSubscribers ? Number(form.maxSubscribers) : null,
    };
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, data: payload });
        toast({ title: "Package updated" });
      } else {
        await createMut.mutateAsync(payload);
        toast({ title: "Package created" });
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Archive this package? Subscribers keep access until canceled.")) return;
    try {
      await deleteMut.mutateAsync(id);
      toast({ title: "Package archived" });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message || "", variant: "destructive" });
    }
  };

  const addDeliverable = () =>
    setForm((f) => ({
      ...f,
      deliverables: [...f.deliverables, { title: "", description: "", frequency: "" }],
    }));

  const updateDeliverable = (idx: number, field: keyof Deliverable, value: string) =>
    setForm((f) => ({
      ...f,
      deliverables: f.deliverables.map((d, i) => (i === idx ? { ...d, [field]: value } : d)),
    }));

  const removeDeliverable = (idx: number) =>
    setForm((f) => ({ ...f, deliverables: f.deliverables.filter((_, i) => i !== idx) }));

  const limits = data?.limits;
  const limitText =
    limits?.maxAdvisoryPackages === -1
      ? `${limits.current} packages (unlimited)`
      : limits
      ? `${limits.current}/${limits.maxAdvisoryPackages} packages used — Broker ${limits.tier || ""}`
      : "";

  return (
    <BrokerDashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Advisory Packages</h1>
            <p className="text-sm text-muted-foreground">{limitText}</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            New Package
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data?.packages.map((p) => (
              <Card key={p.id}>
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    {p.tagline && (
                      <div className="text-xs text-muted-foreground mt-1">{p.tagline}</div>
                    )}
                  </div>
                  {!p.isActive && <Badge variant="outline">Archived</Badge>}
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="font-mono">
                    {p.priceMonthlyCents != null
                      ? `$${(p.priceMonthlyCents / 100).toFixed(0)}/mo`
                      : "—"}
                    {p.priceAnnualCents != null &&
                      ` · $${(p.priceAnnualCents / 100).toFixed(0)}/yr`}
                  </div>
                  {p.description && (
                    <p className="text-muted-foreground line-clamp-3">{p.description}</p>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                      Edit
                    </Button>
                    {p.isActive && (
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}>
                        Archive
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Package" : "New Package"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Tagline</Label>
              <Input
                value={form.tagline}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label>Deliverables</Label>
                <Button size="sm" variant="outline" onClick={addDeliverable} type="button">
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-2 mt-2">
                {form.deliverables.map((d, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <Input
                      placeholder="Title"
                      value={d.title}
                      onChange={(e) => updateDeliverable(i, "title", e.target.value)}
                    />
                    <Input
                      placeholder="Description"
                      value={d.description}
                      onChange={(e) => updateDeliverable(i, "description", e.target.value)}
                    />
                    <Input
                      placeholder="Frequency"
                      value={d.frequency}
                      onChange={(e) => updateDeliverable(i, "frequency", e.target.value)}
                    />
                    <Button size="sm" variant="ghost" onClick={() => removeDeliverable(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Price Monthly (cents)</Label>
                <Input
                  type="number"
                  value={form.priceMonthlyCents}
                  onChange={(e) => setForm({ ...form, priceMonthlyCents: e.target.value })}
                />
              </div>
              <div>
                <Label>Price Annual (cents)</Label>
                <Input
                  type="number"
                  value={form.priceAnnualCents}
                  onChange={(e) => setForm({ ...form, priceAnnualCents: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Cadence</Label>
              <Select
                value={form.cadence}
                onValueChange={(v) => setForm({ ...form, cadence: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>External Payment URL</Label>
              <Input
                value={form.externalPaymentUrl}
                onChange={(e) => setForm({ ...form, externalPaymentUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>Max Subscribers (optional)</Label>
              <Input
                type="number"
                value={form.maxSubscribers}
                onChange={(e) => setForm({ ...form, maxSubscribers: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </BrokerDashboardLayout>
  );
}

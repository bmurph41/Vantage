/** DealProductsPanel — Products linked to a deal with revenue summary. */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Package, Plus, Trash2, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────

interface DealProductsPanelProps {
  dealId: string;
}

interface DealProduct {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  isRecurring: boolean;
  billingCycle?: string;
}

interface ProductsResponse {
  products: DealProduct[];
  totalRevenue: number;
  recurringRevenue: number;
  oneTimeRevenue: number;
}

interface CatalogProduct {
  id: string;
  name: string;
  defaultPrice: number;
}

// ─── Helpers ──────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

// ─── Component ────────────────────────────────────────────────────

export function DealProductsPanel({ dealId }: DealProductsPanelProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    productId: "",
    quantity: 1,
    priceOverride: "",
    discount: 0,
    isRecurring: false,
    billingCycle: "monthly",
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const qk = ["crm", "deals", dealId, "products"];

  const { data, isLoading } = useQuery<ProductsResponse>({
    queryKey: qk,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/crm/deals/${dealId}/products`);
      return res.json();
    },
  });

  const { data: catalog } = useQuery<CatalogProduct[]>({
    queryKey: ["products", "catalog"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/products");
      return res.json();
    },
    enabled: showAdd,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/crm/deals/${dealId}/products`, {
        productId: form.productId,
        quantity: form.quantity,
        priceOverride: form.priceOverride ? parseFloat(form.priceOverride) : undefined,
        discount: form.discount,
        isRecurring: form.isRecurring,
        billingCycle: form.isRecurring ? form.billingCycle : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      setShowAdd(false);
      resetForm();
      toast({ title: "Product added to deal" });
    },
    onError: () => toast({ title: "Failed to add product", variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (productId: string) => {
      await apiRequest("DELETE", `/api/crm/deals/${dealId}/products/${productId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      toast({ title: "Product removed" });
    },
    onError: () => toast({ title: "Failed to remove product", variant: "destructive" }),
  });

  function resetForm() {
    setForm({ productId: "", quantity: 1, priceOverride: "", discount: 0, isRecurring: false, billingCycle: "monthly" });
  }

  const products = data?.products ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Package className="h-4 w-4" /> Products
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && products.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No products linked</p>
        )}

        {products.map((p) => (
          <div key={p.id} className="flex items-center gap-3 py-2 px-3 rounded-md border text-sm">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {p.quantity} x {fmt(p.unitPrice)}
                {p.discount > 0 && ` (-${p.discount}%)`}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-mono text-sm font-medium">{fmt(p.total)}</p>
              {p.isRecurring && (
                <Badge variant="secondary" className="text-[10px]">{p.billingCycle ?? "recurring"}</Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              disabled={removeMutation.isPending}
              onClick={() => removeMutation.mutate(p.id)}
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        ))}

        {products.length > 0 && (
          <div className="pt-3 border-t space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Revenue</span>
              <span className="font-mono font-semibold">{fmt(data?.totalRevenue ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Recurring</span>
              <span className="font-mono">{fmt(data?.recurringRevenue ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">One-Time</span>
              <span className="font-mono">{fmt(data?.oneTimeRevenue ?? 0)}</span>
            </div>
          </div>
        )}
      </CardContent>

      {/* Add Product Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Product to Deal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Product</Label>
              <Select value={form.productId} onValueChange={(v) => setForm({ ...form, productId: v })}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {(catalog ?? []).map((cp) => (
                    <SelectItem key={cp.id} value={cp.id}>
                      {cp.name} — {fmt(cp.defaultPrice)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="space-y-2">
                <Label>Price Override</Label>
                <Input type="number" min={0} step={0.01} placeholder="Default" value={form.priceOverride} onChange={(e) => setForm({ ...form, priceOverride: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Discount %</Label>
                <Input type="number" min={0} max={100} value={form.discount} onChange={(e) => setForm({ ...form, discount: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.isRecurring} onCheckedChange={(v) => setForm({ ...form, isRecurring: v })} />
              <Label>Recurring</Label>
              {form.isRecurring && (
                <Select value={form.billingCycle} onValueChange={(v) => setForm({ ...form, billingCycle: v })}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button disabled={!form.productId || addMutation.isPending} onClick={() => addMutation.mutate()}>
              {addMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Add Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

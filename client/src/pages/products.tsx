import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { CrmProduct } from "@shared/schema";

export default function ProductsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CrmProduct | null>(null);
  const { toast } = useToast();

  const { data: products = [], isLoading } = useQuery<CrmProduct[]>({
    queryKey: ['/api/products'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      code?: string;
      description?: string;
      price: string;
      cost?: string;
      unit?: string;
      category?: string;
      isActive: boolean;
    }) => {
      return await apiRequest('POST', '/api/products', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      setIsCreateOpen(false);
      toast({ title: "Product created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create product", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CrmProduct> }) => {
      return await apiRequest('PUT', `/api/products/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      setEditingProduct(null);
      toast({ title: "Product updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update product", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({ title: "Product deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete product", description: error.message, variant: "destructive" });
    },
  });

  const activeProducts = products.filter(p => p.isActive);
  const inactiveProducts = products.filter(p => !p.isActive);

  return (
    <div className="h-full overflow-auto bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="h-8 w-8" />
              Products
            </h1>
            <p className="text-gray-600 mt-1">
              Manage your products and services for revenue tracking
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-product">
                <Plus className="h-4 w-4 mr-2" />
                Create Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <CreateProductForm
                onSubmit={(data) => createMutation.mutate(data)}
                onCancel={() => setIsCreateOpen(false)}
                isPending={createMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-12">Loading...</div>
        ) : products.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              No products found. Create your first product to get started.
            </CardContent>
          </Card>
        ) : (
          <>
            {activeProducts.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Active Products</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onEdit={setEditingProduct}
                      onDelete={(id) => {
                        if (confirm("Are you sure you want to delete this product?")) {
                          deleteMutation.mutate(id);
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {inactiveProducts.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Inactive Products</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inactiveProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onEdit={setEditingProduct}
                      onDelete={(id) => {
                        if (confirm("Are you sure you want to delete this product?")) {
                          deleteMutation.mutate(id);
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {editingProduct && (
          <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
            <DialogContent className="max-w-2xl">
              <EditProductForm
                product={editingProduct}
                onSubmit={(data) => updateMutation.mutate({ id: editingProduct.id, data })}
                onCancel={() => setEditingProduct(null)}
                isPending={updateMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}

function ProductCard({
  product,
  onEdit,
  onDelete,
}: {
  product: CrmProduct;
  onEdit: (product: CrmProduct) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card data-testid={`card-product-${product.id}`} className={!product.isActive ? 'opacity-60' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {product.name}
              {!product.isActive && <Badge variant="secondary">Inactive</Badge>}
            </CardTitle>
            {product.code && (
              <p className="text-sm text-gray-600 mt-1">Code: {product.code}</p>
            )}
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(product)}
              data-testid={`button-edit-${product.id}`}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(product.id)}
              data-testid={`button-delete-${product.id}`}
            >
              <Trash2 className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {product.description && (
            <p className="text-sm text-gray-600">{product.description}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <p className="text-xs text-gray-500">Price</p>
              <p className="font-semibold text-green-600" data-testid={`text-price-${product.id}`}>
                ${parseFloat(product.price).toFixed(2)} / {product.unit || 'unit'}
              </p>
            </div>
            {product.cost && (
              <div>
                <p className="text-xs text-gray-500">Cost</p>
                <p className="font-semibold text-gray-700">
                  ${parseFloat(product.cost).toFixed(2)}
                </p>
              </div>
            )}
          </div>
          {product.category && (
            <Badge variant="outline" className="mt-2">{product.category}</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CreateProductForm({
  onSubmit,
  onCancel,
  isPending,
}: {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    price: "",
    cost: "",
    unit: "unit",
    category: "",
    isActive: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Create New Product</DialogTitle>
        <DialogDescription>
          Add a new product or service for revenue tracking
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Product Name *</Label>
            <Input
              id="name"
              data-testid="input-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Marina Slip Rental"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="code">Product Code</Label>
            <Input
              id="code"
              data-testid="input-code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="e.g., MSR-001"
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            data-testid="input-description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Product description"
            rows={3}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="price">Price *</Label>
            <CurrencyInput
              id="price"
              data-testid="input-price"
              value={formData.price ? parseFloat(formData.price) : undefined}
              onValueChange={(val) => setFormData({ ...formData, price: val?.toString() || "" })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cost">Cost</Label>
            <CurrencyInput
              id="cost"
              data-testid="input-cost"
              value={formData.cost ? parseFloat(formData.cost) : undefined}
              onValueChange={(val) => setFormData({ ...formData, cost: val?.toString() || "" })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="unit">Unit</Label>
            <Select
              value={formData.unit}
              onValueChange={(value) => setFormData({ ...formData, unit: value })}
            >
              <SelectTrigger data-testid="select-unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unit" data-testid="option-unit-unit">Unit</SelectItem>
                <SelectItem value="hour" data-testid="option-unit-hour">Hour</SelectItem>
                <SelectItem value="day" data-testid="option-unit-day">Day</SelectItem>
                <SelectItem value="month" data-testid="option-unit-month">Month</SelectItem>
                <SelectItem value="year" data-testid="option-unit-year">Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="category">Category</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData({ ...formData, category: value })}
          >
            <SelectTrigger data-testid="select-category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Service" data-testid="option-category-service">Service</SelectItem>
              <SelectItem value="Product" data-testid="option-category-product">Product</SelectItem>
              <SelectItem value="License" data-testid="option-category-license">License</SelectItem>
              <SelectItem value="Subscription" data-testid="option-category-subscription">Subscription</SelectItem>
              <SelectItem value="Rental" data-testid="option-category-rental">Rental</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            id="isActive"
            checked={formData.isActive}
            onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
            data-testid="switch-active"
          />
          <Label htmlFor="isActive">Active</Label>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
          Cancel
        </Button>
        <Button type="submit" disabled={isPending} data-testid="button-submit">
          {isPending ? "Creating..." : "Create Product"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function EditProductForm({
  product,
  onSubmit,
  onCancel,
  isPending,
}: {
  product: CrmProduct;
  onSubmit: (data: Partial<CrmProduct>) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    name: product.name,
    code: product.code || "",
    description: product.description || "",
    price: product.price,
    cost: product.cost || "",
    unit: product.unit || "unit",
    category: product.category || "",
    isActive: product.isActive ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Edit Product</DialogTitle>
        <DialogDescription>
          Update the product details
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-name">Product Name *</Label>
            <Input
              id="edit-name"
              data-testid="input-edit-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-code">Product Code</Label>
            <Input
              id="edit-code"
              data-testid="input-edit-code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-description">Description</Label>
          <Textarea
            id="edit-description"
            data-testid="input-edit-description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-price">Price *</Label>
            <CurrencyInput
              id="edit-price"
              data-testid="input-edit-price"
              value={formData.price ? parseFloat(formData.price) : undefined}
              onValueChange={(val) => setFormData({ ...formData, price: val?.toString() || "" })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-cost">Cost</Label>
            <CurrencyInput
              id="edit-cost"
              data-testid="input-edit-cost"
              value={formData.cost ? parseFloat(formData.cost) : undefined}
              onValueChange={(val) => setFormData({ ...formData, cost: val?.toString() || "" })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-unit">Unit</Label>
            <Select
              value={formData.unit}
              onValueChange={(value) => setFormData({ ...formData, unit: value })}
            >
              <SelectTrigger data-testid="select-edit-unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unit" data-testid="option-unit-unit">Unit</SelectItem>
                <SelectItem value="hour" data-testid="option-unit-hour">Hour</SelectItem>
                <SelectItem value="day" data-testid="option-unit-day">Day</SelectItem>
                <SelectItem value="month" data-testid="option-unit-month">Month</SelectItem>
                <SelectItem value="year" data-testid="option-unit-year">Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-category">Category</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData({ ...formData, category: value })}
          >
            <SelectTrigger data-testid="select-edit-category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Service" data-testid="option-category-service">Service</SelectItem>
              <SelectItem value="Product" data-testid="option-category-product">Product</SelectItem>
              <SelectItem value="License" data-testid="option-category-license">License</SelectItem>
              <SelectItem value="Subscription" data-testid="option-category-subscription">Subscription</SelectItem>
              <SelectItem value="Rental" data-testid="option-category-rental">Rental</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            id="edit-isActive"
            checked={formData.isActive}
            onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
            data-testid="switch-edit-active"
          />
          <Label htmlFor="edit-isActive">Active</Label>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-edit-cancel">
          Cancel
        </Button>
        <Button type="submit" disabled={isPending} data-testid="button-edit-submit">
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, ChevronRight, ChevronDown, FolderTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PnlCategory } from "@shared/schema";

type CategoryType = "revenue" | "cogs" | "opex" | "payroll" | "other_expense" | "other_income";

interface CategoryWithChildren extends PnlCategory {
  children: PnlCategory[];
}

const CATEGORY_TYPE_LABELS: Record<CategoryType, { label: string; color: string }> = {
  revenue: { label: "Revenue", color: "bg-green-100 text-green-800" },
  cogs: { label: "COGS", color: "bg-orange-100 text-orange-800" },
  opex: { label: "OpEx", color: "bg-blue-100 text-blue-800" },
  payroll: { label: "Payroll", color: "bg-purple-100 text-purple-800" },
  other_income: { label: "Other Income", color: "bg-teal-100 text-teal-800" },
  other_expense: { label: "Other Expense", color: "bg-red-100 text-red-800" },
};

export function CategoryManager() {
  const { toast } = useToast();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [editingCategory, setEditingCategory] = useState<PnlCategory | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    categoryType: "revenue" as CategoryType,
    parentId: "",
  });

  const { data: categories = [], isLoading } = useQuery<PnlCategory[]>({
    queryKey: ["/api/modeling/doc-intel/categories"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<PnlCategory>) => {
      return apiRequest("/api/modeling/doc-intel/categories", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modeling/doc-intel/categories"] });
      resetForm();
      toast({ title: "Category created", description: "New category has been added." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create category.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PnlCategory> }) => {
      return apiRequest(`/api/modeling/doc-intel/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modeling/doc-intel/categories"] });
      resetForm();
      toast({ title: "Category updated", description: "Category has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update category.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/modeling/doc-intel/categories/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modeling/doc-intel/categories"] });
      toast({ title: "Category deleted", description: "Category has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete category.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", description: "", categoryType: "revenue", parentId: "" });
    setEditingCategory(null);
    setIsDialogOpen(false);
  };

  const openEditDialog = (category: PnlCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || "",
      categoryType: category.categoryType as CategoryType,
      parentId: category.parentId || "",
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = (parentId?: string, categoryType?: CategoryType) => {
    setEditingCategory(null);
    setFormData({
      name: "",
      description: "",
      categoryType: categoryType || "revenue",
      parentId: parentId || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    const data = {
      name: formData.name,
      description: formData.description || null,
      categoryType: formData.categoryType,
      parentId: formData.parentId || null,
    };

    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getCategoriesHierarchy = (): CategoryWithChildren[] => {
    const parentCategories = categories.filter(c => !c.parentId);
    return parentCategories.map(parent => ({
      ...parent,
      children: categories.filter(c => c.parentId === parent.id),
    }));
  };

  const hierarchy = getCategoriesHierarchy();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>P&L Categories</CardTitle>
            <CardDescription>
              Manage your organization's P&L categories for document classification
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openCreateDialog()} data-testid="button-add-category">
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>
                <DialogDescription>
                  {editingCategory ? "Update the category details" : "Create a new P&L category"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Wet Slip Revenue"
                    data-testid="input-category-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of this category"
                    data-testid="input-category-description"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="categoryType">Category Type</Label>
                  <Select
                    value={formData.categoryType}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, categoryType: v as CategoryType }))}
                  >
                    <SelectTrigger id="categoryType" data-testid="select-category-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_TYPE_LABELS).map(([value, { label }]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parentId">Parent Category (optional)</Label>
                  <Select
                    value={formData.parentId}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, parentId: v === "none" ? "" : v }))}
                  >
                    <SelectTrigger id="parentId" data-testid="select-parent-category">
                      <SelectValue placeholder="None (top-level)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (top-level)</SelectItem>
                      {categories.filter(c => !c.parentId).map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetForm} data-testid="button-cancel-category">
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-category"
                >
                  {editingCategory ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {hierarchy.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FolderTree className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No categories configured</p>
            <p className="text-sm">Add categories or initialize default marina categories</p>
          </div>
        ) : (
          <div className="space-y-2">
            {hierarchy.map((parent) => (
              <Collapsible
                key={parent.id}
                open={expandedCategories.has(parent.id)}
                onOpenChange={() => toggleExpanded(parent.id)}
              >
                <div className="border rounded-lg">
                  <div className="flex items-center justify-between p-3 hover:bg-muted/50">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center gap-2 cursor-pointer flex-1">
                        {parent.children.length > 0 ? (
                          expandedCategories.has(parent.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )
                        ) : (
                          <div className="w-4" />
                        )}
                        <span className="font-medium">{parent.name}</span>
                        <Badge className={CATEGORY_TYPE_LABELS[parent.categoryType as CategoryType]?.color || "bg-gray-100"}>
                          {CATEGORY_TYPE_LABELS[parent.categoryType as CategoryType]?.label || parent.categoryType}
                        </Badge>
                        {parent.isDefault && (
                          <Badge variant="outline" className="text-xs">Default</Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          ({parent.children.length} subcategories)
                        </span>
                      </div>
                    </CollapsibleTrigger>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openCreateDialog(parent.id, parent.categoryType as CategoryType)}
                        data-testid={`button-add-child-${parent.id}`}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(parent)}
                        data-testid={`button-edit-${parent.id}`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      {!parent.isDefault && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate(parent.id)}
                          data-testid={`button-delete-${parent.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <CollapsibleContent>
                    <div className="border-t">
                      {parent.children.map((child) => (
                        <div
                          key={child.id}
                          className="flex items-center justify-between p-3 pl-10 hover:bg-muted/50 border-b last:border-b-0"
                        >
                          <div className="flex items-center gap-2">
                            <span>{child.name}</span>
                            {child.isDefault && (
                              <Badge variant="outline" className="text-xs">Default</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(child)}
                              data-testid={`button-edit-${child.id}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            {!child.isDefault && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => deleteMutation.mutate(child.id)}
                                data-testid={`button-delete-${child.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

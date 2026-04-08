import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Edit,
  Trash2,
  Ship,
  Box,
  FileText,
  DollarSign,
  Settings,
  Tag
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

type CustomType = {
  id: string;
  category: string;
  code: string;
  label: string;
  description?: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  metadata?: Record<string, any>;
};

const CATEGORIES = [
  { value: 'storage_type', label: 'Storage Types', icon: Box, description: 'Types of marina storage (wet slip, dry dock, etc.)' },
  { value: 'lease_type', label: 'Lease Types', icon: FileText, description: 'Types of lease agreements' },
  { value: 'charge_type', label: 'Charge Types', icon: DollarSign, description: 'Types of fees and charges' },
  { value: 'vessel_type', label: 'Vessel Types', icon: Ship, description: 'Types of boats and watercraft' },
  { value: 'contract_term', label: 'Contract Terms', icon: Tag, description: 'Standard contract term options' },
];

const typeFormSchema = z.object({
  code: z.string().min(1, "Code is required").max(20, "Code must be 20 characters or less"),
  label: z.string().min(1, "Label is required"),
  description: z.string().optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().default(0),
});

type TypeFormData = z.infer<typeof typeFormSchema>;

function TypeFormDialog({
  open,
  onOpenChange,
  category,
  editType,
  onSuccess
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: string;
  editType?: CustomType | null;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  
  const form = useForm<TypeFormData>({
    resolver: zodResolver(typeFormSchema),
    defaultValues: {
      code: editType?.code || "",
      label: editType?.label || "",
      description: editType?.description || "",
      isDefault: editType?.isDefault ?? false,
      isActive: editType?.isActive ?? true,
      sortOrder: editType?.sortOrder ?? 0,
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: TypeFormData) => {
      const payload = { ...data, category };
      if (editType) {
        const res = await apiRequest('PATCH', `/api/rent-roll/custom-types/${editType.id}`, payload);
        return res.json();
      }
      const res = await apiRequest('POST', '/api/rent-roll/custom-types', payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: editType ? "Type updated successfully" : "Type created successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/custom-types'] });
      form.reset();
      onOpenChange(false);
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: editType ? "Failed to update type" : "Failed to create type",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TypeFormData) => {
    saveMutation.mutate(data);
  };

  const categoryInfo = CATEGORIES.find(c => c.value === category);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{editType ? "Edit" : "Add"} {categoryInfo?.label.slice(0, -1) || 'Type'}</DialogTitle>
          <DialogDescription>
            {editType ? "Update the details for this type." : `Create a new ${categoryInfo?.label.toLowerCase().slice(0, -1) || 'type'}.`}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., WET_SLIP" 
                        {...field} 
                        className="font-mono uppercase"
                        data-testid="input-type-code"
                      />
                    </FormControl>
                    <FormDescription>Unique identifier (no spaces)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sortOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sort Order</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-sort-order"
                      />
                    </FormControl>
                    <FormDescription>Display order in lists</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Label *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Wet Slip" {...field} data-testid="input-type-label" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Optional description for this type..."
                      {...field}
                      data-testid="input-type-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center gap-8 pt-2">
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-is-active"
                      />
                    </FormControl>
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isDefault"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-is-default"
                      />
                    </FormControl>
                    <div className="space-y-0.5">
                      <FormLabel>Default</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} data-testid="btn-submit-type">
                {saveMutation.isPending ? "Saving..." : editType ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function TypesTable({
  types,
  category,
  loading,
  onEdit,
  onDelete
}: {
  types: CustomType[];
  category: string;
  loading: boolean;
  onEdit: (type: CustomType) => void;
  onDelete: (type: CustomType) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  const filteredTypes = types.filter(t => t.category === category);

  return (
    <div className="overflow-x-auto w-full">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">Code</TableHead>
          <TableHead>Label</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="w-[100px]">Status</TableHead>
          <TableHead className="w-[80px]">Order</TableHead>
          <TableHead className="w-[100px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredTypes.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
              No types defined yet. Click "Add Type" to create one.
            </TableCell>
          </TableRow>
        ) : (
          filteredTypes.map((type) => (
            <TableRow key={type.id} data-testid={`type-row-${type.id}`}>
              <TableCell className="font-mono text-sm">{type.code}</TableCell>
              <TableCell className="font-medium">
                {type.label}
                {type.isDefault && (
                  <Badge variant="secondary" className="ml-2">Default</Badge>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {type.description || '-'}
              </TableCell>
              <TableCell>
                <Badge variant={type.isActive ? "default" : "secondary"}>
                  {type.isActive ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell className="text-center">{type.sortOrder}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(type)}
                    data-testid={`btn-edit-${type.id}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(type)}
                    data-testid={`btn-delete-${type.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
    </div>
  );
}

export function CustomTypesManagement() {
  const [activeCategory, setActiveCategory] = useState('storage_type');
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<CustomType | null>(null);
  const { toast } = useToast();

  const { data: types = [], isLoading } = useQuery<CustomType[]>({
    queryKey: ['/api/rent-roll/custom-types'],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/rent-roll/custom-types/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Type deleted" });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/custom-types'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete type",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (type: CustomType) => {
    setEditingType(type);
    setFormDialogOpen(true);
  };

  const handleDelete = (type: CustomType) => {
    if (confirm(`Are you sure you want to delete "${type.label}"?`)) {
      deleteMutation.mutate(type.id);
    }
  };

  const handleAdd = () => {
    setEditingType(null);
    setFormDialogOpen(true);
  };

  const activeCategoryInfo = CATEGORIES.find(c => c.value === activeCategory);

  return (
    <div className="space-y-6" data-testid="custom-types-management">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Custom Types
          </h2>
          <p className="text-muted-foreground mt-1">
            Manage the predefined options used throughout the rent roll module.
          </p>
        </div>
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="grid w-full grid-cols-5">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <TabsTrigger key={cat.value} value={cat.value} className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{cat.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {CATEGORIES.map((cat) => (
          <TabsContent key={cat.value} value={cat.value} className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {(() => { const Icon = cat.icon; return <Icon className="h-5 w-5" />; })()}
                      {cat.label}
                    </CardTitle>
                    <CardDescription>{cat.description}</CardDescription>
                  </div>
                  <Button onClick={handleAdd} data-testid="btn-add-type">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Type
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <TypesTable
                  types={types}
                  category={cat.value}
                  loading={isLoading}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <TypeFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        category={activeCategory}
        editType={editingType}
        onSuccess={() => setEditingType(null)}
      />
    </div>
  );
}

export default CustomTypesManagement;

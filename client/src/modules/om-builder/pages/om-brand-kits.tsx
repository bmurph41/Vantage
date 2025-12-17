import { useState } from "react";
import { Link } from "wouter";
import { 
  Plus, 
  Palette, 
  MoreVertical, 
  Search, 
  ArrowLeft,
  Edit,
  Trash2,
  Copy,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import type { OmBrandKit } from "@shared/schema";

interface BrandTokens {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  headerFont?: string;
  bodyFont?: string;
  logoUrl?: string;
  companyName?: string;
}

export default function OMBrandKits() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingKit, setEditingKit] = useState<OmBrandKit | null>(null);
  
  const [formData, setFormData] = useState<{
    name: string;
    tokens: BrandTokens;
  }>({
    name: "",
    tokens: {
      primaryColor: "#1e40af",
      secondaryColor: "#1e3a5f",
      accentColor: "#f59e0b",
      headerFont: "Inter",
      bodyFont: "Inter",
      logoUrl: "",
      companyName: "",
    }
  });

  const { data: brandKits = [], isLoading } = useQuery<OmBrandKit[]>({
    queryKey: ['/api/om/brand-kits'],
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; userId: string; tokens: BrandTokens }) =>
      apiRequest('POST', '/api/om/brand-kits', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/om/brand-kits'] });
      setIsCreateOpen(false);
      resetForm();
      toast({ title: "Brand Kit Created", description: "Your brand kit has been saved." });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<OmBrandKit> }) =>
      apiRequest('PATCH', `/api/om/brand-kits/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/om/brand-kits'] });
      setEditingKit(null);
      resetForm();
      toast({ title: "Brand Kit Updated", description: "Changes have been saved." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/om/brand-kits/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/om/brand-kits'] });
      toast({ title: "Brand Kit Deleted", description: "Brand kit has been removed." });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      tokens: {
        primaryColor: "#1e40af",
        secondaryColor: "#1e3a5f",
        accentColor: "#f59e0b",
        headerFont: "Inter",
        bodyFont: "Inter",
        logoUrl: "",
        companyName: "",
      }
    });
  };

  const handleEdit = (kit: OmBrandKit) => {
    setEditingKit(kit);
    setFormData({
      name: kit.name,
      tokens: (kit.tokens as BrandTokens) || {},
    });
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Brand kit name is required", variant: "destructive" });
      return;
    }

    if (editingKit) {
      updateMutation.mutate({
        id: editingKit.id,
        data: {
          name: formData.name,
          tokens: formData.tokens,
        },
      });
    } else {
      createMutation.mutate({
        name: formData.name,
        userId: "user-1",
        tokens: formData.tokens,
      });
    }
  };

  const filteredKits = brandKits.filter((kit) =>
    kit.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const ColorPreview = ({ color }: { color: string }) => (
    <div
      className="w-6 h-6 rounded-full border border-gray-300"
      style={{ backgroundColor: color }}
    />
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="border-b bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/om">
                <Button variant="ghost" size="sm" data-testid="link-back-om">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Brand Kits</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Manage your company branding for documents
                </p>
              </div>
            </div>
            <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-brand-kit">
              <Plus className="h-4 w-4 mr-2" />
              Create Brand Kit
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search brand kits..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-brand-kits"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-24 bg-gray-100 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredKits.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Palette className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No brand kits found
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Create your first brand kit to maintain consistent styling across documents
              </p>
              <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-brand-kit-empty">
                <Plus className="h-4 w-4 mr-2" />
                Create Brand Kit
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredKits.map((kit) => {
              const tokens = kit.tokens as BrandTokens;
              return (
                <Card 
                  key={kit.id} 
                  className="hover:shadow-lg transition-shadow"
                  data-testid={`card-brand-kit-${kit.id}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Palette className="h-5 w-5 text-gray-400" />
                        <CardTitle className="text-lg">{kit.name}</CardTitle>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-kit-actions-${kit.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => handleEdit(kit)}
                            data-testid={`menu-edit-kit-${kit.id}`}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem data-testid={`menu-copy-kit-${kit.id}`}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => deleteMutation.mutate(kit.id)}
                            data-testid={`menu-delete-kit-${kit.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {tokens?.companyName && (
                      <CardDescription>{tokens.companyName}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 w-20">Colors:</span>
                        <div className="flex gap-2">
                          {tokens?.primaryColor && <ColorPreview color={tokens.primaryColor} />}
                          {tokens?.secondaryColor && <ColorPreview color={tokens.secondaryColor} />}
                          {tokens?.accentColor && <ColorPreview color={tokens.accentColor} />}
                        </div>
                      </div>
                      {tokens?.headerFont && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500 w-20">Font:</span>
                          <span className="text-sm">{tokens.headerFont}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="text-xs text-gray-400">
                    Updated {formatDistanceToNow(new Date(kit.updatedAt))} ago
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={isCreateOpen || !!editingKit} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false);
          setEditingKit(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingKit ? "Edit Brand Kit" : "Create Brand Kit"}</DialogTitle>
            <DialogDescription>
              Define your brand colors, fonts, and other styling elements
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="kit-name">Brand Kit Name</Label>
              <Input
                id="kit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Marina Capital Branding"
                data-testid="input-kit-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name</Label>
              <Input
                id="company-name"
                value={formData.tokens.companyName || ""}
                onChange={(e) => setFormData({
                  ...formData,
                  tokens: { ...formData.tokens, companyName: e.target.value }
                })}
                placeholder="e.g., Marina Capital Partners"
                data-testid="input-company-name"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primary-color">Primary</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id="primary-color"
                    value={formData.tokens.primaryColor || "#1e40af"}
                    onChange={(e) => setFormData({
                      ...formData,
                      tokens: { ...formData.tokens, primaryColor: e.target.value }
                    })}
                    className="w-12 h-10 p-1"
                    data-testid="input-primary-color"
                  />
                  <Input
                    value={formData.tokens.primaryColor || "#1e40af"}
                    onChange={(e) => setFormData({
                      ...formData,
                      tokens: { ...formData.tokens, primaryColor: e.target.value }
                    })}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondary-color">Secondary</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id="secondary-color"
                    value={formData.tokens.secondaryColor || "#1e3a5f"}
                    onChange={(e) => setFormData({
                      ...formData,
                      tokens: { ...formData.tokens, secondaryColor: e.target.value }
                    })}
                    className="w-12 h-10 p-1"
                    data-testid="input-secondary-color"
                  />
                  <Input
                    value={formData.tokens.secondaryColor || "#1e3a5f"}
                    onChange={(e) => setFormData({
                      ...formData,
                      tokens: { ...formData.tokens, secondaryColor: e.target.value }
                    })}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="accent-color">Accent</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id="accent-color"
                    value={formData.tokens.accentColor || "#f59e0b"}
                    onChange={(e) => setFormData({
                      ...formData,
                      tokens: { ...formData.tokens, accentColor: e.target.value }
                    })}
                    className="w-12 h-10 p-1"
                    data-testid="input-accent-color"
                  />
                  <Input
                    value={formData.tokens.accentColor || "#f59e0b"}
                    onChange={(e) => setFormData({
                      ...formData,
                      tokens: { ...formData.tokens, accentColor: e.target.value }
                    })}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="header-font">Header Font</Label>
              <Input
                id="header-font"
                value={formData.tokens.headerFont || ""}
                onChange={(e) => setFormData({
                  ...formData,
                  tokens: { ...formData.tokens, headerFont: e.target.value }
                })}
                placeholder="e.g., Inter, Roboto, Open Sans"
                data-testid="input-header-font"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo-url">Logo URL (optional)</Label>
              <Input
                id="logo-url"
                value={formData.tokens.logoUrl || ""}
                onChange={(e) => setFormData({
                  ...formData,
                  tokens: { ...formData.tokens, logoUrl: e.target.value }
                })}
                placeholder="https://..."
                data-testid="input-logo-url"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateOpen(false);
              setEditingKit(null);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-brand-kit"
            >
              <Check className="h-4 w-4 mr-2" />
              {editingKit ? "Save Changes" : "Create Brand Kit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

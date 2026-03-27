import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText,
  Upload,
  X,
  Plus,
  Trash2,
  DollarSign,
  Package,
  Clock,
  Mail,
  Phone,
  MessageSquare,
  Calendar,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Deal, Note, File as FileType, Product, DealProduct, Activity } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";

type DealProductWithProduct = DealProduct & { product: Product };

interface DealDrawerProps {
  deal: Deal | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DealDrawer({ deal, isOpen, onClose }: DealDrawerProps) {
  if (!deal) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" data-testid="drawer-deal">
        <SheetHeader>
          <SheetTitle data-testid="text-deal-title">{deal.title}</SheetTitle>
          <SheetDescription>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline">{deal.stage}</Badge>
              {deal.value && (
                <span className="text-lg font-semibold text-green-600">
                  {formatCurrency(parseFloat(deal.value))}
                </span>
              )}
            </div>
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="notes" className="mt-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="notes" data-testid="tab-notes">
              <FileText className="h-4 w-4 mr-2" />
              Notes
            </TabsTrigger>
            <TabsTrigger value="files" data-testid="tab-files">
              <Upload className="h-4 w-4 mr-2" />
              Files
            </TabsTrigger>
            <TabsTrigger value="products" data-testid="tab-products">
              <Package className="h-4 w-4 mr-2" />
              Products
            </TabsTrigger>
            <TabsTrigger value="timeline" data-testid="tab-timeline">
              <Clock className="h-4 w-4 mr-2" />
              Timeline
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="mt-4">
            <NotesTab dealId={deal.id} />
          </TabsContent>

          <TabsContent value="files" className="mt-4">
            <FilesTab dealId={deal.id} />
          </TabsContent>

          <TabsContent value="products" className="mt-4">
            <ProductsTab dealId={deal.id} />
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <TimelineTab dealId={deal.id} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function NotesTab({ dealId }: { dealId: string }) {
  const [noteText, setNoteText] = useState("");
  const { toast } = useToast();

  const { data: notes = [], isLoading } = useQuery<Note[]>({
    queryKey: ['/api/notes', 'deal', dealId],
    queryFn: async () => {
      const response = await fetch(`/api/notes/deal/${dealId}`);
      if (!response.ok) throw new Error('Failed to fetch notes');
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest('/api/notes', 'POST', {
        content,
        entityType: 'deal',
        entityId: dealId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notes', 'deal', dealId] });
      setNoteText("");
      toast({ title: "Note added successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add note", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      return await apiRequest(`/api/notes/${noteId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notes', 'deal', dealId] });
      toast({ title: "Note deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete note", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4" data-testid="section-notes">
      <div className="space-y-2">
        <Textarea
          placeholder="Add a note..."
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          rows={4}
          data-testid="input-note"
        />
        <Button
          onClick={() => createMutation.mutate(noteText)}
          disabled={!noteText.trim() || createMutation.isPending}
          data-testid="button-add-note"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Note
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-4 text-gray-500">Loading notes...</div>
      ) : notes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No notes yet. Add your first note above.
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <Card key={note.id} data-testid={`card-note-${note.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <p className="text-sm text-gray-700 flex-1">{note.content}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this note?')) {
                        deleteMutation.mutate(note.id);
                      }
                    }}
                    data-testid={`button-delete-note-${note.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {format(new Date(note.createdAt), 'MM/dd/yyyy h:mm a')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function FilesTab({ dealId }: { dealId: string }) {
  const { toast } = useToast();

  const { data: files = [], isLoading } = useQuery<FileType[]>({
    queryKey: ['/api/files', 'deal', dealId],
    queryFn: async () => {
      const response = await fetch(`/api/files/deal/${dealId}`);
      if (!response.ok) throw new Error('Failed to fetch files');
      return response.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'deal');
      formData.append('entityId', dealId);
      
      const response = await fetch('/api/files', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) throw new Error('Failed to upload file');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files', 'deal', dealId] });
      toast({ title: "File uploaded successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to upload file", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      return await apiRequest(`/api/files/${fileId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files', 'deal', dealId] });
      toast({ title: "File deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete file", description: error.message, variant: "destructive" });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  return (
    <div className="space-y-4" data-testid="section-files">
      <div>
        <label htmlFor="file-upload">
          <Button
            type="button"
            onClick={() => document.getElementById('file-upload')?.click()}
            disabled={uploadMutation.isPending}
            data-testid="button-upload-file"
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploadMutation.isPending ? 'Uploading...' : 'Upload File'}
          </Button>
        </label>
        <input
          id="file-upload"
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          data-testid="input-file-upload"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-4 text-gray-500">Loading files...</div>
      ) : files.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No files yet. Upload your first file above.
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <Card key={file.id} data-testid={`card-file-${file.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.fileName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(file.size / 1024).toFixed(2)} KB • {format(new Date(file.createdAt), 'MM/dd/yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(file.url, '_blank')}
                      data-testid={`button-view-file-${file.id}`}
                    >
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this file?')) {
                          deleteMutation.mutate(file.id);
                        }
                      }}
                      data-testid={`button-delete-file-${file.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductsTab({ dealId }: { dealId: string }) {
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const { toast } = useToast();

  const { data: dealProducts = [], isLoading: isLoadingDealProducts } = useQuery<DealProductWithProduct[]>({
    queryKey: ['/api/deals', dealId, 'products'],
    queryFn: async () => {
      const response = await fetch(`/api/deals/${dealId}/products`);
      if (!response.ok) throw new Error('Failed to fetch deal products');
      return response.json();
    },
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  const addMutation = useMutation({
    mutationFn: async (data: { productId: string; quantity: number }) => {
      return await apiRequest(`/api/deals/${dealId}/products`, 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId, 'products'] });
      setSelectedProductId("");
      setQuantity("1");
      toast({ title: "Product added successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add product", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (dealProductId: string) => {
      return await apiRequest(`/api/deal-products/${dealProductId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId, 'products'] });
      toast({ title: "Product removed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to remove product", description: error.message, variant: "destructive" });
    },
  });

  const totalValue = dealProducts.reduce((sum, dp) => {
    const price = parseFloat(dp.price || '0');
    const qty = dp.quantity || 1;
    return sum + (price * qty);
  }, 0);

  return (
    <div className="space-y-4" data-testid="section-products">
      <div className="flex gap-2">
        <select
          value={selectedProductId}
          onChange={(e) => setSelectedProductId(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          data-testid="select-product"
        >
          <option value="">Select a product...</option>
          {products.filter(p => p.isActive).map(product => (
            <option key={product.id} value={product.id} data-testid={`option-product-${product.id}`}>
              {product.name} - ${parseFloat(product.price).toFixed(2)}
            </option>
          ))}
        </select>
        <Input
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Qty"
          className="w-24"
          data-testid="input-quantity"
        />
        <Button
          onClick={() => addMutation.mutate({ productId: selectedProductId, quantity: parseInt(quantity) })}
          disabled={!selectedProductId || addMutation.isPending}
          data-testid="button-add-product"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {isLoadingDealProducts ? (
        <div className="text-center py-4 text-gray-500">Loading products...</div>
      ) : dealProducts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No products added yet. Select a product above to get started.
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {dealProducts.map((dp) => (
              <Card key={dp.id} data-testid={`card-deal-product-${dp.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{dp.product.name}</p>
                      <p className="text-xs text-gray-500">
                        Qty: {dp.quantity} × ${parseFloat(dp.price || '0').toFixed(2)} = ${(parseFloat(dp.price || '0') * (dp.quantity || 1)).toFixed(2)}
                        {dp.isRecurring && ` / ${dp.billingCycle}`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('Remove this product from the deal?')) {
                          deleteMutation.mutate(dp.id);
                        }
                      }}
                      data-testid={`button-delete-product-${dp.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900">Total Value:</span>
                <span className="text-lg font-bold text-green-600" data-testid="text-total-value">
                  ${totalValue.toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function TimelineTab({ dealId }: { dealId: string }) {
  const { data: activities = [], isLoading } = useQuery<Activity[]>({
    queryKey: ['/api/activities', 'deal', dealId],
    queryFn: async () => {
      const response = await fetch(`/api/activities/deal/${dealId}`);
      if (!response.ok) throw new Error('Failed to fetch activities');
      return response.json();
    },
  });

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'call':
        return <Phone className="h-4 w-4" />;
      case 'meeting':
        return <Calendar className="h-4 w-4" />;
      case 'sms':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'email':
        return 'bg-blue-100 text-blue-600';
      case 'call':
        return 'bg-green-100 text-green-600';
      case 'meeting':
        return 'bg-purple-100 text-purple-600';
      case 'sms':
        return 'bg-yellow-100 text-yellow-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="space-y-4" data-testid="section-timeline">
      {isLoading ? (
        <div className="text-center py-4 text-gray-500">Loading timeline...</div>
      ) : activities.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No activity yet. All interactions will appear here.
        </div>
      ) : (
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex gap-3" data-testid={`item-activity-${activity.id}`}>
              <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${getActivityColor(activity.type)}`}>
                {getActivityIcon(activity.type)}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{activity.subject}</p>
                    {activity.description && (
                      <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {activity.type}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {activity.scheduledAt && format(new Date(activity.scheduledAt), 'MM/dd/yyyy h:mm a')}
                  {activity.completedAt && <span className="ml-2 text-green-600">✓ Completed</span>}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

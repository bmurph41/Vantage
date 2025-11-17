import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  CheckCircle2, Circle, XCircle, Plus, Edit2, Trash2, Link as LinkIcon, 
  ExternalLink, FileText, ArrowLeft, Download, Folder, AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type DataRequestStatus = 'outstanding' | 'received' | 'n_a';

interface DataRequestItem {
  id: string;
  projectId: string;
  category: string;
  documentName: string;
  description: string | null;
  displayOrder: number;
  status: DataRequestStatus;
  linkedDocumentId: string | null;
  isInDataRoom: boolean;
  notes: string | null;
  dueDate: string | null;
  receivedDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function DataRequest() {
  const { projectId } = useParams();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DataRequestItem | null>(null);
  const [formData, setFormData] = useState({
    category: "",
    documentName: "",
    description: "",
    dueDate: "",
  });

  const { data: project } = useQuery<any>({
    queryKey: ['/api/projects', projectId],
  });

  const { data: items = [], isLoading } = useQuery<DataRequestItem[]>({
    queryKey: ['/api/vdr/projects', projectId, 'data-requests'],
    enabled: !!projectId,
  });

  const { data: documents = [] } = useQuery<any[]>({
    queryKey: ['/api/vdr/projects', projectId, 'documents'],
    enabled: !!projectId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/vdr/projects/${projectId}/data-requests`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vdr/projects', projectId, 'data-requests'] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: "Success", description: "Document request added" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      return apiRequest(`/api/vdr/data-requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vdr/projects', projectId, 'data-requests'] });
      setEditingItem(null);
      toast({ title: "Success", description: "Document request updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/vdr/data-requests/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vdr/projects', projectId, 'data-requests'] });
      toast({ title: "Success", description: "Document request deleted" });
    },
  });

  const linkDocumentMutation = useMutation({
    mutationFn: async ({ itemId, documentId }: { itemId: string; documentId: string }) => {
      return apiRequest(`/api/vdr/data-requests/${itemId}/link-document`, {
        method: 'POST',
        body: JSON.stringify({ documentId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vdr/projects', projectId, 'data-requests'] });
      toast({ title: "Success", description: "Document linked successfully" });
    },
  });

  const resetForm = () => {
    setFormData({
      category: "",
      documentName: "",
      description: "",
      dueDate: "",
    });
  };

  const handleSubmit = () => {
    if (!formData.category || !formData.documentName) {
      toast({ title: "Error", description: "Please fill in required fields", variant: "destructive" });
      return;
    }

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (item: DataRequestItem) => {
    setEditingItem(item);
    setFormData({
      category: item.category,
      documentName: item.documentName,
      description: item.description || "",
      dueDate: item.dueDate || "",
    });
    setIsAddDialogOpen(true);
  };

  const handleStatusChange = (item: DataRequestItem, status: DataRequestStatus) => {
    updateMutation.mutate({ id: item.id, status });
  };

  const categories = Array.from(new Set(items.map(item => item.category)));
  const filteredItems = selectedCategory === "all" 
    ? items 
    : items.filter(item => item.category === selectedCategory);

  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, DataRequestItem[]>);

  const stats = {
    total: items.length,
    received: items.filter(i => i.status === 'received').length,
    outstanding: items.filter(i => i.status === 'outstanding').length,
    na: items.filter(i => i.status === 'n_a').length,
  };

  const getStatusBadge = (status: DataRequestStatus) => {
    switch (status) {
      case 'received':
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />Received</Badge>;
      case 'outstanding':
        return <Badge variant="destructive"><Circle className="w-3 h-3 mr-1" />Outstanding</Badge>;
      case 'n_a':
        return <Badge variant="secondary"><XCircle className="w-3 h-3 mr-1" />N/A</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/vdr">
              <Button variant="ghost" size="sm" data-testid="button-back">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to VDR
              </Button>
            </Link>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900"  data-testid="text-page-title">Data Request</h1>
              <p className="text-gray-600 mt-1" data-testid="text-project-name">{project?.name}</p>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { resetForm(); setEditingItem(null); }} data-testid="button-add-request">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Document Request
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingItem ? 'Edit Document Request' : 'Add Document Request'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="category">Category *</Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="e.g., Financial, Legal, Operational"
                      data-testid="input-category"
                    />
                  </div>
                  <div>
                    <Label htmlFor="documentName">Document Name *</Label>
                    <Input
                      id="documentName"
                      value={formData.documentName}
                      onChange={(e) => setFormData({ ...formData, documentName: e.target.value })}
                      placeholder="e.g., Financial Statements 2023"
                      data-testid="input-document-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Additional details..."
                      rows={3}
                      data-testid="input-description"
                    />
                  </div>
                  <div>
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      data-testid="input-due-date"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} data-testid="button-cancel">Cancel</Button>
                  <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit">
                    {editingItem ? 'Update' : 'Add'} Request
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-gray-600">Total Requests</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">{stats.received}</div>
              <div className="text-sm text-gray-600">Received</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600">{stats.outstanding}</div>
              <div className="text-sm text-gray-600">Outstanding</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-gray-600">{stats.na}</div>
              <div className="text-sm text-gray-600">N/A</div>
            </CardContent>
          </Card>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={selectedCategory === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory("all")}
            data-testid="button-filter-all"
          >
            All Categories
          </Button>
          {categories.map(category => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              data-testid={`button-filter-${category.toLowerCase().replace(/\s/g, '-')}`}
            >
              {category}
            </Button>
          ))}
        </div>

        {/* Document Checklist */}
        {isLoading ? (
          <div className="text-center py-12">Loading...</div>
        ) : Object.keys(groupedItems).length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">No document requests yet. Click "Add Document Request" to get started.</p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedItems).map(([category, categoryItems]) => (
            <Card key={category} className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">{category}</CardTitle>
                <CardDescription>{categoryItems.length} documents</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {categoryItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50" data-testid={`item-${item.id}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="font-medium">{item.documentName}</div>
                          {getStatusBadge(item.status)}
                          {item.isInDataRoom && (
                            <Badge variant="outline" className="text-blue-600 border-blue-600">
                              <Folder className="w-3 h-3 mr-1" />
                              In Data Room
                            </Badge>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                        )}
                        {item.dueDate && (
                          <p className="text-xs text-gray-500 mt-1">Due: {new Date(item.dueDate).toLocaleDateString()}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Select value={item.status} onValueChange={(value) => handleStatusChange(item, value as DataRequestStatus)}>
                          <SelectTrigger className="w-32" data-testid={`select-status-${item.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="outstanding">Outstanding</SelectItem>
                            <SelectItem value="received">Received</SelectItem>
                            <SelectItem value="n_a">N/A</SelectItem>
                          </SelectContent>
                        </Select>
                        {item.linkedDocumentId && (
                          <Link href={`/vdr/${projectId}/document/${item.linkedDocumentId}`}>
                            <Button variant="ghost" size="sm" data-testid={`button-view-doc-${item.id}`}>
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </Link>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(item)} data-testid={`button-edit-${item.id}`}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(item.id)} data-testid={`button-delete-${item.id}`}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

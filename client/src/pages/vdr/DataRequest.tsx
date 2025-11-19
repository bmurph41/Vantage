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
import { Checkbox } from "@/components/ui/checkbox";
import { 
  CheckCircle2, Circle, XCircle, Plus, Edit2, Trash2, Link as LinkIcon, 
  ExternalLink, FileText, ArrowLeft, Download, Folder, AlertCircle, LayoutGrid, List,
  Filter, CheckSquare, Square, Users, Flag, Clock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type DataRequestStatus = 'outstanding' | 'in_progress' | 'received' | 'n_a';
type DataRequestPriority = 'low' | 'medium' | 'high' | 'urgent';

interface DataRequestItem {
  id: string;
  projectId: string;
  category: string;
  documentName: string;
  description: string | null;
  displayOrder: number;
  status: DataRequestStatus;
  priority: DataRequestPriority;
  assigneeId: string | null;
  externalAssigneeId: string | null;
  linkedDocumentId: string | null;
  isInDataRoom: boolean;
  notes: string | null;
  dueDate: string | null;
  receivedDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  type: 'internal' | 'external';
  role?: string;
}

export default function DataRequest() {
  const { projectId } = useParams();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DataRequestItem | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [formData, setFormData] = useState({
    category: "",
    documentName: "",
    description: "",
    dueDate: "",
    priority: "medium" as DataRequestPriority,
    assigneeId: "",
    externalAssigneeId: "",
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

  const { data: teamMembers } = useQuery<{ internal: TeamMember[]; external: TeamMember[] }>({
    queryKey: ['/api/vdr/projects', projectId, 'team-members'],
    enabled: !!projectId,
  });

  const { data: categories = [] } = useQuery<Array<{ id: string; name: string; description: string }>>({
    queryKey: ['/api/vdr/diligence-categories'],
  });

  const { data: dueDatePresets = [] } = useQuery<Array<{ id: string; slug: string; name: string; days: number; displayOrder: number }>>({
    queryKey: ['/api/vdr/due-date-presets'],
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

  const bulkUpdateMutation = useMutation({
    mutationFn: async (updates: any) => {
      return apiRequest(`/api/vdr/projects/${projectId}/data-requests/bulk-update`, {
        method: 'POST',
        body: JSON.stringify({ itemIds: selectedItems, updates }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vdr/projects', projectId, 'data-requests'] });
      setSelectedItems([]);
      toast({ title: "Success", description: "Items updated successfully" });
    },
  });

  const resetForm = () => {
    setFormData({
      category: "",
      documentName: "",
      description: "",
      dueDate: "",
      priority: "medium",
      assigneeId: "",
      externalAssigneeId: "",
    });
  };

  const handleSubmit = () => {
    console.log('handleSubmit called', formData);
    if (!formData.category || !formData.documentName) {
      console.log('Validation failed - missing required fields');
      toast({ title: "Error", description: "Please fill in required fields", variant: "destructive" });
      return;
    }

    console.log('Submitting data...');
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
      priority: item.priority || "medium",
      assigneeId: item.assigneeId || "",
      externalAssigneeId: item.externalAssigneeId || "",
    });
    setIsAddDialogOpen(true);
  };

  const handleStatusChange = (item: DataRequestItem, status: DataRequestStatus) => {
    updateMutation.mutate({ id: item.id, status });
  };

  const usedCategories = Array.from(new Set(items.map(item => item.category)));
  
  const filteredItems = items.filter(item => {
    // Category filter
    if (selectedCategory !== "all" && item.category !== selectedCategory) return false;
    
    // Assignee filter
    if (filterAssignee !== "all") {
      if (filterAssignee === "unassigned" && (item.assigneeId || item.externalAssigneeId)) return false;
      if (filterAssignee.startsWith("internal:") && item.assigneeId !== filterAssignee.replace("internal:", "")) return false;
      if (filterAssignee.startsWith("external:") && item.externalAssigneeId !== filterAssignee.replace("external:", "")) return false;
    }
    
    // Priority filter
    if (filterPriority !== "all" && item.priority !== filterPriority) return false;
    
    // Status filter
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    
    return true;
  });

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
    inProgress: items.filter(i => i.status === 'in_progress').length,
    outstanding: items.filter(i => i.status === 'outstanding').length,
    na: items.filter(i => i.status === 'n_a').length,
  };

  const getStatusBadge = (status: DataRequestStatus) => {
    switch (status) {
      case 'received':
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />Received</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500 hover:bg-blue-600"><Circle className="w-3 h-3 mr-1" />In Progress</Badge>;
      case 'outstanding':
        return <Badge variant="destructive"><Circle className="w-3 h-3 mr-1" />Outstanding</Badge>;
      case 'n_a':
        return <Badge variant="secondary"><XCircle className="w-3 h-3 mr-1" />N/A</Badge>;
    }
  };

  const getPriorityBadge = (priority: DataRequestPriority) => {
    switch (priority) {
      case 'urgent':
        return <Badge className="bg-red-600 hover:bg-red-700 text-white">Urgent</Badge>;
      case 'high':
        return <Badge className="bg-orange-500 hover:bg-orange-600 text-white">High</Badge>;
      case 'medium':
        return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">Medium</Badge>;
      case 'low':
        return <Badge className="bg-gray-400 hover:bg-gray-500 text-white">Low</Badge>;
    }
  };

  const getAssigneeName = (item: DataRequestItem) => {
    if (item.assigneeId && teamMembers?.internal) {
      const assignee = teamMembers.internal.find(u => u.id === item.assigneeId);
      return assignee?.name || 'Unknown';
    }
    if (item.externalAssigneeId && teamMembers?.external) {
      const assignee = teamMembers.external.find(u => u.id === item.externalAssigneeId);
      return assignee ? `${assignee.name} (${assignee.role || 'External'})` : 'Unknown';
    }
    return 'Unassigned';
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
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingItem ? 'Edit Document Request' : 'Add Document Request'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="category">Category *</Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                      <SelectTrigger data-testid="select-category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.name}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="dueDate">Due Date</Label>
                      <div className="flex gap-1">
                        {dueDatePresets.map(preset => (
                          <Button
                            key={preset.id}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              const today = new Date();
                              today.setDate(today.getDate() + preset.days);
                              const formattedDate = today.toISOString().split('T')[0];
                              setFormData({ ...formData, dueDate: formattedDate });
                            }}
                            data-testid={`button-preset-${preset.name.toLowerCase().replace(/\s/g, '-')}`}
                          >
                            {preset.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <Input
                      id="dueDate"
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      data-testid="input-due-date"
                    />
                  </div>
                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select value={formData.priority} onValueChange={(value: DataRequestPriority) => setFormData({ ...formData, priority: value })}>
                      <SelectTrigger data-testid="select-priority">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="assignee">Assignee</Label>
                    <Select 
                      value={formData.assigneeId || formData.externalAssigneeId || "unassigned"} 
                      onValueChange={(value) => {
                        if (value === "unassigned") {
                          setFormData({ ...formData, assigneeId: "", externalAssigneeId: "" });
                        } else if (value.startsWith("internal:")) {
                          setFormData({ ...formData, assigneeId: value.replace("internal:", ""), externalAssigneeId: "" });
                        } else if (value.startsWith("external:")) {
                          setFormData({ ...formData, assigneeId: "", externalAssigneeId: value.replace("external:", "") });
                        }
                      }}
                    >
                      <SelectTrigger data-testid="select-assignee">
                        <SelectValue placeholder="Select assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {teamMembers?.internal && teamMembers.internal.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">Internal Team</div>
                            {teamMembers.internal.map(member => (
                              <SelectItem key={member.id} value={`internal:${member.id}`}>
                                {member.name} ({member.email})
                              </SelectItem>
                            ))}
                          </>
                        )}
                        {teamMembers?.external && teamMembers.external.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">External Users</div>
                            {teamMembers.external.map(member => (
                              <SelectItem key={member.id} value={`external:${member.id}`}>
                                {member.name} - {member.role || 'External'} ({member.email})
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
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
        <div className="grid grid-cols-5 gap-4 mb-6">
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
              <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
              <div className="text-sm text-gray-600">In Progress</div>
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

        {/* Filter Toolbar */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <Filter className="w-4 h-4 text-gray-500" />
              <Select value={filterAssignee} onValueChange={setFilterAssignee}>
                <SelectTrigger className="w-48" data-testid="filter-assignee">
                  <SelectValue placeholder="Filter by assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignees</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {teamMembers?.internal && teamMembers.internal.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">Internal Team</div>
                      {teamMembers.internal.map(member => (
                        <SelectItem key={member.id} value={`internal:${member.id}`}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {teamMembers?.external && teamMembers.external.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">External Users</div>
                      {teamMembers.external.map(member => (
                        <SelectItem key={member.id} value={`external:${member.id}`}>
                          {member.name} ({member.role})
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-40" data-testid="filter-priority">
                  <SelectValue placeholder="Filter by priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40" data-testid="filter-status">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="outstanding">Outstanding</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="n_a">N/A</SelectItem>
                </SelectContent>
              </Select>
              {(filterAssignee !== "all" || filterPriority !== "all" || filterStatus !== "all") && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setFilterAssignee("all");
                    setFilterPriority("all");
                    setFilterStatus("all");
                  }}
                  data-testid="button-clear-filters"
                >
                  Clear Filters
                </Button>
              )}
            </div>
            {selectedItems.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">{selectedItems.length} selected</span>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-bulk-assign">
                      <Users className="w-4 h-4 mr-2" />
                      Assign
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Bulk Assign</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                      <Label>Assign to</Label>
                      <Select 
                        onValueChange={(value) => {
                          if (value === "unassigned") {
                            bulkUpdateMutation.mutate({ assigneeId: null, externalAssigneeId: null });
                          } else if (value.startsWith("internal:")) {
                            bulkUpdateMutation.mutate({ assigneeId: value.replace("internal:", ""), externalAssigneeId: null });
                          } else if (value.startsWith("external:")) {
                            bulkUpdateMutation.mutate({ assigneeId: null, externalAssigneeId: value.replace("external:", "") });
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select assignee" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {teamMembers?.internal && teamMembers.internal.length > 0 && (
                            <>
                              <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">Internal Team</div>
                              {teamMembers.internal.map(member => (
                                <SelectItem key={member.id} value={`internal:${member.id}`}>
                                  {member.name}
                                </SelectItem>
                              ))}
                            </>
                          )}
                          {teamMembers?.external && teamMembers.external.length > 0 && (
                            <>
                              <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">External Users</div>
                              {teamMembers.external.map(member => (
                                <SelectItem key={member.id} value={`external:${member.id}`}>
                                  {member.name}
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-bulk-priority">
                      <Flag className="w-4 h-4 mr-2" />
                      Set Priority
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Bulk Set Priority</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                      <Label>Priority</Label>
                      <Select onValueChange={(value) => bulkUpdateMutation.mutate({ priority: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setSelectedItems([])}
                  data-testid="button-clear-selection"
                >
                  Clear
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Category Filter and View Toggle */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-2">
            <Button
              variant={selectedCategory === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("all")}
              data-testid="button-filter-all"
            >
              All Categories
            </Button>
            {usedCategories.map(category => (
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
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
              data-testid="button-view-list"
            >
              <List className="w-4 h-4 mr-2" />
              List View
            </Button>
            <Button
              variant={viewMode === 'board' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('board')}
              data-testid="button-view-board"
            >
              <LayoutGrid className="w-4 h-4 mr-2" />
              Kanban Board
            </Button>
          </div>
        </div>

        {/* Document Checklist */}
        {isLoading ? (
          <div className="text-center py-12">Loading...</div>
        ) : filteredItems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">No document requests yet. Click "Add Document Request" to get started.</p>
            </CardContent>
          </Card>
        ) : viewMode === 'board' ? (
          <div className="grid grid-cols-4 gap-4">
            {/* Outstanding Column */}
            <div className="flex flex-col">
              <div className="bg-red-50 border-2 border-red-200 rounded-t-lg p-3">
                <h3 className="font-semibold text-red-800 flex items-center gap-2">
                  <Circle className="w-4 h-4" />
                  Outstanding ({filteredItems.filter(i => i.status === 'outstanding').length})
                </h3>
              </div>
              <div className="bg-gray-50 border border-t-0 rounded-b-lg p-3 space-y-2 min-h-96">
                {filteredItems.filter(i => i.status === 'outstanding').map(item => (
                  <Card key={item.id} className="p-3 hover:shadow-md transition-shadow cursor-pointer" data-testid={`board-item-${item.id}`}>
                    <div className="space-y-2">
                      <div className="font-medium text-sm">{item.documentName}</div>
                      <div className="flex gap-1 flex-wrap">
                        {getPriorityBadge(item.priority)}
                        {item.isInDataRoom && (
                          <Badge variant="outline" className="text-xs">
                            <Folder className="w-3 h-3 mr-1" />
                            In VDR
                          </Badge>
                        )}
                      </div>
                      {(item.assigneeId || item.externalAssigneeId) && (
                        <p className="text-xs text-gray-600 truncate">
                          {getAssigneeName(item)}
                        </p>
                      )}
                      {item.dueDate && (
                        <p className="text-xs text-gray-500">Due: {new Date(item.dueDate).toLocaleDateString()}</p>
                      )}
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(item)} className="h-7 text-xs">
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleStatusChange(item, 'in_progress')}
                          className="h-7 text-xs flex-1"
                        >
                          Start
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* In Progress Column */}
            <div className="flex flex-col">
              <div className="bg-blue-50 border-2 border-blue-200 rounded-t-lg p-3">
                <h3 className="font-semibold text-blue-800 flex items-center gap-2">
                  <Circle className="w-4 h-4" />
                  In Progress ({filteredItems.filter(i => i.status === 'in_progress').length})
                </h3>
              </div>
              <div className="bg-gray-50 border border-t-0 rounded-b-lg p-3 space-y-2 min-h-96">
                {filteredItems.filter(i => i.status === 'in_progress').map(item => (
                  <Card key={item.id} className="p-3 hover:shadow-md transition-shadow cursor-pointer" data-testid={`board-item-${item.id}`}>
                    <div className="space-y-2">
                      <div className="font-medium text-sm">{item.documentName}</div>
                      <div className="flex gap-1 flex-wrap">
                        {getPriorityBadge(item.priority)}
                        {item.isInDataRoom && (
                          <Badge variant="outline" className="text-xs">
                            <Folder className="w-3 h-3 mr-1" />
                            In VDR
                          </Badge>
                        )}
                      </div>
                      {(item.assigneeId || item.externalAssigneeId) && (
                        <p className="text-xs text-gray-600 truncate">
                          {getAssigneeName(item)}
                        </p>
                      )}
                      {item.dueDate && (
                        <p className="text-xs text-gray-500">Due: {new Date(item.dueDate).toLocaleDateString()}</p>
                      )}
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(item)} className="h-7 text-xs">
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleStatusChange(item, 'received')}
                          className="h-7 text-xs flex-1"
                        >
                          Complete
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Received Column */}
            <div className="flex flex-col">
              <div className="bg-green-50 border-2 border-green-200 rounded-t-lg p-3">
                <h3 className="font-semibold text-green-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Received ({filteredItems.filter(i => i.status === 'received').length})
                </h3>
              </div>
              <div className="bg-gray-50 border border-t-0 rounded-b-lg p-3 space-y-2 min-h-96">
                {filteredItems.filter(i => i.status === 'received').map(item => (
                  <Card key={item.id} className="p-3 hover:shadow-md transition-shadow cursor-pointer" data-testid={`board-item-${item.id}`}>
                    <div className="space-y-2">
                      <div className="font-medium text-sm">{item.documentName}</div>
                      <div className="flex gap-1 flex-wrap">
                        {getPriorityBadge(item.priority)}
                        {item.isInDataRoom && (
                          <Badge variant="outline" className="text-xs">
                            <Folder className="w-3 h-3 mr-1" />
                            In VDR
                          </Badge>
                        )}
                      </div>
                      {(item.assigneeId || item.externalAssigneeId) && (
                        <p className="text-xs text-gray-600 truncate">
                          {getAssigneeName(item)}
                        </p>
                      )}
                      {item.receivedDate && (
                        <p className="text-xs text-gray-500">Received: {new Date(item.receivedDate).toLocaleDateString()}</p>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(item)} className="h-7 text-xs w-full">
                        <Edit2 className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* N/A Column */}
            <div className="flex flex-col">
              <div className="bg-gray-100 border-2 border-gray-300 rounded-t-lg p-3">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  N/A ({filteredItems.filter(i => i.status === 'n_a').length})
                </h3>
              </div>
              <div className="bg-gray-50 border border-t-0 rounded-b-lg p-3 space-y-2 min-h-96">
                {filteredItems.filter(i => i.status === 'n_a').map(item => (
                  <Card key={item.id} className="p-3 hover:shadow-md transition-shadow cursor-pointer opacity-60" data-testid={`board-item-${item.id}`}>
                    <div className="space-y-2">
                      <div className="font-medium text-sm">{item.documentName}</div>
                      <div className="flex gap-1 flex-wrap">
                        {getPriorityBadge(item.priority)}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(item)} className="h-7 text-xs w-full">
                        <Edit2 className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
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
                    <div key={item.id} className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50" data-testid={`item-${item.id}`}>
                      <Checkbox
                        checked={selectedItems.includes(item.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedItems([...selectedItems, item.id]);
                          } else {
                            setSelectedItems(selectedItems.filter(id => id !== item.id));
                          }
                        }}
                        data-testid={`checkbox-${item.id}`}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="font-medium">{item.documentName}</div>
                          {getStatusBadge(item.status)}
                          {getPriorityBadge(item.priority)}
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
                        <div className="flex items-center gap-4 mt-1">
                          {item.dueDate && (
                            <p className="text-xs text-gray-500">Due: {new Date(item.dueDate).toLocaleDateString()}</p>
                          )}
                          {(item.assigneeId || item.externalAssigneeId) && (
                            <p className="text-xs text-gray-600">
                              <span className="font-medium">Assigned to:</span> {getAssigneeName(item)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select value={item.status} onValueChange={(value) => handleStatusChange(item, value as DataRequestStatus)}>
                          <SelectTrigger className="w-36" data-testid={`select-status-${item.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="outstanding">Outstanding</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
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

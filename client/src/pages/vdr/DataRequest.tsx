import { useState, useRef } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  CheckCircle2, Circle, XCircle, Plus, Edit2, Trash2, Link as LinkIcon, 
  ExternalLink, FileText, ArrowLeft, Download, Folder, AlertCircle, LayoutGrid, List,
  Filter, CheckSquare, Square, Users, Flag, Clock, Upload, X, FolderOpen
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
  type: 'internal' | 'external' | 'deal_member';
  role?: string;
}

interface TeamMembersResponse {
  internal: TeamMember[];
  dealMembers: TeamMember[];
  external: TeamMember[];
}

const addDealMemberFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  phone: z.string().optional(),
  role: z.string().optional(),
});

export default function DataRequest() {
  const { projectId } = useParams();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dealMemberForm = useForm<z.infer<typeof addDealMemberFormSchema>>({
    resolver: zodResolver(addDealMemberFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      role: "",
    },
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

  const { data: teamMembers, refetch: refetchTeamMembers } = useQuery<TeamMembersResponse>({
    queryKey: ['/api/vdr/projects', projectId, 'team-members'],
    enabled: !!projectId,
  });

  const { data: vdrFolders = [] } = useQuery<Array<{ id: string; name: string; parentFolderId: string | null }>>({
    queryKey: ['/api/vdr/projects', projectId, 'folders'],
    enabled: !!projectId,
  });

  const addDealMemberMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addDealMemberFormSchema>) => {
      const result = await apiRequest('POST', `/api/vdr/projects/${projectId}/deal-members`, data);
      return result.json();
    },
    onSuccess: () => {
      refetchTeamMembers();
      setIsAddMemberDialogOpen(false);
      dealMemberForm.reset();
      toast({ title: "Success", description: "Team member added to the deal" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to add team member", 
        variant: "destructive" 
      });
    },
  });

  const { data: categories = [] } = useQuery<Array<{ id: string; name: string; description: string }>>({
    queryKey: ['/api/vdr/diligence-categories'],
  });

  const { data: dueDatePresets = [] } = useQuery<Array<{ id: string; slug: string; name: string; days: number; displayOrder: number }>>({
    queryKey: ['/api/vdr/due-date-presets'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const result = await apiRequest('POST', `/api/vdr/projects/${projectId}/data-requests`, data);
      return result.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vdr/projects', projectId, 'data-requests'] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: "Success", description: "Document request added" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create request", 
        variant: "destructive" 
      });
    },
  });

  const createWithFilesMutation = useMutation({
    mutationFn: async (formDataPayload: FormData) => {
      const response = await fetch(`/api/vdr/projects/${projectId}/data-requests-with-files`, {
        method: 'POST',
        body: formDataPayload,
        credentials: 'include',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create request with files');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vdr/projects', projectId, 'data-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vdr/projects', projectId, 'documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vdr/projects', projectId, 'folders'] });
      setIsAddDialogOpen(false);
      resetForm();
      setSelectedFiles([]);
      setSelectedFolderId("");
      setIsUploadingFiles(false);
      toast({ title: "Success", description: "Document request added with files" });
    },
    onError: (error: any) => {
      setIsUploadingFiles(false);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create request with files", 
        variant: "destructive" 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const result = await apiRequest('PATCH', `/api/vdr/data-requests/${id}`, data);
      return result.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vdr/projects', projectId, 'data-requests'] });
      setEditingItem(null);
      toast({ title: "Success", description: "Document request updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/vdr/data-requests/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vdr/projects', projectId, 'data-requests'] });
      toast({ title: "Success", description: "Document request deleted" });
    },
  });

  const linkDocumentMutation = useMutation({
    mutationFn: async ({ itemId, documentId }: { itemId: string; documentId: string }) => {
      return apiRequest('POST', `/api/vdr/data-requests/${itemId}/link-document`, { documentId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vdr/projects', projectId, 'data-requests'] });
      toast({ title: "Success", description: "Document linked successfully" });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async (updates: any) => {
      return apiRequest('POST', `/api/vdr/projects/${projectId}/data-requests/bulk-update`, { itemIds: selectedItems, updates });
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
    setSelectedFiles([]);
    setSelectedFolderId("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!formData.category || !formData.documentName || !formData.dueDate || !formData.priority || (!formData.assigneeId && !formData.externalAssigneeId)) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, ...formData });
    } else if (selectedFiles.length > 0) {
      if (!selectedFolderId) {
        toast({ title: "Error", description: "Please select a folder for the uploaded files", variant: "destructive" });
        return;
      }
      
      setIsUploadingFiles(true);
      const formDataPayload = new FormData();
      formDataPayload.append('category', formData.category);
      formDataPayload.append('documentName', formData.documentName);
      formDataPayload.append('description', formData.description);
      formDataPayload.append('dueDate', formData.dueDate);
      formDataPayload.append('priority', formData.priority);
      formDataPayload.append('folderId', selectedFolderId);
      if (formData.assigneeId) {
        formDataPayload.append('assigneeId', formData.assigneeId);
      }
      if (formData.externalAssigneeId) {
        formDataPayload.append('externalAssigneeId', formData.externalAssigneeId);
      }
      selectedFiles.forEach(file => {
        formDataPayload.append('files', file);
      });
      
      createWithFilesMutation.mutate(formDataPayload);
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
      if (filterAssignee.startsWith("deal:") && item.externalAssigneeId !== filterAssignee.replace("deal:", "")) return false;
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

  const getAssigneeSelectValue = (): string => {
    if (formData.assigneeId) {
      return `internal:${formData.assigneeId}`;
    }
    if (formData.externalAssigneeId) {
      // Check if it's a deal member or external user
      if (teamMembers?.dealMembers?.some(m => m.id === formData.externalAssigneeId)) {
        return `deal:${formData.externalAssigneeId}`;
      }
      return `external:${formData.externalAssigneeId}`;
    }
    return "unassigned";
  };

  const getAssigneeName = (item: DataRequestItem) => {
    if (item.assigneeId && teamMembers?.internal) {
      const assignee = teamMembers.internal.find(u => u.id === item.assigneeId);
      return assignee?.name || 'Unknown';
    }
    if (item.externalAssigneeId) {
      // Check deal members first
      if (teamMembers?.dealMembers) {
        const dealMember = teamMembers.dealMembers.find(u => u.id === item.externalAssigneeId);
        if (dealMember) {
          return dealMember.role ? `${dealMember.name} (${dealMember.role})` : dealMember.name;
        }
      }
      // Then check external users
      if (teamMembers?.external) {
        const assignee = teamMembers.external.find(u => u.id === item.externalAssigneeId);
        if (assignee) {
          return `${assignee.name} (${assignee.role || 'External'})`;
        }
      }
      return 'Unknown';
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
                      <Label htmlFor="dueDate">Due Date *</Label>
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
                    <Label htmlFor="priority">Priority *</Label>
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
                    <div className="flex items-center justify-between mb-1">
                      <Label htmlFor="assignee">Assignee *</Label>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-xs text-blue-600 hover:text-blue-700"
                        onClick={() => setIsAddMemberDialogOpen(true)}
                        data-testid="button-add-deal-member"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add New Deal Member
                      </Button>
                    </div>
                    <Select 
                      value={getAssigneeSelectValue()} 
                      onValueChange={(value) => {
                        if (value === "unassigned") {
                          setFormData({ ...formData, assigneeId: "", externalAssigneeId: "" });
                        } else if (value.startsWith("internal:")) {
                          setFormData({ ...formData, assigneeId: value.replace("internal:", ""), externalAssigneeId: "" });
                        } else if (value.startsWith("external:") || value.startsWith("deal:")) {
                          setFormData({ ...formData, assigneeId: "", externalAssigneeId: value.replace("external:", "").replace("deal:", "") });
                        }
                      }}
                    >
                      <SelectTrigger data-testid="select-assignee">
                        <SelectValue placeholder="Select assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {teamMembers?.internal && teamMembers.internal.length > 0 && (
                          <SelectGroup>
                            <SelectLabel>Internal Team</SelectLabel>
                            {teamMembers.internal.map(member => (
                              <SelectItem key={member.id} value={`internal:${member.id}`}>
                                {member.name} ({member.email})
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                        {teamMembers?.dealMembers && teamMembers.dealMembers.length > 0 && (
                          <SelectGroup>
                            <SelectLabel>Deal Team Members</SelectLabel>
                            {teamMembers.dealMembers.map(member => (
                              <SelectItem key={member.id} value={`deal:${member.id}`}>
                                {member.name} {member.role ? `- ${member.role}` : ''} {member.email ? `(${member.email})` : ''}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                        {teamMembers?.external && teamMembers.external.length > 0 && (
                          <SelectGroup>
                            <SelectLabel>External Users</SelectLabel>
                            {teamMembers.external.map(member => (
                              <SelectItem key={member.id} value={`external:${member.id}`}>
                                {member.name} - {member.role || 'External'} ({member.email})
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {!editingItem && (
                    <div className="border-t pt-4 mt-4">
                      <Label className="text-base font-medium">Attach Files</Label>
                      <p className="text-sm text-gray-500 mb-3">Upload documents directly to the VDR when creating this request</p>
                      
                      {selectedFiles.length > 0 && (
                        <div className="mb-3">
                          <Label htmlFor="destinationFolder">Destination Folder *</Label>
                          <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
                            <SelectTrigger data-testid="select-destination-folder">
                              <SelectValue placeholder="Select folder for uploaded files" />
                            </SelectTrigger>
                            <SelectContent>
                              {vdrFolders.length === 0 ? (
                                <SelectItem value="no-folders" disabled>No folders available</SelectItem>
                              ) : (
                                vdrFolders.map(folder => (
                                  <SelectItem key={folder.id} value={folder.id}>
                                    <div className="flex items-center gap-2">
                                      <FolderOpen className="w-4 h-4 text-gray-500" />
                                      {folder.name}
                                    </div>
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div 
                        className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-500 cursor-pointer transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                        data-testid="file-drop-zone"
                      >
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileSelect}
                          multiple
                          className="hidden"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg"
                          data-testid="input-file-upload"
                        />
                        <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-600">Click to browse or drag and drop files</p>
                        <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, CSV, Images (max 10MB each)</p>
                      </div>

                      {selectedFiles.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <Label className="text-sm">Selected Files ({selectedFiles.length})</Label>
                          {selectedFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                              <div className="flex items-center gap-2 truncate">
                                <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                <span className="text-sm truncate">{file.name}</span>
                                <span className="text-xs text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFile(index)}
                                className="h-6 w-6 p-0"
                                data-testid={`button-remove-file-${index}`}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} data-testid="button-cancel">Cancel</Button>
                  <Button 
                    onClick={handleSubmit} 
                    disabled={createMutation.isPending || updateMutation.isPending || createWithFilesMutation.isPending || isUploadingFiles} 
                    data-testid="button-submit"
                  >
                    {isUploadingFiles ? (
                      <>
                        <Upload className="w-4 h-4 mr-2 animate-pulse" />
                        Uploading...
                      </>
                    ) : (
                      editingItem ? 'Update' : 'Add'
                    )} {!isUploadingFiles && 'Request'}
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
                    <SelectGroup>
                      <SelectLabel>Internal Team</SelectLabel>
                      {teamMembers.internal.map(member => (
                        <SelectItem key={member.id} value={`internal:${member.id}`}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {teamMembers?.dealMembers && teamMembers.dealMembers.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Deal Team Members</SelectLabel>
                      {teamMembers.dealMembers.map(member => (
                        <SelectItem key={member.id} value={`deal:${member.id}`}>
                          {member.name} {member.role ? `(${member.role})` : ''}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {teamMembers?.external && teamMembers.external.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>External Users</SelectLabel>
                      {teamMembers.external.map(member => (
                        <SelectItem key={member.id} value={`external:${member.id}`}>
                          {member.name} ({member.role})
                        </SelectItem>
                      ))}
                    </SelectGroup>
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
                          } else if (value.startsWith("external:") || value.startsWith("deal:")) {
                            bulkUpdateMutation.mutate({ assigneeId: null, externalAssigneeId: value.replace("external:", "").replace("deal:", "") });
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select assignee" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {teamMembers?.internal && teamMembers.internal.length > 0 && (
                            <SelectGroup>
                              <SelectLabel>Internal Team</SelectLabel>
                              {teamMembers.internal.map(member => (
                                <SelectItem key={member.id} value={`internal:${member.id}`}>
                                  {member.name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          )}
                          {teamMembers?.dealMembers && teamMembers.dealMembers.length > 0 && (
                            <SelectGroup>
                              <SelectLabel>Deal Team Members</SelectLabel>
                              {teamMembers.dealMembers.map(member => (
                                <SelectItem key={member.id} value={`deal:${member.id}`}>
                                  {member.name} {member.role ? `(${member.role})` : ''}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          )}
                          {teamMembers?.external && teamMembers.external.length > 0 && (
                            <SelectGroup>
                              <SelectLabel>External Users</SelectLabel>
                              {teamMembers.external.map(member => (
                                <SelectItem key={member.id} value={`external:${member.id}`}>
                                  {member.name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
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

      {/* Add New Deal Member Dialog */}
      <Dialog open={isAddMemberDialogOpen} onOpenChange={(open) => {
        setIsAddMemberDialogOpen(open);
        if (!open) dealMemberForm.reset();
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Deal Team Member</DialogTitle>
            <DialogDescription>
              Add a new person to the deal team. They will also be added to your CRM as a pending contact for review.
            </DialogDescription>
          </DialogHeader>
          <Form {...dealMemberForm}>
            <form onSubmit={dealMemberForm.handleSubmit((data) => addDealMemberMutation.mutate(data))} className="space-y-4">
              <FormField
                control={dealMemberForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Full name" data-testid="input-member-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={dealMemberForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="email@example.com" data-testid="input-member-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={dealMemberForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="(555) 555-5555" data-testid="input-member-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={dealMemberForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role / Title</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Seller's Attorney, Environmental Consultant" data-testid="input-member-role" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => {
                    setIsAddMemberDialogOpen(false);
                    dealMemberForm.reset();
                  }}
                  data-testid="button-cancel-member"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={addDealMemberMutation.isPending}
                  data-testid="button-save-member"
                >
                  {addDealMemberMutation.isPending ? "Adding..." : "Add Member"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

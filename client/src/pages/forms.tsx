import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, Edit, Copy, Trash, Eye, Settings, BarChart3, ExternalLink,
  FileText, Filter, Search, Download, Share, QrCode, MousePointer,
  TrendingUp, Users, Calendar, MessageSquare, Ship, Anchor, Calculator
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import FormBuilder from "@/components/forms/form-builder";
import FormAnalytics from "@/components/forms/form-analytics";
import FormEmbedModal from "@/components/forms/form-embed-modal";
import type { Form } from "@shared/schema";

const statusColors = {
  'draft': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  'active': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  'paused': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  'archived': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const formTypeColors = {
  'contact': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  'demo_request': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  'newsletter': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
  'property_inquiry': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
  'boat_inquiry': 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300',
  'quote_request': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  'download': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
};

const getFormTypeIcon = (type: string) => {
  const iconMap: Record<string, JSX.Element> = {
    contact: <MessageSquare className="w-4 h-4" />,
    demo_request: <Calendar className="w-4 h-4" />,
    newsletter: <FileText className="w-4 h-4" />,
    property_inquiry: <Anchor className="w-4 h-4" />,
    boat_inquiry: <Ship className="w-4 h-4" />,
    quote_request: <Calculator className="w-4 h-4" />,
    download: <Download className="w-4 h-4" />
  };
  
  return iconMap[type] || <FileText className="w-4 h-4" />;
};

export default function FormsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch forms
  const { data: forms = [], isLoading, error } = useQuery({
    queryKey: ['/api/forms'],
  });

  // Fetch form templates
  const { data: templates = [] } = useQuery({
    queryKey: ['/api/form-templates'],
  });

  // Delete form mutation
  const deleteForm = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/forms/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/forms'] });
      toast({ title: "Form deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error deleting form", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  // Duplicate form mutation
  const duplicateForm = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => 
      apiRequest('POST', `/api/forms/${id}/duplicate`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/forms'] });
      toast({ title: "Form duplicated successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error duplicating form", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  // Update form status mutation
  const updateFormStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => 
      apiRequest('PUT', `/api/forms/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/forms'] });
      toast({ title: "Form status updated successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error updating form status", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  // Filter forms
  const filteredForms = forms.filter((form: Form) => {
    const matchesSearch = form.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         form.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || form.status === statusFilter;
    const matchesType = typeFilter === "all" || form.type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  // Calculate form statistics
  const formStats = {
    total: forms.length,
    active: forms.filter((f: Form) => f.status === 'active').length,
    draft: forms.filter((f: Form) => f.status === 'draft').length,
    totalSubmissions: forms.reduce((sum: number, f: Form) => sum + (f.submissionCount || 0), 0),
    avgConversion: forms.length > 0 
      ? forms.reduce((sum: number, f: Form) => sum + parseFloat(f.conversionRate || '0'), 0) / forms.length 
      : 0
  };

  const handleCreateForm = (template?: any) => {
    setSelectedForm(template ? { ...template, id: null } : null);
    setShowFormBuilder(true);
  };

  const handleEditForm = (form: Form) => {
    setSelectedForm(form);
    setShowFormBuilder(true);
  };

  const handleViewAnalytics = (form: Form) => {
    setSelectedForm(form);
    setShowAnalytics(true);
  };

  const handleShowEmbed = (form: Form) => {
    setSelectedForm(form);
    setShowEmbedModal(true);
  };

  const handleDeleteForm = (form: Form) => {
    if (confirm(`Are you sure you want to delete "${form.name}"?`)) {
      deleteForm.mutate(form.id);
    }
  };

  const handleDuplicateForm = (form: Form) => {
    const newName = `${form.name} (Copy)`;
    duplicateForm.mutate({ id: form.id, name: newName });
  };

  const handleToggleStatus = (form: Form) => {
    const newStatus = form.status === 'active' ? 'paused' : 'active';
    updateFormStatus.mutate({ id: form.id, status: newStatus });
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-red-600">Error loading forms: {error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b bg-white dark:bg-gray-900">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Forms</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Create and manage lead capture forms for your marina business
          </p>
        </div>
        <div className="flex gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button data-testid="button-create-form" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Create Form
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => handleCreateForm()}>
                <FileText className="w-4 h-4 mr-2" />
                Blank Form
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {templates.map((template: any) => (
                <DropdownMenuItem key={template.id} onClick={() => handleCreateForm(template)}>
                  {getFormTypeIcon(template.type)}
                  <span className="ml-2">{template.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 p-6 bg-gray-50 dark:bg-gray-800/50">
        <Card data-testid="card-total-forms">
          <CardContent className="flex items-center p-6">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Forms</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formStats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-active-forms">
          <CardContent className="flex items-center p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Forms</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formStats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-draft-forms">
          <CardContent className="flex items-center p-6">
            <div className="flex items-center">
              <Edit className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Draft Forms</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formStats.draft}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-total-submissions">
          <CardContent className="flex items-center p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Submissions</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formStats.totalSubmissions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-avg-conversion">
          <CardContent className="flex items-center p-6">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-cyan-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg. Conversion</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formStats.avgConversion.toFixed(2)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 p-6 border-b bg-white dark:bg-gray-900">
        <div className="flex-1">
          <Input
            data-testid="input-search"
            placeholder="Search forms..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger data-testid="select-status-filter" className="w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger data-testid="select-type-filter" className="w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="contact">Contact</SelectItem>
            <SelectItem value="demo_request">Demo Request</SelectItem>
            <SelectItem value="newsletter">Newsletter</SelectItem>
            <SelectItem value="property_inquiry">Property Inquiry</SelectItem>
            <SelectItem value="boat_inquiry">Boat Inquiry</SelectItem>
            <SelectItem value="quote_request">Quote Request</SelectItem>
            <SelectItem value="download">Download</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Forms List */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} data-testid={`skeleton-form-${i}`} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
                  <div className="flex gap-2">
                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-8"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredForms.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No forms found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {searchTerm || statusFilter !== "all" || typeFilter !== "all"
                ? "Try adjusting your search or filters"
                : "Get started by creating your first form"}
            </p>
            {!searchTerm && statusFilter === "all" && typeFilter === "all" && (
              <div className="mt-6">
                <Button onClick={() => handleCreateForm()} data-testid="button-create-first-form">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Form
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredForms.map((form: Form) => (
              <Card key={form.id} data-testid={`card-form-${form.id}`} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg font-semibold truncate">{form.name}</CardTitle>
                      <CardDescription className="mt-1 text-sm">
                        {form.description || 'No description'}
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button data-testid={`button-form-menu-${form.id}`} variant="ghost" size="sm">
                          <Settings className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditForm(form)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleViewAnalytics(form)}>
                          <BarChart3 className="w-4 h-4 mr-2" />
                          Analytics
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleShowEmbed(form)}>
                          <Share className="w-4 h-4 mr-2" />
                          Embed & Share
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicateForm(form)}>
                          <Copy className="w-4 h-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleStatus(form)}>
                          {form.status === 'active' ? (
                            <>
                              <Eye className="w-4 h-4 mr-2" />
                              Pause
                            </>
                          ) : (
                            <>
                              <TrendingUp className="w-4 h-4 mr-2" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleDeleteForm(form)}
                          className="text-red-600 dark:text-red-400"
                        >
                          <Trash className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge data-testid={`badge-status-${form.id}`} className={statusColors[form.status as keyof typeof statusColors]}>
                        {form.status}
                      </Badge>
                      <Badge data-testid={`badge-type-${form.id}`} variant="outline" className={formTypeColors[form.type as keyof typeof formTypeColors]}>
                        <span className="mr-1">{getFormTypeIcon(form.type)}</span>
                        {form.type.replace('_', ' ')}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Submissions</p>
                        <p data-testid={`text-submissions-${form.id}`} className="font-semibold text-gray-900 dark:text-white">
                          {form.submissionCount || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Conversion</p>
                        <p data-testid={`text-conversion-${form.id}`} className="font-semibold text-gray-900 dark:text-white">
                          {form.conversionRate || '0'}%
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        data-testid={`button-edit-${form.id}`}
                        size="sm"
                        onClick={() => handleEditForm(form)}
                        className="flex-1"
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        data-testid={`button-analytics-${form.id}`}
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewAnalytics(form)}
                      >
                        <BarChart3 className="w-4 h-4" />
                      </Button>
                      <Button
                        data-testid={`button-share-${form.id}`}
                        size="sm"
                        variant="outline"
                        onClick={() => handleShowEmbed(form)}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Form Builder Modal */}
      <Dialog open={showFormBuilder} onOpenChange={setShowFormBuilder}>
        <DialogContent className="max-w-7xl w-full max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {selectedForm?.id ? `Edit Form: ${selectedForm.name}` : 'Create New Form'}
            </DialogTitle>
            <DialogDescription>
              Design your form with drag-and-drop fields and customize settings.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <FormBuilder
              form={selectedForm}
              onSave={() => {
                setShowFormBuilder(false);
                queryClient.invalidateQueries({ queryKey: ['/api/forms'] });
              }}
              onCancel={() => setShowFormBuilder(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Analytics Modal */}
      <Dialog open={showAnalytics} onOpenChange={setShowAnalytics}>
        <DialogContent className="max-w-6xl w-full max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Form Analytics: {selectedForm?.name}</DialogTitle>
            <DialogDescription>
              View detailed performance metrics and insights for this form.
            </DialogDescription>
          </DialogHeader>
          {selectedForm && (
            <FormAnalytics
              form={selectedForm}
              onClose={() => setShowAnalytics(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Embed Modal */}
      {selectedForm && (
        <FormEmbedModal
          open={showEmbedModal}
          onOpenChange={setShowEmbedModal}
          form={selectedForm}
        />
      )}
    </div>
  );
}


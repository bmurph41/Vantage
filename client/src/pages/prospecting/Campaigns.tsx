import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Send, Plus, Search, Mail, Phone, FileText, 
  MoreVertical, Play, Pause, Copy, Edit, Trash2,
  Clock, Users, TrendingUp, CheckCircle, Loader2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import type { OutreachCampaign, OutreachTemplate } from "@shared/schema";

export default function Campaigns() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('campaigns');
  const { toast } = useToast();

  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<OutreachCampaign | null>(null);
  const [campaignForm, setCampaignForm] = useState({ name: '', type: 'email' as string, description: '', targetCount: 0, startDate: '' });

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<OutreachTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: '', type: 'email' as string, category: '', subject: '', content: '' });

  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery<OutreachCampaign[]>({
    queryKey: ['/api/prospecting/campaigns'],
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<OutreachTemplate[]>({
    queryKey: ['/api/prospecting/templates'],
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/prospecting/campaigns', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prospecting/campaigns'] });
      setCampaignDialogOpen(false);
      toast({ title: "Campaign created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create campaign", description: error.message, variant: "destructive" });
    },
  });

  const updateCampaignMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest('PUT', `/api/prospecting/campaigns/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prospecting/campaigns'] });
      setCampaignDialogOpen(false);
      setEditingCampaign(null);
      toast({ title: "Campaign updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update campaign", description: error.message, variant: "destructive" });
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/prospecting/campaigns/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prospecting/campaigns'] });
      toast({ title: "Campaign deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete campaign", description: error.message, variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest('PATCH', `/api/prospecting/campaigns/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prospecting/campaigns'] });
      toast({ title: "Campaign status updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update status", description: error.message, variant: "destructive" });
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/prospecting/templates', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prospecting/templates'] });
      setTemplateDialogOpen(false);
      toast({ title: "Template created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create template", description: error.message, variant: "destructive" });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest('PUT', `/api/prospecting/templates/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prospecting/templates'] });
      setTemplateDialogOpen(false);
      setEditingTemplate(null);
      toast({ title: "Template updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update template", description: error.message, variant: "destructive" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/prospecting/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prospecting/templates'] });
      toast({ title: "Template deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete template", description: error.message, variant: "destructive" });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'paused': return 'bg-yellow-100 text-yellow-700';
      case 'completed': return 'bg-blue-100 text-blue-700';
      case 'draft': return 'bg-gray-100 text-gray-700';
      case 'archived': return 'bg-gray-100 text-gray-500';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="w-4 h-4" />;
      case 'call': case 'call_script': return <Phone className="w-4 h-4" />;
      case 'mixed': return <Send className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const filteredCampaigns = campaigns.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.category || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const totalTargets = campaigns.reduce((sum, c) => sum + (c.targetCount || 0), 0);
  const totalSent = campaigns.reduce((sum, c) => sum + (c.sentCount || 0), 0);
  const totalOpened = campaigns.reduce((sum, c) => sum + (c.openedCount || 0), 0);
  const totalReplied = campaigns.reduce((sum, c) => sum + (c.repliedCount || 0), 0);
  const avgOpenRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;

  const openCampaignDialog = (campaign?: OutreachCampaign) => {
    if (campaign) {
      setEditingCampaign(campaign);
      setCampaignForm({
        name: campaign.name,
        type: campaign.type,
        description: campaign.description || '',
        targetCount: campaign.targetCount || 0,
        startDate: campaign.startDate || '',
      });
    } else {
      setEditingCampaign(null);
      setCampaignForm({ name: '', type: 'email', description: '', targetCount: 0, startDate: '' });
    }
    setCampaignDialogOpen(true);
  };

  const openTemplateDialog = (template?: OutreachTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateForm({
        name: template.name,
        type: template.type,
        category: template.category || '',
        subject: template.subject || '',
        content: template.content,
      });
    } else {
      setEditingTemplate(null);
      setTemplateForm({ name: '', type: 'email', category: '', subject: '', content: '' });
    }
    setTemplateDialogOpen(true);
  };

  const handleCampaignSubmit = () => {
    const data = { ...campaignForm, targetCount: Number(campaignForm.targetCount) };
    if (editingCampaign) {
      updateCampaignMutation.mutate({ id: editingCampaign.id, data });
    } else {
      createCampaignMutation.mutate(data);
    }
  };

  const handleTemplateSubmit = () => {
    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data: templateForm });
    } else {
      createTemplateMutation.mutate(templateForm);
    }
  };

  const handleDuplicateCampaign = (campaign: OutreachCampaign) => {
    createCampaignMutation.mutate({
      name: `${campaign.name} (Copy)`,
      type: campaign.type,
      description: campaign.description || '',
      targetCount: campaign.targetCount || 0,
      startDate: '',
    });
  };

  const handleDuplicateTemplate = (template: OutreachTemplate) => {
    createTemplateMutation.mutate({
      name: `${template.name} (Copy)`,
      type: template.type,
      category: template.category || '',
      subject: template.subject || '',
      content: template.content,
    });
  };

  return (
    <div className="flex-1 overflow-auto p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">Campaigns & Templates</h1>
            <p className="text-gray-500 mt-1">Manage your outreach campaigns and message templates</p>
          </div>
          <Button
            data-testid="button-create-new"
            onClick={() => activeTab === 'campaigns' ? openCampaignDialog() : openTemplateDialog()}
          >
            <Plus className="w-4 h-4 mr-2" />
            {activeTab === 'campaigns' ? 'New Campaign' : 'New Template'}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="bg-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Active Campaigns</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {campaignsLoading ? <Skeleton className="h-8 w-8" /> : activeCampaigns}
                      </p>
                    </div>
                    <Play className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Total Targets</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {campaignsLoading ? <Skeleton className="h-8 w-12" /> : totalTargets}
                      </p>
                    </div>
                    <Users className="w-8 h-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Avg Open Rate</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {campaignsLoading ? <Skeleton className="h-8 w-10" /> : `${avgOpenRate}%`}
                      </p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Total Replies</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {campaignsLoading ? <Skeleton className="h-8 w-8" /> : totalReplied}
                      </p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white mb-4">
              <CardContent className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search campaigns..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-campaigns"
                  />
                </div>
              </CardContent>
            </Card>

            {campaignsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="bg-white">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <Skeleton className="w-10 h-10 rounded-full" />
                          <div>
                            <Skeleton className="h-5 w-48 mb-2" />
                            <Skeleton className="h-4 w-32" />
                          </div>
                        </div>
                        <div className="flex items-center space-x-6">
                          <Skeleton className="h-8 w-16" />
                          <Skeleton className="h-8 w-16" />
                          <Skeleton className="h-8 w-16" />
                          <Skeleton className="h-6 w-20" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredCampaigns.length === 0 ? (
              <Card className="bg-white">
                <CardContent className="p-12 text-center">
                  <Send className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {searchQuery ? 'No campaigns found' : 'No campaigns yet'}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {searchQuery ? 'Try a different search term' : 'Create your first outreach campaign to get started'}
                  </p>
                  {!searchQuery && (
                    <Button onClick={() => openCampaignDialog()}>
                      <Plus className="w-4 h-4 mr-2" /> New Campaign
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredCampaigns.map((campaign) => (
                  <Card key={campaign.id} className="bg-white" data-testid={`campaign-card-${campaign.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            campaign.type === 'email' ? 'bg-blue-100' : 
                            campaign.type === 'call' ? 'bg-green-100' : 'bg-purple-100'
                          }`}>
                            {getTypeIcon(campaign.type)}
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{campaign.name}</h3>
                            <p className="text-sm text-gray-500">
                              {campaign.startDate ? `Started ${campaign.startDate}` : 'Not started'}
                              {campaign.endDate && ` • Ended ${campaign.endDate}`}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-6">
                          <div className="text-center">
                            <p className="text-lg font-semibold text-gray-900">{campaign.targetCount || 0}</p>
                            <p className="text-xs text-gray-500">Targets</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-semibold text-gray-900">{campaign.sentCount || 0}</p>
                            <p className="text-xs text-gray-500">Sent</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-semibold text-gray-900">{campaign.openedCount || 0}</p>
                            <p className="text-xs text-gray-500">Opened</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-semibold text-gray-900">{campaign.repliedCount || 0}</p>
                            <p className="text-xs text-gray-500">Replied</p>
                          </div>
                          
                          <Badge className={getStatusColor(campaign.status)}>
                            {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                          </Badge>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openCampaignDialog(campaign)}>
                                <Edit className="w-4 h-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                const newStatus = campaign.status === 'active' ? 'paused' : 'active';
                                statusMutation.mutate({ id: campaign.id, status: newStatus });
                              }}>
                                {campaign.status === 'active' ? (
                                  <><Pause className="w-4 h-4 mr-2" /> Pause</>
                                ) : (
                                  <><Play className="w-4 h-4 mr-2" /> Resume</>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDuplicateCampaign(campaign)}>
                                <Copy className="w-4 h-4 mr-2" /> Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => deleteCampaignMutation.mutate(campaign.id)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="templates" className="mt-4">
            <Card className="bg-white mb-4">
              <CardContent className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search templates..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-templates"
                  />
                </div>
              </CardContent>
            </Card>

            {templatesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="bg-white">
                    <CardContent className="p-4">
                      <Skeleton className="w-10 h-10 rounded-full mb-3" />
                      <Skeleton className="h-5 w-36 mb-2" />
                      <Skeleton className="h-5 w-20 mb-3" />
                      <Skeleton className="h-4 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredTemplates.length === 0 ? (
              <Card className="bg-white">
                <CardContent className="p-12 text-center">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {searchQuery ? 'No templates found' : 'No templates yet'}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {searchQuery ? 'Try a different search term' : 'Create your first outreach template to get started'}
                  </p>
                  {!searchQuery && (
                    <Button onClick={() => openTemplateDialog()}>
                      <Plus className="w-4 h-4 mr-2" /> New Template
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map((template) => (
                  <Card key={template.id} className="bg-white hover:shadow-lg transition-shadow" data-testid={`template-card-${template.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          template.type === 'email' ? 'bg-blue-100' : 'bg-green-100'
                        }`}>
                          {getTypeIcon(template.type)}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openTemplateDialog(template)}>
                              <Edit className="w-4 h-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicateTemplate(template)}>
                              <Copy className="w-4 h-4 mr-2" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => deleteTemplateMutation.mutate(template.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      <h3 className="font-semibold text-gray-900 mb-1">{template.name}</h3>
                      {template.category && <Badge variant="secondary" className="mb-3">{template.category}</Badge>}
                      
                      <div className="flex items-center justify-between text-sm text-gray-500 pt-3 border-t">
                        <span>Used {template.usageCount || 0} times</span>
                        {template.lastUsedAt && <span>Last: {new Date(template.lastUsedAt).toLocaleDateString()}</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={campaignDialogOpen} onOpenChange={setCampaignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCampaign ? 'Edit Campaign' : 'New Campaign'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="campaign-name">Name</Label>
              <Input
                id="campaign-name"
                value={campaignForm.name}
                onChange={(e) => setCampaignForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Campaign name"
              />
            </div>
            <div>
              <Label htmlFor="campaign-type">Type</Label>
              <Select value={campaignForm.type} onValueChange={(v) => setCampaignForm(prev => ({ ...prev, type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="campaign-description">Description</Label>
              <Textarea
                id="campaign-description"
                value={campaignForm.description}
                onChange={(e) => setCampaignForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Campaign description"
              />
            </div>
            <div>
              <Label htmlFor="campaign-targets">Target Count</Label>
              <Input
                id="campaign-targets"
                type="number"
                value={campaignForm.targetCount}
                onChange={(e) => setCampaignForm(prev => ({ ...prev, targetCount: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <Label htmlFor="campaign-start">Start Date</Label>
              <Input
                id="campaign-start"
                type="date"
                value={campaignForm.startDate}
                onChange={(e) => setCampaignForm(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCampaignDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCampaignSubmit}
              disabled={!campaignForm.name || createCampaignMutation.isPending || updateCampaignMutation.isPending}
            >
              {(createCampaignMutation.isPending || updateCampaignMutation.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingCampaign ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'New Template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                value={templateForm.name}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Template name"
              />
            </div>
            <div>
              <Label htmlFor="template-type">Type</Label>
              <Select value={templateForm.type} onValueChange={(v) => setTemplateForm(prev => ({ ...prev, type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="call_script">Call Script</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="template-category">Category</Label>
              <Input
                id="template-category"
                value={templateForm.category}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, category: e.target.value }))}
                placeholder="e.g., Cold Outreach, Follow-up, Nurture"
              />
            </div>
            {templateForm.type === 'email' && (
              <div>
                <Label htmlFor="template-subject">Subject</Label>
                <Input
                  id="template-subject"
                  value={templateForm.subject}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Email subject line"
                />
              </div>
            )}
            <div>
              <Label htmlFor="template-content">Content</Label>
              <Textarea
                id="template-content"
                value={templateForm.content}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Template content..."
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleTemplateSubmit}
              disabled={!templateForm.name || !templateForm.content || createTemplateMutation.isPending || updateTemplateMutation.isPending}
            >
              {(createTemplateMutation.isPending || updateTemplateMutation.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingTemplate ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

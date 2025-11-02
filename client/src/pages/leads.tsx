import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, UserPlus, Search, Star, Edit, Globe, Mail, Phone, ArrowUpRight, TrendingUp, Users, Eye, MousePointer, Flame, Thermometer, Snowflake, Trash2, ArrowRightCircle } from "lucide-react";
import { websocketManager } from "@/lib/websocket";
import { useToast } from "@/hooks/use-toast";
import { SiGoogle, SiGoogleads, SiFacebook, SiLinkedin, SiX } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import LeadFormModal from "@/components/modals/lead-form-modal";
import CompanyFormModal from "@/components/modals/company-form-modal";
import ContactFormModal from "@/components/modals/contact-form-modal";
import LeadDetailModal from "@/components/modals/lead-detail-modal";
import { LeadConversionModal } from "@/components/lead-conversion-modal";
import type { Lead, Company, Contact } from "@shared/schema";

const statusColors = {
  'new': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  'contacted': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  'qualified': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  'proposal': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  'negotiation': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  'closed_won': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  'closed_lost': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

// Source icon mapping
const getSourceIcon = (source: string) => {
  const iconMap: Record<string, JSX.Element> = {
    google_ads: <SiGoogleads className="w-4 h-4" />,
    google: <SiGoogle className="w-4 h-4" />,
    facebook_ads: <SiFacebook className="w-4 h-4" />,
    facebook: <SiFacebook className="w-4 h-4" />,
    linkedin: <SiLinkedin className="w-4 h-4" />,
    twitter: <SiX className="w-4 h-4" />,
    email: <Mail className="w-4 h-4" />,
    direct: <Globe className="w-4 h-4" />,
    referral: <ArrowUpRight className="w-4 h-4" />,
    organic_search: <Search className="w-4 h-4" />,
    phone: <Phone className="w-4 h-4" />,
    social: <Users className="w-4 h-4" />,
    website_form: <MousePointer className="w-4 h-4" />,
    unknown: <Eye className="w-4 h-4" />
  };
  
  return iconMap[source] || iconMap.unknown;
};

// Source color mapping
const getSourceColor = (source: string) => {
  const colorMap: Record<string, string> = {
    google_ads: "#4285F4",
    google: "#4285F4", 
    facebook_ads: "#1877F2",
    facebook: "#1877F2",
    linkedin: "#0A66C2",
    twitter: "#1DA1F2",
    email: "#EA4335",
    direct: "#34A853",
    referral: "#FBBC05",
    organic_search: "#9AA0A6",
    phone: "#FF6D01",
    social: "#8E24AA",
    website_form: "#00ACC1",
    unknown: "#6B7280"
  };
  
  return colorMap[source] || colorMap.unknown;
};

export default function LeadsPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [isConversionModalOpen, setIsConversionModalOpen] = useState(false);
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const queryClient = useQueryClient();

  // Fetch leads
  const { data: leads = [], isLoading, error } = useQuery<(Lead & { account?: any; campaign?: any })[]>({
    queryKey: ['/api/leads'],
  });

  // Fetch companies for editing
  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
  });

  // Fetch contacts for editing
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
  });

  // Update lead score mutation
  const updateScoreMutation = useMutation({
    mutationFn: async ({ id, score }: { id: string; score: number }) => {
      return await apiRequest('PUT', `/api/leads/${id}/score`, { score });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
    },
  });

  // Real-time WebSocket subscription for scoring updates
  useEffect(() => {
    const handleScoreUpdate = (data: any) => {
      toast({
        title: 'Lead Score Updated',
        description: `${data.leadId}: Score changed by ${data.scoreChange > 0 ? '+' : ''}${data.scoreChange} points (${data.temperature})`,
        duration: 4000,
      });
      
      // Refresh leads data
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
    };

    const handleMarinaDataUpdate = (data: any) => {
      toast({
        title: 'Marina Data Updated',
        description: `Lead updated - new score: ${data.newScore} (${data.temperature})`,
        duration: 4000,
      });
      
      // Refresh leads data
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
    };

    const handleGeneralUpdates = (data: any) => {
      // Refresh leads data for general lead updates
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
    };

    // Subscribe to WebSocket events using the WebSocketManager
    const unsubscribeScoreUpdate = websocketManager.subscribe('lead_score_updated', handleScoreUpdate);
    const unsubscribeMarinaUpdate = websocketManager.subscribe('marina_data_updated', handleMarinaDataUpdate);
    const unsubscribeLeadUpdate = websocketManager.subscribe('lead_updated', handleGeneralUpdates);
    const unsubscribeLeadCreate = websocketManager.subscribe('lead_created', handleGeneralUpdates);

    // Cleanup on unmount
    return () => {
      unsubscribeScoreUpdate();
      unsubscribeMarinaUpdate();
      unsubscribeLeadUpdate();
      unsubscribeLeadCreate();
    };
  }, [queryClient, toast]);

  const openCreateModal = () => {
    setSelectedLead(null);
    setIsLeadModalOpen(true);
  };

  const openEditModal = (lead: Lead) => {
    setSelectedLead(lead);
    setIsLeadModalOpen(true);
  };

  const handleCompanyCreated = (companyId: string) => {
    setEditingCompanyId(companyId);
    setIsCompanyModalOpen(true);
  };

  const handleContactCreated = (contactId: string) => {
    setEditingContactId(contactId);
    setIsContactModalOpen(true);
  };

  const openDetailModal = (lead: Lead) => {
    setDetailLead(lead);
    setIsDetailModalOpen(true);
  };

  const openEditFromDetail = () => {
    if (detailLead) {
      setSelectedLead(detailLead);
      setIsDetailModalOpen(false);
      setIsLeadModalOpen(true);
    }
  };

  // Delete lead mutation
  const deleteLeadMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/leads/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      toast({ title: "Lead deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to delete lead", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleDelete = (lead: Lead) => {
    if (confirm(`Are you sure you want to delete "${lead.firstName} ${lead.lastName}"? This action cannot be undone.`)) {
      deleteLeadMutation.mutate(lead.id);
    }
  };

  const handleConvert = (lead: Lead) => {
    setConvertingLead(lead);
    setIsConversionModalOpen(true);
  };

  // Filter leads based on search and status
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = !searchTerm || 
      `${lead.firstName} ${lead.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.company?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || lead.leadStatus === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Get lead counts by status
  const leadCounts = leads.reduce((acc, lead) => {
    acc[lead.leadStatus] = (acc[lead.leadStatus] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Error loading leads</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      {/* Clean Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-semibold text-gray-900" data-testid="leads-title">Leads</h1>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">{leads.length} leads</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input 
                placeholder="Search leads" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64 h-9 text-sm border-gray-300 focus:border-gray-400"
                data-testid="search-leads"
              />
            </div>
            
            {/* Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 h-9 text-sm" data-testid="filter-status">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="proposal">Proposal</SelectItem>
                <SelectItem value="negotiation">Negotiation</SelectItem>
                <SelectItem value="closed_won">Closed Won</SelectItem>
                <SelectItem value="closed_lost">Closed Lost</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Add Lead Button */}
            <Button 
              className="bg-blue-600 hover:bg-blue-700 h-9 text-sm" 
              size="sm" 
              onClick={openCreateModal}
              data-testid="add-lead-button"
            >
              <Plus className="h-4 w-4 mr-1" />
              Lead
            </Button>
          </div>
        </div>
      </div>

        
      <main className="flex-1 overflow-y-auto p-6" data-testid="leads-main">
        {isLoading ? (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6">
              <div className="animate-pulse space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 py-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/6"></div>
                    </div>
                    <div className="h-6 bg-gray-200 rounded w-20"></div>
                    <div className="h-6 bg-gray-200 rounded w-16"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <UserPlus className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || statusFilter !== 'all' ? 'No leads found' : 'No leads yet'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'Start by adding your first lead to track your sales pipeline.'}
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Button onClick={openCreateModal} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Add First Lead
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Table Header */}
            <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
              <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-600">
                <div className="col-span-3">Name</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Source</div>
                <div className="col-span-1">Type</div>
                <div className="col-span-2">Contact</div>
                <div className="col-span-1">Date</div>
                <div className="col-span-1">Actions</div>
              </div>
            </div>
            
            {/* Table Body */}
            <div className="divide-y divide-gray-200">
              {filteredLeads.map((lead) => {
                return (
                  <div key={lead.id} className="px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer" data-testid={`row-lead-${lead.id}`}>
                    <div className="grid grid-cols-12 gap-4 items-center" onClick={() => openDetailModal(lead)}>
                      {/* Name */}
                      <div className="col-span-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center text-white text-sm font-medium">
                            {lead.firstName[0]}{lead.lastName[0]}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900" data-testid={`text-lead-name-${lead.id}`}>
                              {lead.firstName} {lead.lastName}
                            </div>
                            <div className="text-sm text-gray-500" data-testid={`text-lead-company-${lead.id}`}>
                              {lead.company || 'No company'}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Status */}
                      <div className="col-span-2">
                        <Badge className={statusColors[lead.leadStatus as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'} data-testid={`badge-lead-status-${lead.id}`}>
                          {lead.leadStatus.replace('_', ' ')}
                        </Badge>
                      </div>
                      
                      {/* Source */}
                      <div className="col-span-2">
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs"
                            style={{ backgroundColor: getSourceColor(lead.leadSource || 'unknown') }}
                          >
                            {getSourceIcon(lead.leadSource || 'unknown')}
                          </div>
                          <span className="text-sm text-gray-900 capitalize" data-testid={`text-lead-source-${lead.id}`}>
                            {(lead.leadSource || 'unknown').replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                      
                      {/* Prospect Type */}
                      <div className="col-span-1">
                        <Badge variant="outline" className="capitalize" data-testid={`badge-prospect-status-${lead.id}`}>
                          {(lead.prospectStatus || 'active').replace('_', ' ')}
                        </Badge>
                      </div>
                      
                      {/* Contact */}
                      <div className="col-span-2">
                        <div className="text-sm text-gray-900" data-testid={`text-lead-email-${lead.id}`}>
                          {lead.email}
                        </div>
                        {lead.phone && (
                          <div className="text-sm text-gray-500" data-testid={`text-lead-phone-${lead.id}`}>
                            {lead.phone}
                          </div>
                        )}
                      </div>
                      
                      {/* Date */}
                      <div className="col-span-1">
                        <span className="text-sm text-gray-500" data-testid={`text-lead-date-${lead.id}`}>
                          {new Date(lead.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      
                      {/* Actions */}
                      <div className="col-span-1">
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConvert(lead);
                            }}
                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                            title="Convert to Deal"
                            data-testid={`button-convert-lead-${lead.id}`}
                          >
                            <ArrowRightCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(lead);
                            }}
                            className="h-8 w-8 p-0"
                            data-testid={`button-edit-lead-${lead.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(lead);
                            }}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                            data-testid={`button-delete-lead-${lead.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        
        <LeadFormModal
          isOpen={isLeadModalOpen}
          onClose={() => {
            setIsLeadModalOpen(false);
            setSelectedLead(null);
          }}
          lead={selectedLead}
          onCompanyCreated={handleCompanyCreated}
          onContactCreated={handleContactCreated}
        />

        <CompanyFormModal
          isOpen={isCompanyModalOpen}
          onClose={() => {
            setIsCompanyModalOpen(false);
            setEditingCompanyId(null);
          }}
          company={companies.find(c => c.id === editingCompanyId) || null}
        />

        <ContactFormModal
          isOpen={isContactModalOpen}
          onClose={() => {
            setIsContactModalOpen(false);
            setEditingContactId(null);
          }}
          contact={contacts.find(c => c.id === editingContactId) || null}
        />

        <LeadDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setDetailLead(null);
          }}
          lead={detailLead}
          onEdit={openEditFromDetail}
        />

        <LeadConversionModal
          lead={convertingLead}
          isOpen={isConversionModalOpen}
          onClose={() => {
            setIsConversionModalOpen(false);
            setConvertingLead(null);
          }}
          onSuccess={() => {
            setIsConversionModalOpen(false);
            setConvertingLead(null);
          }}
        />
      </main>
    </div>
  );
}
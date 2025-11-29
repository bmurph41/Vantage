import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Star, Edit, Globe, Mail, Phone, ArrowUpRight, TrendingUp, Users, Eye, MousePointer, Flame, Thermometer, Snowflake, Trash2, ArrowRightCircle } from "lucide-react";
import { websocketManager } from "@/lib/websocket";
import { useToast } from "@/hooks/use-toast";
import { SiGoogle, SiGoogleads, SiFacebook, SiLinkedin, SiX } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import LeadFormModal from "@/components/modals/lead-form-modal";
import LeadDetailModal from "@/components/modals/lead-detail-modal";
import { LeadConversionModal } from "@/components/lead-conversion-modal";
import type { Lead, Company, Contact } from "@shared/schema";

interface LeadsViewProps {
  searchQuery: string;
}

const statusColors: Record<string, string> = {
  'none': 'bg-gray-50 text-gray-500',
  'new': 'bg-blue-100 text-blue-800',
  'contacted': 'bg-yellow-100 text-yellow-800',
  'qualified': 'bg-green-100 text-green-800',
  'unqualified': 'bg-red-100 text-red-800',
  'converted': 'bg-emerald-100 text-emerald-800',
};

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

const getTemperatureIcon = (score: number) => {
  if (score >= 70) return <Flame className="w-4 h-4 text-red-500" />;
  if (score >= 40) return <Thermometer className="w-4 h-4 text-yellow-500" />;
  return <Snowflake className="w-4 h-4 text-blue-500" />;
};

const getTemperatureLabel = (score: number) => {
  if (score >= 70) return "Hot";
  if (score >= 40) return "Warm";
  return "Cold";
};

export default function LeadsView({ searchQuery }: LeadsViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [isConversionModalOpen, setIsConversionModalOpen] = useState(false);
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);

  const { data: leads = [], isLoading } = useQuery<(Lead & { account?: any; campaign?: any })[]>({
    queryKey: ['/api/leads'],
  });

  useEffect(() => {
    const handleScoreUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
    };

    const unsubscribeScoreUpdate = websocketManager.subscribe('lead_score_updated', handleScoreUpdate);
    const unsubscribeMarinaUpdate = websocketManager.subscribe('marina_data_updated', handleScoreUpdate);
    const unsubscribeLeadUpdate = websocketManager.subscribe('lead_updated', handleScoreUpdate);
    const unsubscribeLeadCreate = websocketManager.subscribe('lead_created', handleScoreUpdate);

    return () => {
      unsubscribeScoreUpdate();
      unsubscribeMarinaUpdate();
      unsubscribeLeadUpdate();
      unsubscribeLeadCreate();
    };
  }, [queryClient]);

  const deleteLeadMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/leads/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      toast({ title: "Lead deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete lead", description: error.message, variant: "destructive" });
    },
  });

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = !searchQuery || 
      `${lead.firstName} ${lead.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.company?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleDelete = (lead: Lead) => {
    if (confirm(`Delete "${lead.firstName} ${lead.lastName}"? This cannot be undone.`)) {
      deleteLeadMutation.mutate(lead.id);
    }
  };

  const handleConvert = (lead: Lead) => {
    setConvertingLead(lead);
    setIsConversionModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b bg-white">
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 h-8" data-testid="select-status-filter">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="unqualified">Unqualified</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>{filteredLeads.length} leads</span>
            <span>|</span>
            <span className="flex items-center gap-1">
              <Flame className="w-4 h-4 text-red-500" />
              {filteredLeads.filter(l => Number(l.score) >= 70).length} hot
            </span>
          </div>
        </div>

        <Button 
          size="sm" 
          onClick={() => {
            setSelectedLead(null);
            setIsLeadModalOpen(true);
          }}
          data-testid="button-new-lead"
        >
          <Plus className="w-4 h-4 mr-1" />
          New Lead
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredLeads.map((lead) => {
            const score = Number(lead.score) || 0;
            return (
              <Card 
                key={lead.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => {
                  setDetailLead(lead);
                  setIsDetailModalOpen(true);
                }}
                data-testid={`lead-card-${lead.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                        style={{ backgroundColor: getSourceColor(lead.source || 'unknown') }}
                      >
                        {lead.firstName?.[0]}{lead.lastName?.[0]}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {lead.firstName} {lead.lastName}
                        </h4>
                        {lead.company && (
                          <p className="text-xs text-gray-500">{lead.company}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {getTemperatureIcon(score)}
                      <span className="text-xs font-medium">{score}</span>
                    </div>
                  </div>

                  <div className="space-y-2 mb-3">
                    {lead.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="w-4 h-4" />
                        <span className="truncate">{lead.email}</span>
                      </div>
                    )}
                    {lead.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4" />
                        <span>{lead.phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={statusColors[lead.status || 'none']}>
                        {lead.status || 'New'}
                      </Badge>
                      {lead.source && (
                        <div 
                          className="flex items-center gap-1 text-xs"
                          style={{ color: getSourceColor(lead.source) }}
                        >
                          {getSourceIcon(lead.source)}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          setSelectedLead(lead);
                          setIsLeadModalOpen(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      {lead.status !== 'converted' && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 w-7 p-0 text-green-600"
                          onClick={() => handleConvert(lead)}
                          title="Convert to Deal"
                        >
                          <ArrowRightCircle className="w-4 h-4" />
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 w-7 p-0 text-red-600"
                        onClick={() => handleDelete(lead)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredLeads.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No leads found matching your criteria</p>
          </div>
        )}
      </div>

      <LeadFormModal
        open={isLeadModalOpen}
        onOpenChange={setIsLeadModalOpen}
        lead={selectedLead}
      />

      {detailLead && (
        <LeadDetailModal
          open={isDetailModalOpen}
          onOpenChange={setIsDetailModalOpen}
          lead={detailLead}
          onEdit={() => {
            setSelectedLead(detailLead);
            setIsDetailModalOpen(false);
            setIsLeadModalOpen(true);
          }}
        />
      )}

      {convertingLead && (
        <LeadConversionModal
          open={isConversionModalOpen}
          onOpenChange={setIsConversionModalOpen}
          lead={convertingLead}
        />
      )}
    </div>
  );
}

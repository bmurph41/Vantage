import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Search, Plus, LayoutGrid, List, Users, DollarSign, TrendingUp, 
  Target, Clock, Flame, Filter, Settings2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import DealFormModal from "@/components/modals/deal-form-modal";
import LeadFormModal from "@/components/modals/lead-form-modal";
import type { Deal, Contact, Company, PipelineStage, Lead } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";

const PipelineView = lazy(() => import("@/components/deal-workspace/PipelineView"));
const ListView = lazy(() => import("@/components/deal-workspace/ListView"));
const LeadsView = lazy(() => import("@/components/deal-workspace/LeadsView"));

type DealWithRelations = Deal & { contact?: Contact | null; company?: Company | null };

function KpiCard({ 
  title, 
  value, 
  icon: Icon, 
  color, 
  isLoading 
}: { 
  title: string; 
  value: string | number; 
  icon: React.ElementType; 
  color: string;
  isLoading?: boolean;
}) {
  return (
    <Card className="bg-white border shadow-sm" data-testid={`kpi-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500">{title}</p>
            {isLoading ? (
              <Skeleton className="h-7 w-20 mt-1" />
            ) : (
              <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
            )}
          </div>
          <div className={`w-10 h-10 ${color} rounded-full flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ViewLoader() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-500 text-sm">Loading view...</p>
      </div>
    </div>
  );
}

export default function DealWorkspace() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const initialView = urlParams.get('view') || 'pipeline';
  
  const [activeView, setActiveView] = useState<'pipeline' | 'list' | 'leads'>(
    initialView as 'pipeline' | 'list' | 'leads'
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isDealFormOpen, setIsDealFormOpen] = useState(false);
  const [isLeadFormOpen, setIsLeadFormOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);

  useEffect(() => {
    const newUrl = `/deal-workspace?view=${activeView}`;
    if (location !== newUrl) {
      window.history.replaceState(null, '', newUrl);
    }
  }, [activeView]);

  const { data: deals = [], isLoading: dealsLoading } = useQuery<DealWithRelations[]>({
    queryKey: ['/api/deals'],
  });

  const { data: leads = [], isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ['/api/leads'],
  });

  const { data: stages = [] } = useQuery<PipelineStage[]>({
    queryKey: ['/api/stages'],
  });

  const analytics = useMemo(() => {
    const openDeals = deals.filter(d => !d.isClosed);
    const totalPipelineValue = openDeals.reduce((sum, deal) => sum + (Number(deal.amount) || 0), 0);
    const activeDeals = openDeals.length;
    
    const closedWonStage = stages?.find(s => 
      s.name.toLowerCase().includes('closed') && s.name.toLowerCase().includes('won')
    );
    const closedDeals = deals.filter(d => d.isClosed);
    const wonDeals = closedWonStage 
      ? closedDeals.filter(d => d.stageId === closedWonStage.id).length 
      : 0;
    const winRate = closedDeals.length > 0 ? Math.round((wonDeals / closedDeals.length) * 100) : 0;

    const hotLeads = leads.filter(l => {
      const score = Number(l.score) || 0;
      return score >= 70;
    }).length;

    const activeLeads = leads.filter(l => 
      l.status !== 'converted' && l.status !== 'unqualified'
    ).length;

    return {
      totalPipelineValue,
      activeDeals,
      winRate,
      hotLeads,
      activeLeads,
    };
  }, [deals, leads, stages]);

  const handleViewChange = (view: string) => {
    setActiveView(view as 'pipeline' | 'list' | 'leads');
  };

  const handleAddNew = () => {
    if (activeView === 'leads') {
      setIsLeadFormOpen(true);
    } else {
      setEditingDeal(null);
      setIsDealFormOpen(true);
    }
  };

  const isLoading = dealsLoading || leadsLoading;

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      <div className="flex-shrink-0 bg-white border-b shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
                Deal Management
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">
                Manage your pipeline, deals, and leads in one place
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input 
                  placeholder="Search deals, leads, companies..." 
                  className="pl-10 w-72 h-9 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="search-workspace"
                />
              </div>
              
              <Button 
                onClick={handleAddNew}
                className="h-9"
                data-testid="button-add-new"
              >
                <Plus className="w-4 h-4 mr-2" />
                {activeView === 'leads' ? 'New Lead' : 'New Deal'}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <KpiCard 
              title="Pipeline Value" 
              value={formatCurrency(analytics.totalPipelineValue)} 
              icon={DollarSign} 
              color="bg-green-500"
              isLoading={isLoading}
            />
            <KpiCard 
              title="Active Deals" 
              value={analytics.activeDeals} 
              icon={Target} 
              color="bg-blue-500"
              isLoading={isLoading}
            />
            <KpiCard 
              title="Win Rate" 
              value={`${analytics.winRate}%`} 
              icon={TrendingUp} 
              color="bg-purple-500"
              isLoading={isLoading}
            />
            <KpiCard 
              title="Active Leads" 
              value={analytics.activeLeads} 
              icon={Users} 
              color="bg-orange-500"
              isLoading={isLoading}
            />
            <KpiCard 
              title="Hot Leads" 
              value={analytics.hotLeads} 
              icon={Flame} 
              color="bg-red-500"
              isLoading={isLoading}
            />
          </div>

          <div className="flex items-center justify-between">
            <Tabs value={activeView} onValueChange={handleViewChange} className="w-auto">
              <TabsList className="bg-gray-100">
                <TabsTrigger 
                  value="pipeline" 
                  className="gap-2 data-[state=active]:bg-white"
                  data-testid="tab-pipeline"
                >
                  <LayoutGrid className="w-4 h-4" />
                  Pipeline
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {deals.filter(d => !d.isClosed).length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger 
                  value="list" 
                  className="gap-2 data-[state=active]:bg-white"
                  data-testid="tab-list"
                >
                  <List className="w-4 h-4" />
                  List
                </TabsTrigger>
                <TabsTrigger 
                  value="leads" 
                  className="gap-2 data-[state=active]:bg-white"
                  data-testid="tab-leads"
                >
                  <Users className="w-4 h-4" />
                  Leads
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {leads.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 gap-2" data-testid="button-filter">
                <Filter className="w-4 h-4" />
                Filters
              </Button>
              <Button variant="outline" size="sm" className="h-8 gap-2" data-testid="button-settings">
                <Settings2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <Suspense fallback={<ViewLoader />}>
          {activeView === 'pipeline' && (
            <PipelineView 
              searchQuery={searchQuery} 
              onEditDeal={(deal) => {
                setEditingDeal(deal);
                setIsDealFormOpen(true);
              }}
            />
          )}
          {activeView === 'list' && (
            <ListView 
              searchQuery={searchQuery}
              onEditDeal={(deal) => {
                setEditingDeal(deal);
                setIsDealFormOpen(true);
              }}
            />
          )}
          {activeView === 'leads' && (
            <LeadsView searchQuery={searchQuery} />
          )}
        </Suspense>
      </div>

      <DealFormModal 
        open={isDealFormOpen} 
        onOpenChange={setIsDealFormOpen}
        deal={editingDeal}
      />
      
      <LeadFormModal
        open={isLeadFormOpen}
        onOpenChange={setIsLeadFormOpen}
        lead={null}
      />
    </div>
  );
}

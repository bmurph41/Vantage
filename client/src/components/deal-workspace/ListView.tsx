import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MoreHorizontal, Trash2, Download, Edit, Calendar, Building2, User, DollarSign
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DealDrawer } from "@/components/deal-drawer";
import type { Deal, Contact, Company, PipelineStage } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";

type DealWithRelations = Deal & { contact?: Contact | null; company?: Company | null };

interface ListViewProps {
  searchQuery: string;
  onEditDeal: (deal: Deal) => void;
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "critical": return "bg-red-500";
    case "high": return "bg-orange-500";
    case "medium": return "bg-yellow-500";
    case "low": return "bg-green-500";
    default: return "bg-gray-500";
  }
};

export default function ListView({ searchQuery, onEditDeal }: ListViewProps) {
  const [activeTab, setActiveTab] = useState<'open' | 'closed'>('open');
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set());
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [stageFilter, setStageFilter] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: deals = [], isLoading } = useQuery<DealWithRelations[]>({
    queryKey: ['/api/deals'],
  });

  const { data: stages = [] } = useQuery<PipelineStage[]>({
    queryKey: ['/api/stages'],
  });

  const filteredDeals = useMemo(() => {
    if (!deals) return [];
    
    return deals.filter((deal) => {
      if (activeTab === 'open' && deal.isClosed) return false;
      if (activeTab === 'closed' && !deal.isClosed) return false;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = deal.title?.toLowerCase().includes(query);
        const matchesCompany = deal.company?.name?.toLowerCase().includes(query);
        const matchesContact = 
          deal.contact?.firstName?.toLowerCase().includes(query) ||
          deal.contact?.lastName?.toLowerCase().includes(query);
        
        if (!matchesTitle && !matchesCompany && !matchesContact) return false;
      }

      if (stageFilter && deal.stageId !== stageFilter) return false;

      return true;
    });
  }, [deals, searchQuery, activeTab, stageFilter]);

  const analytics = useMemo(() => {
    const totalValue = filteredDeals.reduce((sum, deal) => sum + (Number(deal.amount) || 0), 0);
    const dealCount = filteredDeals.length;
    const averageDealSize = dealCount > 0 ? totalValue / dealCount : 0;
    return { totalValue, dealCount, averageDealSize };
  }, [filteredDeals]);

  const toggleSelectAll = () => {
    if (selectedDealIds.size === filteredDeals.length) {
      setSelectedDealIds(new Set());
    } else {
      setSelectedDealIds(new Set(filteredDeals.map(d => d.id)));
    }
  };

  const toggleSelectDeal = (dealId: string) => {
    const newSelection = new Set(selectedDealIds);
    if (newSelection.has(dealId)) {
      newSelection.delete(dealId);
    } else {
      newSelection.add(dealId);
    }
    setSelectedDealIds(newSelection);
  };

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => apiRequest('DELETE', `/api/deals/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      setSelectedDealIds(new Set());
      toast({ title: `Deleted ${selectedDealIds.size} deal(s)` });
    },
    onError: () => {
      toast({ title: "Failed to delete deals", variant: "destructive" });
    },
  });

  const deleteDealMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/deals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      toast({ title: "Deal deleted successfully" });
    },
  });

  const handleExport = () => {
    const headers = ['Title', 'Company', 'Contact', 'Value', 'Stage', 'Priority', 'Expected Close'];
    const rows = filteredDeals.map(deal => {
      const stage = stages?.find(s => s.id === deal.stageId);
      const contactName = deal.contact 
        ? `${deal.contact.firstName || ''} ${deal.contact.lastName || ''}`.trim()
        : '';
      
      return [
        deal.title || '',
        deal.company?.name || '',
        contactName,
        Number(deal.amount) || 0,
        stage?.name.replace(/_/g, ' ') || '',
        deal.priority || '',
        deal.expectedCloseDate 
          ? new Date(deal.expectedCloseDate).toLocaleDateString('en-US')
          : '',
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => 
        typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))
          ? `"${cell.replace(/"/g, '""')}"`
          : cell
      ).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `deals-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ title: `Exported ${filteredDeals.length} deal(s) to CSV` });
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
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'open' | 'closed')}>
            <TabsList>
              <TabsTrigger value="open" data-testid="tab-open-deals">
                Open ({deals.filter(d => !d.isClosed).length})
              </TabsTrigger>
              <TabsTrigger value="closed" data-testid="tab-closed-deals">
                Closed ({deals.filter(d => d.isClosed).length})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-40 h-8" data-testid="select-stage-filter">
              <SelectValue placeholder="All Stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Stages</SelectItem>
              {stages.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  {stage.name.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {selectedDealIds.size > 0 && (
            <>
              <span className="text-sm text-gray-500">
                {selectedDealIds.size} selected
              </span>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => {
                  if (confirm(`Delete ${selectedDealIds.size} selected deal(s)?`)) {
                    bulkDeleteMutation.mutate(Array.from(selectedDealIds));
                  }
                }}
                data-testid="button-bulk-delete"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={handleExport} data-testid="button-export">
            <Download className="w-4 h-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 px-6 py-2 bg-gray-50 border-b text-sm text-gray-600">
        <span>Total: {formatCurrency(analytics.totalValue)}</span>
        <span>|</span>
        <span>{analytics.dealCount} deals</span>
        <span>|</span>
        <span>Avg: {formatCurrency(analytics.averageDealSize)}</span>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="px-6 py-3 w-10">
                <Checkbox
                  checked={selectedDealIds.size === filteredDeals.length && filteredDeals.length > 0}
                  onCheckedChange={toggleSelectAll}
                  data-testid="checkbox-select-all"
                />
              </th>
              <th className="px-6 py-3">Deal</th>
              <th className="px-6 py-3">Company</th>
              <th className="px-6 py-3">Contact</th>
              <th className="px-6 py-3">Value</th>
              <th className="px-6 py-3">Stage</th>
              <th className="px-6 py-3">Close Date</th>
              <th className="px-6 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {filteredDeals.map((deal) => {
              const stage = stages.find(s => s.id === deal.stageId);
              return (
                <tr 
                  key={deal.id} 
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedDeal(deal)}
                  data-testid={`deal-row-${deal.id}`}
                >
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedDealIds.has(deal.id)}
                      onCheckedChange={() => toggleSelectDeal(deal.id)}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {deal.priority && (
                        <div className={`w-2 h-2 rounded-full ${getPriorityColor(deal.priority)}`} />
                      )}
                      <span className="font-medium text-gray-900">{deal.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {deal.company && (
                      <div className="flex items-center gap-1 text-gray-600">
                        <Building2 className="w-4 h-4" />
                        <span>{deal.company.name}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {deal.contact && (
                      <div className="flex items-center gap-1 text-gray-600">
                        <User className="w-4 h-4" />
                        <span>{deal.contact.firstName} {deal.contact.lastName}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-green-600">
                      {formatCurrency(Number(deal.amount) || 0)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {stage && (
                      <Badge variant="outline">
                        {stage.name.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {deal.expectedCloseDate && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{format(new Date(deal.expectedCloseDate), 'MM/dd/yyyy')}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEditDeal(deal)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={() => {
                            if (confirm(`Delete "${deal.title}"?`)) {
                              deleteDealMutation.mutate(deal.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredDeals.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No deals found matching your criteria
          </div>
        )}
      </div>

      <DealDrawer 
        open={!!selectedDeal} 
        onOpenChange={(open) => !open && setSelectedDeal(null)}
        deal={selectedDeal}
      />
    </div>
  );
}

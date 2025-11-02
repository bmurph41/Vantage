import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DollarSign, Building, User, Calendar, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";
import type { Deal, Contact, Company } from "@shared/schema";

// Commission tracking configuration
const DEFAULT_COMMISSION_RATE = 0.03; // 3% default commission rate
const CLOSED_STAGES = ['Under Contract', 'Closed']; // Stages that represent closed deals

// Deal with relations type
type DealWithRelations = Deal & { 
  contact?: Contact | null; 
  company?: Company | null; 
};

interface CommissionDealsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'potential' | 'realized';
  deals: DealWithRelations[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getStageColor(stage: string): string {
  const stageColors: Record<string, string> = {
    'lead': 'bg-gray-100 text-gray-800',
    'qualified': 'bg-blue-100 text-blue-800',
    'proposal': 'bg-yellow-100 text-yellow-800',
    'negotiation': 'bg-orange-100 text-orange-800',
    'closed_won': 'bg-green-100 text-green-800',
    'closed_lost': 'bg-red-100 text-red-800',
    'Under Contract': 'bg-purple-100 text-purple-800',
    'Closed': 'bg-green-100 text-green-800',
  };
  
  return stageColors[stage] || 'bg-gray-100 text-gray-800';
}

export default function CommissionDealsModal({ 
  open, 
  onOpenChange, 
  type, 
  deals 
}: CommissionDealsModalProps) {
  const [, setLocation] = useLocation();

  // Filter deals based on modal type
  const filteredDeals = type === 'realized' 
    ? deals.filter(deal => CLOSED_STAGES.includes(deal.stage))
    : deals;

  // Calculate totals
  const totalDealValue = filteredDeals.reduce((sum, deal) => {
    return sum + (Number(deal.amount || deal.value) || 0);
  }, 0);

  const totalCommission = filteredDeals.reduce((sum, deal) => {
    const amount = Number(deal.amount || deal.value) || 0;
    return sum + (amount * DEFAULT_COMMISSION_RATE);
  }, 0);

  const handleDealClick = (dealId: string) => {
    setLocation(`/deals/${dealId}`);
    onOpenChange(false);
  };

  const modalTitle = type === 'potential' ? 'Potential Commissions' : 'Realized Commissions';
  const modalSubtitle = type === 'potential' 
    ? 'All active deals contributing to potential commissions'
    : 'Closed deals contributing to realized commissions';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]" data-testid="commission-deals-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            {modalTitle}
          </DialogTitle>
          <p className="text-sm text-gray-600">{modalSubtitle}</p>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-center">
            <p className="text-sm text-gray-600">Total Deals</p>
            <p className="text-2xl font-bold text-gray-900">{filteredDeals.length}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Total Value</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalDealValue)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Total Commission</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalCommission)}</p>
          </div>
        </div>

        <ScrollArea className="h-96">
          <div className="space-y-3">
            {filteredDeals.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No {type === 'potential' ? 'active' : 'closed'} deals found</p>
              </div>
            ) : (
              filteredDeals.map((deal) => {
                const dealValue = Number(deal.amount || deal.value) || 0;
                const commission = dealValue * DEFAULT_COMMISSION_RATE;

                return (
                  <div
                    key={deal.id}
                    className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleDealClick(deal.id)}
                    data-testid={`deal-item-${deal.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-gray-900">{deal.title}</h3>
                          <ExternalLink className="w-4 h-4 text-gray-400" />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            <span>Value: {formatCurrency(dealValue)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-green-600" />
                            <span>Commission: {formatCurrency(commission)}</span>
                          </div>
                          
                          {deal.contact && (
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4" />
                              <span>{deal.contact.firstName} {deal.contact.lastName}</span>
                            </div>
                          )}
                          
                          {deal.company && (
                            <div className="flex items-center gap-2">
                              <Building className="w-4 h-4" />
                              <span>{deal.company.name}</span>
                            </div>
                          )}
                          
                          {deal.expectedCloseDate && (
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              <span>Close: {new Date(deal.expectedCloseDate).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={getStageColor(deal.stage)}>
                          {deal.stage}
                        </Badge>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Priority</p>
                          <p className="text-sm font-medium capitalize">{deal.priority}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
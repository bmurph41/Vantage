import { useState } from "react";
import { Database, Link2, ChevronDown, ChevronRight, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import type { OmBlock } from "../types";

interface DataSource {
  id: string;
  name: string;
  type: string;
  sourceType: string;
}

interface DataBindingPanelProps {
  omId: string;
  dealId?: string | null;
  modelingProjectId?: string | null;
  selectedBlock: OmBlock | null;
  onBindField: (blockId: string, fieldPath: string, fieldValue: any) => void;
}

const DEAL_FIELDS = [
  { key: 'name', label: 'Deal Name', type: 'text' },
  { key: 'propertyName', label: 'Property Name', type: 'text' },
  { key: 'propertyType', label: 'Property Type', type: 'text' },
  { key: 'address', label: 'Address', type: 'text' },
  { key: 'city', label: 'City', type: 'text' },
  { key: 'state', label: 'State', type: 'text' },
  { key: 'asking_price', label: 'Asking Price', type: 'currency' },
  { key: 'noi', label: 'NOI', type: 'currency' },
  { key: 'capRate', label: 'Cap Rate', type: 'percent' },
  { key: 'slips', label: 'Slips', type: 'number' },
  { key: 'square_footage', label: 'Square Footage', type: 'number' },
  { key: 'stage', label: 'Stage', type: 'text' },
  { key: 'probability', label: 'Probability', type: 'percent' },
];

const MODELING_FIELDS = [
  { key: 'name', label: 'Project Name', type: 'text' },
  { key: 'propertyType', label: 'Property Type', type: 'text' },
  { key: 'address', label: 'Address', type: 'text' },
  { key: 'city', label: 'City', type: 'text' },
  { key: 'state', label: 'State', type: 'text' },
  { key: 'purchasePrice', label: 'Purchase Price', type: 'currency' },
  { key: 'slipCount', label: 'Slip Count', type: 'number' },
  { key: 'totalSquareFeet', label: 'Total Sq Ft', type: 'number' },
  { key: 'status', label: 'Status', type: 'text' },
];

function formatValue(value: any, type: string): string {
  if (value === null || value === undefined) return '—';
  
  switch (type) {
    case 'currency':
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
    case 'percent':
      return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : value;
    case 'number':
      return new Intl.NumberFormat('en-US').format(value);
    default:
      return String(value);
  }
}

export function DataBindingPanel({ omId, dealId, modelingProjectId, selectedBlock, onBindField }: DataBindingPanelProps) {
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({ deal: true, modeling: true });

  const { data: sources = [] } = useQuery<DataSource[]>({
    queryKey: ['/api/om/data-facade/sources', omId],
    enabled: !!omId,
  });

  const dealSourceId = dealId ? `deal-${dealId}` : null;
  const modelingSourceId = modelingProjectId ? `modeling-${modelingProjectId}` : null;

  const { data: dealData, isLoading: dealLoading, refetch: refetchDeal } = useQuery<Record<string, any>>({
    queryKey: ['/api/om/data-facade/data', dealSourceId],
    enabled: !!dealSourceId,
  });

  const { data: modelingData, isLoading: modelingLoading, refetch: refetchModeling } = useQuery<Record<string, any>>({
    queryKey: ['/api/om/data-facade/data', modelingSourceId],
    enabled: !!modelingSourceId,
  });

  const toggleSource = (id: string) => {
    setExpandedSources(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleInsertField = (fieldKey: string, fieldValue: any, fieldLabel: string) => {
    if (selectedBlock) {
      onBindField(selectedBlock.id, fieldKey, fieldValue);
    }
  };

  const hasLinkedData = dealId || modelingProjectId;

  if (!hasLinkedData) {
    return (
      <div className="p-4 text-center">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
          <Link2 className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">No Data Sources</p>
        <p className="text-xs text-muted-foreground">
          Link this OM to a CRM Deal or Modeling Project to enable data binding.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Data Sources</span>
        </div>
      </div>

      {!selectedBlock && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Select a text block to insert data fields
            </p>
          </div>
        </div>
      )}

      {dealId && (
        <Collapsible open={expandedSources.deal} onOpenChange={() => toggleSource('deal')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-md hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              {expandedSources.deal ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <span className="text-sm font-medium">CRM Deal</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {dealLoading ? '...' : 'Connected'}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => { e.stopPropagation(); refetchDeal(); }}
              data-testid="button-refresh-deal"
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-5 pr-2 py-2 space-y-1">
            {DEAL_FIELDS.map(field => {
              const value = dealData?.[field.key];
              const displayValue = formatValue(value, field.type);
              
              return (
                <button
                  key={field.key}
                  onClick={() => handleInsertField(field.key, value, field.label)}
                  disabled={!selectedBlock || selectedBlock.type !== 'text'}
                  className="flex items-center justify-between w-full p-1.5 rounded text-left hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors group"
                  data-testid={`field-deal-${field.key}`}
                >
                  <span className="text-xs text-muted-foreground">{field.label}</span>
                  <span className="text-xs font-medium truncate max-w-[100px] group-hover:text-primary transition-colors">
                    {displayValue}
                  </span>
                </button>
              );
            })}
          </CollapsibleContent>
        </Collapsible>
      )}

      {modelingProjectId && (
        <Collapsible open={expandedSources.modeling} onOpenChange={() => toggleSource('modeling')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-md hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              {expandedSources.modeling ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <span className="text-sm font-medium">Modeling Project</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {modelingLoading ? '...' : 'Connected'}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => { e.stopPropagation(); refetchModeling(); }}
              data-testid="button-refresh-modeling"
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-5 pr-2 py-2 space-y-1">
            {MODELING_FIELDS.map(field => {
              const value = modelingData?.[field.key];
              const displayValue = formatValue(value, field.type);
              
              return (
                <button
                  key={field.key}
                  onClick={() => handleInsertField(field.key, value, field.label)}
                  disabled={!selectedBlock || selectedBlock.type !== 'text'}
                  className="flex items-center justify-between w-full p-1.5 rounded text-left hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors group"
                  data-testid={`field-modeling-${field.key}`}
                >
                  <span className="text-xs text-muted-foreground">{field.label}</span>
                  <span className="text-xs font-medium truncate max-w-[100px] group-hover:text-primary transition-colors">
                    {displayValue}
                  </span>
                </button>
              );
            })}
          </CollapsibleContent>
        </Collapsible>
      )}

      {selectedBlock?.type === 'text' && (
        <p className="text-[10px] text-muted-foreground px-2">
          Click a field above to insert its value into the selected text block.
        </p>
      )}
    </div>
  );
}

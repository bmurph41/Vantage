import React, { useEffect, useState } from 'react';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Database, Loader2 } from "lucide-react";
import { OmBlock, OmDataBinding, OmDataSourceType, OmDataResponse } from "@/lib/types";
import { fetchOmData } from "@/lib/om-data-api";
import { Badge } from "@/components/ui/badge";
import { useDatasets } from "@/lib/api";
import type { Dataset } from "@shared/schema";

interface DataBindingPanelProps {
  block: OmBlock;
  onUpdateBinding: (binding: OmDataBinding) => void;
  projectId: string;
}

export function DataBindingPanel({ block, onUpdateBinding, projectId }: DataBindingPanelProps) {
  const [loading, setLoading] = useState(false);
  const [dataSchema, setDataSchema] = useState<OmDataResponse | null>(null);

  const binding = block.dataBinding || { sourceType: 'manual' };
  const { data: datasets = [] } = useDatasets(projectId);

  useEffect(() => {
    if (binding.sourceType !== 'manual') {
      setLoading(true);
      const datasetId = binding.sourceType === 'dataset' ? binding.sourceId : undefined;
      const sheetName = binding.sourceType === 'dataset' ? binding.sheetName : undefined;
      fetchOmData(projectId, binding.sourceType, datasetId || undefined, sheetName)
        .then(data => setDataSchema(data))
        .catch(err => console.error("Failed to fetch schema", err))
        .finally(() => setLoading(false));
    } else {
      setDataSchema(null);
    }
  }, [binding.sourceType, binding.sourceId, binding.sheetName, projectId]);

  const handleSourceChange = (val: string) => {
    if (val.startsWith('dataset:')) {
      const [, datasetId, sheetName] = val.split(':');
      onUpdateBinding({
        sourceType: 'dataset',
        sourceId: datasetId,
        sheetName: sheetName,
        bindingRole: undefined
      });
    } else {
      onUpdateBinding({
        sourceType: val as OmDataSourceType,
        sourceId: projectId,
        sheetName: undefined,
        bindingRole: undefined
      });
    }
  };

  const handleRoleChange = (val: string) => {
    onUpdateBinding({
      ...binding,
      bindingRole: val
    });
  };

  const getCurrentSourceValue = () => {
    if (binding.sourceType === 'dataset' && binding.sourceId) {
      return `dataset:${binding.sourceId}:${binding.sheetName || ''}`;
    }
    return binding.sourceType;
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-muted-foreground" />
            <Label>Data Source</Label>
        </div>
        
        <Select 
            value={getCurrentSourceValue()}
            onValueChange={handleSourceChange}
        >
            <SelectTrigger className="w-full">
                <SelectValue placeholder="Select source..." />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="manual">Manual / Static</SelectItem>
                
                {datasets.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1">Uploaded Datasets</div>
                    {datasets.map((dataset: Dataset) => (
                      dataset.sheetNames?.map((sheetName) => (
                        <SelectItem 
                          key={`${dataset.id}:${sheetName}`} 
                          value={`dataset:${dataset.id}:${sheetName}`}
                          className="text-xs"
                        >
                          {dataset.name} - {sheetName}
                        </SelectItem>
                      ))
                    ))}
                  </>
                )}
                
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1">Built-in Sources</div>
                <SelectItem value="underwriting">Underwriting Model (Mock)</SelectItem>
                <SelectItem value="sales_comps">Sales Comps (Mock)</SelectItem>
                <SelectItem value="rent_comps">Rent Comps (Mock)</SelectItem>
                <SelectItem value="market">Market Data (Mock)</SelectItem>
                <SelectItem value="demographics">Demographics (Mock)</SelectItem>
            </SelectContent>
        </Select>
      </div>

      {binding.sourceType !== 'manual' && (
        <div className="p-3 bg-muted/20 border rounded-md space-y-3">
           {loading ? (
             <div className="flex items-center justify-center py-4 text-muted-foreground text-xs gap-2">
               <Loader2 className="w-3 h-3 animate-spin" /> Fetching available data...
             </div>
           ) : dataSchema ? (
             <>
               <div className="flex items-center justify-between">
                 <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                   {binding.sourceType.replace('_', ' ')}
                 </Label>
                 <Badge variant="outline" className="text-[10px] h-5 font-normal">Connected</Badge>
               </div>
               
               <div className="space-y-1">
                 <Label className="text-xs">Select Metric/Series</Label>
                 <Select value={binding.bindingRole} onValueChange={handleRoleChange}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue placeholder="Choose data point..." />
                    </SelectTrigger>
                    <SelectContent>
                        {/* Intelligent filtering based on Block Type */}
                        
                        {/* KPIs want scalar metrics */}
                        {block.type === 'kpi' && Object.keys(dataSchema.metrics).length > 0 && (
                           <>
                             <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Single Metrics</div>
                             {Object.keys(dataSchema.metrics).map(key => (
                               <SelectItem key={key} value={`metrics.${key}`} className="text-xs">
                                 {key.replace(/([A-Z])/g, ' $1').trim()}
                               </SelectItem>
                             ))}
                           </>
                        )}

                        {/* Charts want Series */}
                        {block.type === 'chart' && dataSchema.series.length > 0 && (
                           <>
                             <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Time Series</div>
                             {dataSchema.series.map(s => (
                               <SelectItem key={s.id} value={`series.${s.id}`} className="text-xs">
                                 {s.label}
                               </SelectItem>
                             ))}
                           </>
                        )}

                        {/* Tables want Tables */}
                        {block.type === 'table' && dataSchema.tables.length > 0 && (
                           <>
                             <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Tables</div>
                             {dataSchema.tables.map(t => (
                               <SelectItem key={t.id} value={`tables.${t.id}`} className="text-xs">
                                 {t.label}
                               </SelectItem>
                             ))}
                           </>
                        )}
                        
                        {/* Fallback empty states */}
                        {block.type === 'chart' && dataSchema.series.length === 0 && <div className="p-2 text-xs text-muted-foreground italic">No chart data found</div>}
                        {block.type === 'table' && dataSchema.tables.length === 0 && <div className="p-2 text-xs text-muted-foreground italic">No table data found</div>}

                    </SelectContent>
                 </Select>
               </div>

               {binding.bindingRole && (
                 <div className="text-[10px] text-muted-foreground bg-background p-2 rounded border">
                    Preview: {getPreviewValue(dataSchema, binding.bindingRole)}
                 </div>
               )}
             </>
           ) : (
             <div className="text-xs text-destructive">Failed to load data schema.</div>
           )}
        </div>
      )}
    </div>
  );
}

function getPreviewValue(schema: OmDataResponse, role: string) {
  const [type, key] = role.split('.');
  if (type === 'metrics') return schema.metrics[key];
  if (type === 'series') return `${schema.series.find(s => s.id === key)?.data.length || 0} data points`;
  if (type === 'tables') return `${schema.tables.find(t => t.id === key)?.rows.length || 0} rows`;
  return 'Unknown';
}

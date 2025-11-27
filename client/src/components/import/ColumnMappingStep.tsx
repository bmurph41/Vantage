import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Check, AlertCircle, Wand2, X, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ParsedFileData, ColumnMapping, ImportTarget } from "./DataImportWizard";

interface ColumnMappingStepProps {
  parsedData: ParsedFileData;
  targetModule: ImportTarget;
  columnMappings: ColumnMapping[];
  onMappingsChange: (mappings: ColumnMapping[]) => void;
}

const TARGET_FIELDS: Record<ImportTarget, { key: string; label: string; required?: boolean }[]> = {
  salesComps: [
    { key: 'marina', label: 'Marina Name', required: true },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State', required: true },
    { key: 'saleDate', label: 'Sale Date' },
    { key: 'salePrice', label: 'Sale Price' },
    { key: 'seller', label: 'Seller' },
    { key: 'buyer', label: 'Buyer' },
    { key: 'wetSlips', label: 'Wet Slips' },
    { key: 'drySlips', label: 'Dry Slips' },
    { key: 'moorings', label: 'Moorings' },
    { key: 'capRate', label: 'Cap Rate' },
    { key: 'noi', label: 'NOI' },
    { key: 'grossRevenue', label: 'Gross Revenue' },
    { key: 'occupancy', label: 'Occupancy' },
    { key: 'waterType', label: 'Water Type' },
    { key: 'bodyOfWater', label: 'Body of Water' },
    { key: 'transactionType', label: 'Transaction Type' },
    { key: 'broker', label: 'Broker' },
    { key: 'notes', label: 'Notes' },
  ],
  rateComps: [
    { key: 'marina', label: 'Marina Name', required: true },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State', required: true },
    { key: 'storageType', label: 'Storage Type' },
    { key: 'boatLengthMin', label: 'Min Boat Length' },
    { key: 'boatLengthMax', label: 'Max Boat Length' },
    { key: 'rateAmount', label: 'Rate Amount' },
    { key: 'rateType', label: 'Rate Type' },
    { key: 'ratePeriod', label: 'Rate Period' },
    { key: 'seasonality', label: 'Seasonality' },
    { key: 'electricIncluded', label: 'Electric Included' },
    { key: 'protectionLevel', label: 'Protection Level' },
    { key: 'effectiveDate', label: 'Effective Date' },
    { key: 'waterType', label: 'Water Type' },
    { key: 'bodyOfWater', label: 'Body of Water' },
    { key: 'notes', label: 'Notes' },
  ],
  marinaDatabase: [
    { key: 'name', label: 'Marina Name', required: true },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State', required: true },
    { key: 'address', label: 'Address' },
    { key: 'zipCode', label: 'ZIP Code' },
    { key: 'latitude', label: 'Latitude' },
    { key: 'longitude', label: 'Longitude' },
    { key: 'wetSlips', label: 'Wet Slips' },
    { key: 'drySlips', label: 'Dry Slips' },
    { key: 'moorings', label: 'Moorings' },
    { key: 'waterType', label: 'Water Type' },
    { key: 'bodyOfWater', label: 'Body of Water' },
    { key: 'website', label: 'Website' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
  ],
};

export function ColumnMappingStep({
  parsedData,
  targetModule,
  columnMappings,
  onMappingsChange,
}: ColumnMappingStepProps) {
  const targetFields = TARGET_FIELDS[targetModule];

  const mappedTargets = useMemo(() => {
    return new Set(columnMappings.map(m => m.targetField));
  }, [columnMappings]);

  const getExampleValues = (column: string) => {
    const values = parsedData.rows
      .slice(0, 3)
      .map(row => row[column])
      .filter(Boolean);
    return values.length > 0 ? values : ['—'];
  };

  const updateMapping = (sourceColumn: string, targetField: string | null) => {
    const existingIndex = columnMappings.findIndex(m => m.sourceColumn === sourceColumn);
    
    if (targetField === null || targetField === '') {
      if (existingIndex >= 0) {
        const updated = [...columnMappings];
        updated.splice(existingIndex, 1);
        onMappingsChange(updated);
      }
      return;
    }

    const newMapping: ColumnMapping = {
      sourceColumn,
      targetField,
      confidence: 1,
    };

    if (existingIndex >= 0) {
      const updated = [...columnMappings];
      updated[existingIndex] = newMapping;
      onMappingsChange(updated);
    } else {
      onMappingsChange([...columnMappings, newMapping]);
    }
  };

  const getMappingForSource = (sourceColumn: string) => {
    return columnMappings.find(m => m.sourceColumn === sourceColumn);
  };

  const autoMapAll = () => {
    const newMappings: ColumnMapping[] = [];
    const usedTargets = new Set<string>();

    for (const header of parsedData.headers) {
      const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      for (const field of targetFields) {
        if (usedTargets.has(field.key)) continue;
        
        const normalizedField = field.label.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normalizedKey = field.key.toLowerCase();
        
        if (
          normalizedHeader === normalizedField ||
          normalizedHeader === normalizedKey ||
          normalizedHeader.includes(normalizedKey) ||
          normalizedKey.includes(normalizedHeader)
        ) {
          newMappings.push({
            sourceColumn: header,
            targetField: field.key,
            confidence: 0.9,
          });
          usedTargets.add(field.key);
          break;
        }
      }
    }

    onMappingsChange(newMappings);
  };

  const clearAllMappings = () => {
    onMappingsChange([]);
  };

  const requiredMapped = targetFields
    .filter(f => f.required)
    .every(f => mappedTargets.has(f.key));

  const mappedCount = columnMappings.length;
  const totalColumns = parsedData.headers.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant="outline">
            {mappedCount} / {totalColumns} columns mapped
          </Badge>
          {!requiredMapped && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Missing required fields
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={clearAllMappings} data-testid="button-clear-mappings">
            <X className="h-4 w-4 mr-1" />
            Clear All
          </Button>
          <Button variant="secondary" size="sm" onClick={autoMapAll} data-testid="button-auto-map">
            <Wand2 className="h-4 w-4 mr-1" />
            Auto-Map
          </Button>
        </div>
      </div>

      <div className="grid gap-3">
        {parsedData.headers.map((header) => {
          const mapping = getMappingForSource(header);
          const examples = getExampleValues(header);

          return (
            <Card key={header} className={mapping ? 'border-green-200 bg-green-50/30' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{header}</span>
                      <Badge variant="secondary" className="text-xs">
                        {parsedData.columnTypes[header] || 'text'}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      Examples: {examples.slice(0, 3).join(', ')}
                    </div>
                  </div>

                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

                  <div className="w-64 flex-shrink-0">
                    <Select
                      value={mapping?.targetField || ''}
                      onValueChange={(value) => updateMapping(header, value || null)}
                    >
                      <SelectTrigger data-testid={`select-mapping-${header}`}>
                        <SelectValue placeholder="Select target field..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">— Don't import —</SelectItem>
                        {targetFields.map((field) => {
                          const isUsed = mappedTargets.has(field.key) && mapping?.targetField !== field.key;
                          return (
                            <SelectItem
                              key={field.key}
                              value={field.key}
                              disabled={isUsed}
                            >
                              <div className="flex items-center gap-2">
                                {field.label}
                                {field.required && (
                                  <span className="text-destructive">*</span>
                                )}
                                {isUsed && (
                                  <span className="text-muted-foreground text-xs">(used)</span>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-8 flex-shrink-0">
                    {mapping ? (
                      <Check className="h-5 w-5 text-green-600" />
                    ) : (
                      <div className="h-5 w-5" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Required Fields</p>
              <p>
                Fields marked with <span className="text-destructive">*</span> are required for import.
                Unmapped columns will be skipped during import.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

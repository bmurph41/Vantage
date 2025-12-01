import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowRight, ArrowLeft, CheckCircle2, AlertTriangle, Users, Anchor, MapPin, FileText } from "lucide-react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface ColumnMappingInterfaceProps {
  preview: {
    headers: string[];
    rows: Record<string, any>[];
    totalRows: number;
  };
  suggestions: Record<string, any[]>;
  mappings: Record<string, any>;
  onMappingsChange: (mappings: Record<string, any>) => void;
  duplicateStrategy: 'skip' | 'update' | 'error';
  onDuplicateStrategyChange: (strategy: 'skip' | 'update' | 'error') => void;
  onNext: () => void;
  onBack: () => void;
}

interface FieldMapping {
  sourceColumn: string;
  targetField: string;
  required: boolean;
}

const ENTITY_CONFIG = {
  customer: {
    icon: <Users className="h-4 w-4" />,
    label: "Customers",
    fields: {
      firstName: { label: "First Name", required: true },
      lastName: { label: "Last Name", required: true },
      email: { label: "Email", required: true },
      phone: { label: "Phone", required: false },
      address: { label: "Address", required: false },
    }
  },
  boat: {
    icon: <Anchor className="h-4 w-4" />,
    label: "Boats",
    fields: {
      name: { label: "Boat Name", required: true },
      make: { label: "Make", required: true },
      model: { label: "Model", required: true },
      year: { label: "Year", required: true },
      length: { label: "Length", required: true },
      beam: { label: "Beam", required: true },
      draft: { label: "Draft", required: false },
      hullId: { label: "Hull ID", required: false },
      registrationNumber: { label: "Registration", required: false },
    }
  },
  slip: {
    icon: <MapPin className="h-4 w-4" />,
    label: "Slips",
    fields: {
      number: { label: "Slip Number", required: true },
      type: { label: "Type", required: true },
      section: { label: "Section", required: true },
      maxLength: { label: "Max Length", required: true },
      maxBeam: { label: "Max Beam", required: true },
      maxDraft: { label: "Max Draft", required: false },
      monthlyRate: { label: "Monthly Rate", required: true },
      utilities: { label: "Utilities", required: false },
    }
  },
  lease: {
    icon: <FileText className="h-4 w-4" />,
    label: "Leases",
    fields: {
      startDate: { label: "Start Date", required: true },
      endDate: { label: "End Date", required: false },
      monthlyRate: { label: "Monthly Rate", required: true },
      depositAmount: { label: "Deposit Amount", required: false },
      autoRenew: { label: "Auto Renew", required: false },
    }
  }
};

export default function ColumnMappingInterface({
  preview,
  suggestions,
  mappings,
  onMappingsChange,
  duplicateStrategy,
  onDuplicateStrategyChange,
  onNext,
  onBack
}: ColumnMappingInterfaceProps) {
  const [currentTab, setCurrentTab] = useState("customer");
  const [validationResults, setValidationResults] = useState<Record<string, { valid: boolean; missing: string[] }>>({});

  // Initialize mappings with suggestions
  useEffect(() => {
    if (Object.keys(mappings).length === 0 && suggestions) {
      const initialMappings: Record<string, FieldMapping[]> = {};
      
      Object.entries(suggestions).forEach(([entity, entitySuggestions]) => {
        initialMappings[entity] = (entitySuggestions as any[]).map(mapping => ({
          sourceColumn: mapping.sourceColumn,
          targetField: mapping.targetField,
          required: mapping.required || false
        }));
      });
      
      onMappingsChange(initialMappings);
    }
  }, [suggestions, mappings, onMappingsChange]);

  // Validate mappings
  useEffect(() => {
    const results: Record<string, { valid: boolean; missing: string[] }> = {};
    
    Object.entries(ENTITY_CONFIG).forEach(([entity, config]) => {
      const entityMappings = mappings[entity] || [];
      const mappedFields = entityMappings.map((m: FieldMapping) => m.targetField);
      const requiredFields = Object.entries(config.fields)
        .filter(([, fieldConfig]) => fieldConfig.required)
        .map(([fieldName]) => fieldName);
      
      const missing = requiredFields.filter(field => !mappedFields.includes(field));
      results[entity] = {
        valid: missing.length === 0,
        missing
      };
    });
    
    setValidationResults(results);
  }, [mappings]);

  const updateMapping = (entity: string, targetField: string, sourceColumn: string) => {
    const entityMappings = mappings[entity] || [];
    const existingIndex = entityMappings.findIndex((m: FieldMapping) => m.targetField === targetField);
    const fieldConfig = ENTITY_CONFIG[entity as keyof typeof ENTITY_CONFIG].fields[targetField as keyof any];
    
    const newMapping: FieldMapping = {
      sourceColumn,
      targetField,
      required: fieldConfig?.required || false
    };

    let updatedMappings;
    if (existingIndex >= 0) {
      updatedMappings = [...entityMappings];
      if (sourceColumn === '') {
        // Remove mapping
        updatedMappings.splice(existingIndex, 1);
      } else {
        // Update mapping
        updatedMappings[existingIndex] = newMapping;
      }
    } else if (sourceColumn !== '') {
      // Add new mapping
      updatedMappings = [...entityMappings, newMapping];
    } else {
      return; // No change needed
    }

    onMappingsChange({
      ...mappings,
      [entity]: updatedMappings
    });
  };

  const getCurrentMapping = (entity: string, targetField: string): string => {
    const entityMappings = mappings[entity] || [];
    const mapping = entityMappings.find((m: FieldMapping) => m.targetField === targetField);
    return mapping?.sourceColumn || '';
  };

  const getUsedColumns = (entity: string): string[] => {
    const entityMappings = mappings[entity] || [];
    return entityMappings.map((m: FieldMapping) => m.sourceColumn).filter(Boolean);
  };

  const canProceed = Object.values(validationResults).some(result => result.valid);

  return (
    <div className="space-y-6" data-testid="column-mapping-interface">
      <Card>
        <CardHeader>
          <CardTitle>Column Mapping</CardTitle>
          <CardDescription>
            Map your file columns to the corresponding data fields. We've suggested mappings based on common column names.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <h4 className="font-medium mb-2">File Preview</h4>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    {preview.headers.map((header, index) => (
                      <th key={index} className="p-2 text-left font-medium">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 3).map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-t">
                      {preview.headers.map((header, colIndex) => (
                        <td key={colIndex} className="p-2 text-muted-foreground">
                          {String(row[header] || '').substring(0, 30)}
                          {String(row[header] || '').length > 30 ? '...' : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Showing first 3 rows of {preview.totalRows} total rows
            </p>
          </div>

          <Tabs value={currentTab} onValueChange={setCurrentTab}>
            <TabsList className="grid w-full grid-cols-4">
              {Object.entries(ENTITY_CONFIG).map(([entity, config]) => (
                <TabsTrigger key={entity} value={entity} className="flex items-center gap-2" data-testid={`tab-${entity}`}>
                  {config.icon}
                  {config.label}
                  {validationResults[entity]?.valid && (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  )}
                  {validationResults[entity] && !validationResults[entity].valid && (
                    <AlertTriangle className="h-3 w-3 text-orange-500" />
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {Object.entries(ENTITY_CONFIG).map(([entity, config]) => {
              const usedColumns = getUsedColumns(entity);
              const validation = validationResults[entity];

              return (
                <TabsContent key={entity} value={entity} className="space-y-4">
                  {validation && !validation.valid && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Missing required mappings: {validation.missing.join(', ')}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="grid gap-4">
                    {Object.entries(config.fields).map(([fieldName, fieldConfig]) => {
                      const currentValue = getCurrentMapping(entity, fieldName);
                      
                      return (
                        <div key={fieldName} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div>
                              <Label className="flex items-center gap-2">
                                {fieldConfig.label}
                                {fieldConfig.required && (
                                  <Badge variant="destructive" className="text-xs">Required</Badge>
                                )}
                              </Label>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Select
                              value={currentValue}
                              onValueChange={(value) => updateMapping(entity, fieldName, value)}
                              data-testid={`select-${entity}-${fieldName}`}
                            >
                              <SelectTrigger className="w-64">
                                <SelectValue placeholder="Select column..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">No mapping</SelectItem>
                                {preview.headers.map((header) => (
                                  <SelectItem 
                                    key={header} 
                                    value={header}
                                    disabled={usedColumns.includes(header) && currentValue !== header}
                                  >
                                    {header}
                                    {usedColumns.includes(header) && currentValue !== header && (
                                      <span className="text-muted-foreground"> (used)</span>
                                    )}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Duplicate Handling</CardTitle>
          <CardDescription>
            Choose how to handle duplicate records during import
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={duplicateStrategy} onValueChange={onDuplicateStrategyChange}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="skip" id="skip" data-testid="radio-skip" />
              <Label htmlFor="skip" className="flex-1">
                <div className="font-medium">Skip Duplicates</div>
                <div className="text-sm text-muted-foreground">
                  Skip records that already exist (recommended for initial imports)
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="update" id="update" data-testid="radio-update" />
              <Label htmlFor="update" className="flex-1">
                <div className="font-medium">Update Existing</div>
                <div className="text-sm text-muted-foreground">
                  Update existing records with new data
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="error" id="error" data-testid="radio-error" />
              <Label htmlFor="error" className="flex-1">
                <div className="font-medium">Error on Duplicates</div>
                <div className="text-sm text-muted-foreground">
                  Stop processing when duplicates are found
                </div>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} data-testid="button-back">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button 
          onClick={onNext} 
          disabled={!canProceed}
          data-testid="button-next"
        >
          Preview Import
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
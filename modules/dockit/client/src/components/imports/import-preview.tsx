import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowRight, ArrowLeft, Play, AlertTriangle, CheckCircle2, Users, Anchor, MapPin, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ImportPreviewProps {
  preview: {
    headers: string[];
    rows: Record<string, any>[];
    totalRows: number;
  };
  mappings: Record<string, any[]>;
  duplicateStrategy: 'skip' | 'update' | 'error';
  onStartImport: () => void;
  onBack: () => void;
  isStarting: boolean;
}

interface ProcessedData {
  customers: any[];
  boats: any[];
  slips: any[];
  leases: any[];
  unmappedRows: number;
  totalRows: number;
}

const ENTITY_CONFIG = {
  customer: {
    icon: <Users className="h-4 w-4" />,
    label: "Customers",
    color: "bg-blue-500"
  },
  boat: {
    icon: <Anchor className="h-4 w-4" />,
    label: "Boats", 
    color: "bg-green-500"
  },
  slip: {
    icon: <MapPin className="h-4 w-4" />,
    label: "Slips",
    color: "bg-purple-500"
  },
  lease: {
    icon: <FileText className="h-4 w-4" />,
    label: "Leases",
    color: "bg-orange-500"
  }
};

export default function ImportPreview({
  preview,
  mappings,
  duplicateStrategy,
  onStartImport,
  onBack,
  isStarting
}: ImportPreviewProps) {

  const processedData: ProcessedData = useMemo(() => {
    const result: ProcessedData = {
      customers: [],
      boats: [],
      slips: [],
      leases: [],
      unmappedRows: 0,
      totalRows: preview.totalRows
    };

    // Process each row through the mappings
    preview.rows.forEach((row, index) => {
      let hasMapping = false;

      Object.entries(mappings).forEach(([entity, entityMappings]) => {
        if (entityMappings && entityMappings.length > 0) {
          const mappedRow: any = { _originalRowIndex: index };
          let hasValidData = false;

          entityMappings.forEach((mapping: any) => {
            const value = row[mapping.sourceColumn];
            if (value !== null && value !== undefined && value !== '') {
              mappedRow[mapping.targetField] = value;
              hasValidData = true;
            }
          });

          if (hasValidData) {
            result[entity as keyof typeof result].push(mappedRow);
            hasMapping = true;
          }
        }
      });

      if (!hasMapping) {
        result.unmappedRows++;
      }
    });

    return result;
  }, [preview.rows, mappings, preview.totalRows]);

  const getStrategyDescription = (strategy: string) => {
    switch (strategy) {
      case 'skip':
        return 'Duplicate records will be skipped without errors';
      case 'update': 
        return 'Existing records will be updated with new data';
      case 'error':
        return 'Import will stop if duplicates are found';
      default:
        return '';
    }
  };

  const hasData = Object.values(processedData).some(data => 
    Array.isArray(data) ? data.length > 0 : false
  );

  return (
    <div className="space-y-6" data-testid="import-preview">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Import Preview
          </CardTitle>
          <CardDescription>
            Review the data that will be imported. You can go back to adjust mappings if needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {Object.entries(ENTITY_CONFIG).map(([entity, config]) => {
              const count = (processedData[entity as keyof ProcessedData] as any[])?.length || 0;
              return (
                <div key={entity} className="text-center p-4 border rounded-lg">
                  <div className="flex items-center justify-center mb-2">
                    {config.icon}
                  </div>
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-sm text-muted-foreground">{config.label}</div>
                </div>
              );
            })}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
              <div>
                <div className="font-medium">Total Rows to Process</div>
                <div className="text-sm text-muted-foreground">
                  {processedData.totalRows - processedData.unmappedRows} of {processedData.totalRows} rows have mappings
                </div>
              </div>
              <Badge variant={processedData.unmappedRows > 0 ? "destructive" : "default"}>
                {processedData.totalRows - processedData.unmappedRows} mapped
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-medium">Duplicate Handling Strategy</div>
                <div className="text-sm text-muted-foreground">
                  {getStrategyDescription(duplicateStrategy)}
                </div>
              </div>
              <Badge variant="outline" className="capitalize">
                {duplicateStrategy}
              </Badge>
            </div>
          </div>

          {processedData.unmappedRows > 0 && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {processedData.unmappedRows} rows have no valid mappings and will be skipped during import.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {hasData && (
        <Card>
          <CardHeader>
            <CardTitle>Data Preview</CardTitle>
            <CardDescription>
              Sample of the data that will be imported (showing first 5 records per entity)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="customer" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                {Object.entries(ENTITY_CONFIG).map(([entity, config]) => {
                  const count = (processedData[entity as keyof ProcessedData] as any[])?.length || 0;
                  return (
                    <TabsTrigger 
                      key={entity} 
                      value={entity} 
                      disabled={count === 0}
                      className="flex items-center gap-2"
                      data-testid={`preview-tab-${entity}`}
                    >
                      {config.icon}
                      {config.label} ({count})
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {Object.entries(ENTITY_CONFIG).map(([entity, config]) => {
                const data = (processedData[entity as keyof ProcessedData] as any[]) || [];
                if (data.length === 0) return null;

                const sampleData = data.slice(0, 5);
                const fields = Object.keys(sampleData[0] || {}).filter(key => key !== '_originalRowIndex');

                return (
                  <TabsContent key={entity} value={entity}>
                    <div className="border rounded-lg overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            {fields.map((field) => (
                              <th key={field} className="p-3 text-left font-medium capitalize">
                                {field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sampleData.map((row, index) => (
                            <tr key={index} className="border-t">
                              {fields.map((field) => (
                                <td key={field} className="p-3">
                                  <div className="max-w-xs truncate" title={String(row[field] || '')}>
                                    {String(row[field] || '')}
                                  </div>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {data.length > 5 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Showing 5 of {data.length} records
                      </p>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>
      )}

      {!hasData && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No valid data found for import. Please go back and check your column mappings.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} data-testid="button-back-preview">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Mapping
        </Button>
        <Button 
          onClick={onStartImport} 
          disabled={!hasData || isStarting}
          data-testid="button-start-import"
        >
          {isStarting ? (
            <>Processing...</>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Start Import
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
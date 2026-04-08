import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, AlertTriangle, FileSpreadsheet } from "lucide-react";
import type { ParsedFileData, ColumnMapping, ImportTarget } from "./DataImportWizard";

interface DataPreviewStepProps {
  parsedData: ParsedFileData;
  columnMappings: ColumnMapping[];
  targetModule: ImportTarget;
}

export function DataPreviewStep({
  parsedData,
  columnMappings,
  targetModule,
}: DataPreviewStepProps) {
  const previewRows = useMemo(() => {
    return parsedData.rows.slice(0, 10).map((row, index) => {
      const transformedRow: Record<string, any> = { _index: index };
      
      for (const mapping of columnMappings) {
        const value = row[mapping.sourceColumn];
        transformedRow[mapping.targetField] = value;
      }
      
      return transformedRow;
    });
  }, [parsedData.rows, columnMappings]);

  const stats = useMemo(() => {
    const total = parsedData.rows.length;
    let valid = 0;
    let warnings = 0;

    for (const row of parsedData.rows) {
      let hasRequiredFields = true;
      let hasWarning = false;

      for (const mapping of columnMappings) {
        const value = row[mapping.sourceColumn];
        if (!value && mapping.targetField === 'marina') {
          hasRequiredFields = false;
        }
        if (!value && mapping.targetField === 'state') {
          hasRequiredFields = false;
        }
      }

      if (hasRequiredFields) {
        valid++;
      } else {
        warnings++;
      }
    }

    return { total, valid, warnings };
  }, [parsedData.rows, columnMappings]);

  const targetFieldLabels: Record<string, string> = {
    marina: 'Marina',
    name: 'Name',
    city: 'City',
    state: 'State',
    saleDate: 'Sale Date',
    salePrice: 'Sale Price',
    seller: 'Seller',
    buyer: 'Buyer',
    wetSlips: 'Wet Slips',
    drySlips: 'Dry Slips',
    moorings: 'Moorings',
    capRate: 'Cap Rate',
    noi: 'NOI',
    grossRevenue: 'Revenue',
    occupancy: 'Occupancy',
    waterType: 'Water Type',
    bodyOfWater: 'Body of Water',
    transactionType: 'Transaction',
    broker: 'Broker',
    notes: 'Notes',
    storageType: 'Storage Type',
    boatLengthMin: 'Min Length',
    boatLengthMax: 'Max Length',
    rateAmount: 'Rate',
    rateType: 'Rate Type',
    ratePeriod: 'Period',
    seasonality: 'Season',
    electricIncluded: 'Electric',
    protectionLevel: 'Protection',
    effectiveDate: 'Effective Date',
    address: 'Address',
    zipCode: 'ZIP',
    latitude: 'Lat',
    longitude: 'Lng',
    website: 'Website',
    phone: 'Phone',
    email: 'Email',
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Records</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.valid}</p>
                <p className="text-sm text-muted-foreground">Valid Records</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.warnings}</p>
                <p className="text-sm text-muted-foreground">With Warnings</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Data Preview</span>
            <Badge variant="secondary">
              Showing first {Math.min(10, parsedData.rows.length)} of {parsedData.rows.length} records
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <div className="min-w-full">
              <Table>
                <TableHeader className="sticky top-0 bg-muted z-10">
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    {columnMappings.map((mapping) => (
                      <TableHead key={mapping.targetField} className="min-w-[120px]">
                        {targetFieldLabels[mapping.targetField] || mapping.targetField}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-center text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      {columnMappings.map((mapping) => (
                        <TableCell key={mapping.targetField} className="truncate max-w-[200px]">
                          {row[mapping.targetField] ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="h-4 w-4 text-green-600" />
            <span>
              {columnMappings.length} columns will be imported. Click Continue to check for existing records and conflicts.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

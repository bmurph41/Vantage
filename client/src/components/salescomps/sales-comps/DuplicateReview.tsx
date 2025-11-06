import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, X, Check } from "lucide-react";
import { formatCurrency, formatNumber } from '@/lib/salescomps/format';
import type { SalesComp } from "@shared/schema";

interface DuplicateReviewProps {
  duplicates: Array<{
    rowIndex: number;
    rowData: any;
    existingComps: SalesComp[];
  }>;
  onExcludeChange: (rowIndex: number, exclude: boolean) => void;
  excludedRows: number[];
}

export default function DuplicateReview({ 
  duplicates, 
  onExcludeChange, 
  excludedRows 
}: DuplicateReviewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="h-5 w-5 text-orange-500" />
        <h4 className="text-lg font-medium text-foreground">
          Potential Duplicates Found
        </h4>
        <Badge variant="secondary">{duplicates.length} items</Badge>
      </div>
      
      <p className="text-sm text-muted-foreground mb-6">
        We found {duplicates.length} potential duplicate(s) in your data. 
        Review each item below and decide whether to include or exclude it from the import.
        Items could be duplicates but have different states, years, or other details.
      </p>

      <div className="space-y-6 max-h-96 overflow-y-auto">
        {duplicates.map((duplicate, index) => (
          <Card key={`duplicate-${duplicate.rowIndex}`} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  id={`exclude-${duplicate.rowIndex}`}
                  checked={excludedRows.includes(duplicate.rowIndex)}
                  onCheckedChange={(checked) => onExcludeChange(duplicate.rowIndex, !!checked)}
                  data-testid={`checkbox-exclude-${duplicate.rowIndex}`}
                />
                <div>
                  <label 
                    htmlFor={`exclude-${duplicate.rowIndex}`}
                    className="text-sm font-medium text-foreground cursor-pointer"
                  >
                    {excludedRows.includes(duplicate.rowIndex) ? 'Exclude from import' : 'Include in import'}
                  </label>
                  <p className="text-xs text-muted-foreground">Row {duplicate.rowIndex + 1}</p>
                </div>
              </div>
              
              {excludedRows.includes(duplicate.rowIndex) ? (
                <X className="h-4 w-4 text-destructive" />
              ) : (
                <Check className="h-4 w-4 text-accent" />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* New Data */}
              <div>
                <h5 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  New Data (from file)
                </h5>
                <div className="space-y-1 text-sm">
                  <div><strong>Marina:</strong> {duplicate.rowData.marina}</div>
                  {duplicate.rowData.state && <div><strong>State:</strong> {duplicate.rowData.state}</div>}
                  {duplicate.rowData.saleYear && <div><strong>Sale Year:</strong> {duplicate.rowData.saleYear}</div>}
                  {duplicate.rowData.salePrice && (
                    <div><strong>Sale Price:</strong> {formatCurrency(duplicate.rowData.salePrice)}</div>
                  )}
                  {duplicate.rowData.wetSlips && <div><strong>Wet Slips:</strong> {formatNumber(duplicate.rowData.wetSlips)}</div>}
                </div>
              </div>

              {/* Existing Data */}
              <div>
                <h5 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                  Existing Data ({duplicate.existingComps.length} match{duplicate.existingComps.length > 1 ? 'es' : ''})
                </h5>
                <div className="space-y-3 max-h-32 overflow-y-auto">
                  {duplicate.existingComps.map((comp, compIndex) => (
                    <div key={comp.id} className="text-sm border-l-2 border-orange-200 pl-2">
                      <div><strong>Marina:</strong> {comp.marina}</div>
                      {comp.state && <div><strong>State:</strong> {comp.state}</div>}
                      {comp.saleYear && <div><strong>Sale Year:</strong> {comp.saleYear}</div>}
                      {comp.salePrice && (
                        <div><strong>Sale Price:</strong> {formatCurrency(comp.salePrice)}</div>
                      )}
                      {comp.wetSlips && <div><strong>Wet Slips:</strong> {formatNumber(comp.wetSlips)}</div>}
                      {compIndex < duplicate.existingComps.length - 1 && (
                        <hr className="my-2 border-muted" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <div className="text-sm text-muted-foreground">
          {excludedRows.length} of {duplicates.length} duplicates will be excluded
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => duplicates.forEach(d => onExcludeChange(d.rowIndex, true))}
            data-testid="button-exclude-all"
          >
            Exclude All
          </Button>
          <Button
            variant="outline"  
            size="sm"
            onClick={() => duplicates.forEach(d => onExcludeChange(d.rowIndex, false))}
            data-testid="button-include-all"
          >
            Include All
          </Button>
        </div>
      </div>
    </div>
  );
}
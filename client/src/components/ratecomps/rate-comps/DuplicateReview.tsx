import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, X, Check } from "lucide-react";
import { formatCurrency, formatNumber } from '@/lib/ratecomps/format';
import type { RateComp } from "@shared/schema";

interface DuplicateReviewProps {
  duplicates: Array<{
    rowIndex: number;
    rowData: any;
    existingComps: RateComp[];
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
    <div className="space-y-6">
      <div className="space-y-4">
        {duplicates.map((duplicate, index) => {
          const isExcluded = excludedRows.includes(duplicate.rowIndex);
          
          return (
            <Card key={`duplicate-${duplicate.rowIndex}`} className={`p-4 border-2 ${isExcluded ? 'border-destructive/50 bg-destructive/5' : 'border-blue-500/30 bg-blue-500/5'}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-muted-foreground">ROW {duplicate.rowIndex + 1}</span>
                    {isExcluded ? (
                      <Badge variant="destructive" className="text-xs">
                        <X className="h-3 w-3 mr-1" />
                        Will be skipped
                      </Badge>
                    ) : (
                      <Badge className="text-xs bg-blue-600">
                        <Check className="h-3 w-3 mr-1" />
                        Will be imported
                      </Badge>
                    )}
                  </div>
                  <h5 className="text-base font-semibold text-foreground">{duplicate.rowData.marina}</h5>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* New Data */}
                <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h6 className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2 uppercase">
                    📄 New Upload
                  </h6>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Marina:</span>
                      <span className="font-medium">{duplicate.rowData.marina || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">City:</span>
                      <span className="font-medium">{duplicate.rowData.city || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">State:</span>
                      <span className="font-medium">{duplicate.rowData.state || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sale Month:</span>
                      <span className="font-medium">{duplicate.rowData.saleMonth || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sale Year:</span>
                      <span className="font-medium">{duplicate.rowData.saleYear || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Existing Data */}
                <div className="bg-orange-50 dark:bg-orange-950/30 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
                  <h6 className="text-xs font-semibold text-orange-700 dark:text-orange-300 mb-2 uppercase">
                    ⚠️ Already in Database ({duplicate.existingComps.length})
                  </h6>
                  <div className="space-y-3 max-h-40 overflow-y-auto">
                    {duplicate.existingComps.map((comp, compIndex) => (
                      <div key={comp.id} className="text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Marina:</span>
                          <span className="font-medium">{comp.marina || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">City:</span>
                          <span className="font-medium">{comp.city || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">State:</span>
                          <span className="font-medium">{comp.state || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Sale Month:</span>
                          <span className="font-medium">{comp.saleMonth || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Sale Year:</span>
                          <span className="font-medium">{comp.saleYear || '—'}</span>
                        </div>
                        {compIndex < duplicate.existingComps.length - 1 && (
                          <hr className="my-2 border-orange-300 dark:border-orange-700" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Choose what to do with this potential duplicate:
                </p>
                <div className="flex gap-2">
                  <Button
                    variant={isExcluded ? "outline" : "default"}
                    size="sm"
                    onClick={() => onExcludeChange(duplicate.rowIndex, false)}
                    className={!isExcluded ? "bg-blue-600 hover:bg-blue-700" : ""}
                    data-testid={`button-accept-${duplicate.rowIndex}`}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Import Anyway
                  </Button>
                  <Button
                    variant={isExcluded ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => onExcludeChange(duplicate.rowIndex, true)}
                    data-testid={`button-skip-${duplicate.rowIndex}`}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Skip This Row
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
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
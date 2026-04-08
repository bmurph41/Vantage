import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertTriangle, ChevronDown, RefreshCw, Plus, X, Check } from "lucide-react";
import type { ConflictRecord } from "./DataImportWizard";

interface ConflictResolutionStepProps {
  conflicts: ConflictRecord[];
  onResolutionChange: (conflicts: ConflictRecord[]) => void;
}

export function ConflictResolutionStep({
  conflicts,
  onResolutionChange,
}: ConflictResolutionStepProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  const handleActionChange = (index: number, action: ConflictRecord['action']) => {
    const updated = [...conflicts];
    updated[index] = { ...updated[index], action };
    onResolutionChange(updated);
  };

  const setAllActions = (action: ConflictRecord['action']) => {
    const updated = conflicts.map(c => ({ ...c, action }));
    onResolutionChange(updated);
  };

  const stats = {
    total: conflicts.length,
    update: conflicts.filter(c => c.action === 'update').length,
    skip: conflicts.filter(c => c.action === 'skip').length,
    add: conflicts.filter(c => c.action === 'add').length,
  };

  if (conflicts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <Check className="h-6 w-6 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold">No Conflicts Found</h3>
        <p className="text-muted-foreground mt-2">
          All records are new and ready to be imported.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800">
                {conflicts.length} potential matches found
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                Some records in your file may already exist in the database.
                Choose how to handle each conflict below.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            <RefreshCw className="h-3 w-3 mr-1" />
            {stats.update} update
          </Badge>
          <Badge variant="outline">
            <X className="h-3 w-3 mr-1" />
            {stats.skip} skip
          </Badge>
          <Badge variant="outline">
            <Plus className="h-3 w-3 mr-1" />
            {stats.add} add anyway
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setAllActions('update')}>
            Update All
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAllActions('skip')}>
            Skip All
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAllActions('add')}>
            Add All
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-3 pr-4">
          {conflicts.map((conflict, index) => (
            <Collapsible
              key={index}
              open={expandedIndex === index}
              onOpenChange={() => setExpandedIndex(expandedIndex === index ? null : index)}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${
                            expandedIndex === index ? 'rotate-180' : ''
                          }`}
                        />
                        <div>
                          <CardTitle className="text-sm font-medium">
                            Row {conflict.rowIndex + 1}: {conflict.matchValue}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            Matched on: {conflict.matchField}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          conflict.action === 'update'
                            ? 'default'
                            : conflict.action === 'skip'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {conflict.action}
                      </Badge>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm font-medium mb-2">Your Data (New)</p>
                        <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                          {Object.entries(conflict.sourceData).slice(0, 5).map(([key, value]) => (
                            <div key={key} className="flex">
                              <span className="text-muted-foreground w-24 flex-shrink-0">{key}:</span>
                              <span className="truncate">{String(value) || '—'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {conflict.existingRecord && (
                        <div>
                          <p className="text-sm font-medium mb-2">Existing Record</p>
                          <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                            {Object.entries(conflict.existingRecord).slice(0, 5).map(([key, value]) => (
                              <div key={key} className="flex">
                                <span className="text-muted-foreground w-24 flex-shrink-0">{key}:</span>
                                <span className="truncate">{String(value) || '—'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <RadioGroup
                      value={conflict.action}
                      onValueChange={(value) => handleActionChange(index, value as ConflictRecord['action'])}
                      className="flex gap-6"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="update" id={`update-${index}`} />
                        <Label htmlFor={`update-${index}`} className="cursor-pointer">
                          <span className="font-medium">Update</span>
                          <span className="text-muted-foreground ml-1">existing record</span>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="skip" id={`skip-${index}`} />
                        <Label htmlFor={`skip-${index}`} className="cursor-pointer">
                          <span className="font-medium">Skip</span>
                          <span className="text-muted-foreground ml-1">this row</span>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="add" id={`add-${index}`} />
                        <Label htmlFor={`add-${index}`} className="cursor-pointer">
                          <span className="font-medium">Add anyway</span>
                          <span className="text-muted-foreground ml-1">as new</span>
                        </Label>
                      </div>
                    </RadioGroup>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

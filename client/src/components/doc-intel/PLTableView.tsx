import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Check, AlertTriangle, DollarSign, Percent } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PLLineItem {
  id: string;
  description: string;
  subcategory: string;
  amount: number;
  confidence: number;
  period?: { year: number; month?: number };
  sourceText?: string;
}

interface PLCategory {
  name: string;
  type: 'Revenue' | 'COGS' | 'Expenses' | 'Other';
  items: PLLineItem[];
  subtotal: number;
}

interface StructuredPLData {
  categories: PLCategory[];
  periods: Array<{ label: string; year: number; month?: number }>;
  totals: { revenue: number; cogs: number; expenses: number; netIncome: number };
  metadata: { documentType: string; companyName?: string; currency?: string };
}

interface PLTableViewProps {
  resultId: string;
  onItemConfirm?: (itemId: string, categoryId: string) => void;
  onItemReject?: (itemId: string) => void;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const getCategoryColor = (type: string): string => {
  switch (type) {
    case 'Revenue':
      return 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800';
    case 'COGS':
      return 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800';
    case 'Expenses':
      return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800';
    default:
      return 'bg-gray-50 dark:bg-gray-950/30 border-gray-200 dark:border-gray-800';
  }
};

const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 0.9) return 'text-green-600 dark:text-green-400';
  if (confidence >= 0.7) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
};

export function PLTableView({ resultId, onItemConfirm, onItemReject }: PLTableViewProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Revenue', 'COGS', 'Expenses', 'Other']));

  const { data, isLoading, error } = useQuery<StructuredPLData>({
    queryKey: ['/api/modeling/document-intelligence', resultId, 'structured'],
  });

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-red-200 dark:border-red-800">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            <span>Failed to load P&L data. Please try again.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const periodColumns = data.periods.length > 0 ? data.periods : [{ label: 'Amount', year: new Date().getFullYear() }];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              P&L Statement
              {data.metadata.companyName && (
                <span className="text-muted-foreground font-normal">- {data.metadata.companyName}</span>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              {data.categories.reduce((sum, cat) => sum + cat.items.length, 0)} line items extracted
            </CardDescription>
          </div>
          <div className="flex gap-2 text-sm">
            <Badge variant="outline" className="bg-green-50 dark:bg-green-950">
              Revenue: {formatCurrency(data.totals.revenue)}
            </Badge>
            <Badge variant="outline" className="bg-orange-50 dark:bg-orange-950">
              COGS: {formatCurrency(data.totals.cogs)}
            </Badge>
            <Badge variant="outline" className="bg-red-50 dark:bg-red-950">
              Expenses: {formatCurrency(data.totals.expenses)}
            </Badge>
            <Badge variant="outline" className={data.totals.netIncome >= 0 ? "bg-blue-50 dark:bg-blue-950" : "bg-red-50 dark:bg-red-950"}>
              Net: {formatCurrency(data.totals.netIncome)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12"></TableHead>
                <TableHead className="w-[200px]">Category</TableHead>
                <TableHead className="w-[150px]">Department</TableHead>
                <TableHead>Line Item</TableHead>
                {periodColumns.map((period, idx) => (
                  <TableHead key={idx} className="text-right w-[120px]">{period.label}</TableHead>
                ))}
                <TableHead className="text-right w-[80px]">Confidence</TableHead>
                {(onItemConfirm || onItemReject) && (
                  <TableHead className="w-[100px]">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.categories.map((category) => (
                <>
                  <TableRow 
                    key={`cat-${category.name}`}
                    className={cn(
                      "cursor-pointer hover:bg-muted/50 font-medium",
                      getCategoryColor(category.type)
                    )}
                    onClick={() => toggleCategory(category.name)}
                    data-testid={`category-row-${category.type}`}
                  >
                    <TableCell>
                      {expandedCategories.has(category.name) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </TableCell>
                    <TableCell colSpan={2} className="font-semibold">
                      {category.name}
                      <span className="ml-2 text-muted-foreground font-normal">
                        ({category.items.length} items)
                      </span>
                    </TableCell>
                    <TableCell></TableCell>
                    {periodColumns.map((_, idx) => (
                      <TableCell key={idx} className="text-right font-semibold">
                        {formatCurrency(category.subtotal)}
                      </TableCell>
                    ))}
                    <TableCell></TableCell>
                    {(onItemConfirm || onItemReject) && <TableCell></TableCell>}
                  </TableRow>
                  
                  {expandedCategories.has(category.name) && category.items.map((item, itemIdx) => (
                    <TableRow 
                      key={item.id}
                      className="hover:bg-muted/30"
                      data-testid={`item-row-${item.id}`}
                    >
                      <TableCell></TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {category.name}
                      </TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="outline" className="text-xs">
                          {item.subcategory || 'Uncategorized'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-md">
                          <span className="text-sm">{item.description}</span>
                          {item.sourceText && item.sourceText !== item.description && (
                            <span className="text-xs text-muted-foreground block truncate" title={item.sourceText}>
                              Source: {item.sourceText}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      {periodColumns.map((_, idx) => (
                        <TableCell key={idx} className="text-right font-mono text-sm">
                          {formatCurrency(item.amount)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <span className={cn("text-sm flex items-center justify-end gap-1", getConfidenceColor(item.confidence))}>
                          <Percent className="h-3 w-3" />
                          {Math.round(item.confidence * 100)}
                        </span>
                      </TableCell>
                      {(onItemConfirm || onItemReject) && (
                        <TableCell>
                          <div className="flex gap-1">
                            {onItemConfirm && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-100"
                                onClick={() => onItemConfirm(item.id, category.type)}
                                data-testid={`confirm-${item.id}`}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </>
              ))}
              
              <TableRow className="bg-muted font-bold border-t-2">
                <TableCell></TableCell>
                <TableCell colSpan={2}>Net Income</TableCell>
                <TableCell></TableCell>
                {periodColumns.map((_, idx) => (
                  <TableCell key={idx} className={cn(
                    "text-right font-mono",
                    data.totals.netIncome >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  )}>
                    {formatCurrency(data.totals.netIncome)}
                  </TableCell>
                ))}
                <TableCell></TableCell>
                {(onItemConfirm || onItemReject) && <TableCell></TableCell>}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

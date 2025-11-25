import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import {
  Save,
  TrendingUp,
  Percent,
  DollarSign,
  AlertCircle,
  Info,
  Anchor,
  Warehouse,
  Ship,
  Fuel,
  ShoppingCart
} from 'lucide-react';

interface WorkspaceAssumptionsProps {
  projectId: string;
}

type GrowthRates = Record<string, number>;
type OccupancyData = Record<string, Record<string, number>>; // departmentId -> year -> rate
type MarginData = Record<string, { historical: number; projected: number }>;

const revenueCategories = [
  { id: 'wet_slips', name: 'Wet Slips', icon: <Anchor className="h-4 w-4" /> },
  { id: 'dry_storage', name: 'Dry Storage', icon: <Warehouse className="h-4 w-4" /> },
  { id: 'annual_storage', name: 'Annual Storage', icon: <Warehouse className="h-4 w-4" /> },
  { id: 'rental_boats', name: 'Rental Boats', icon: <Ship className="h-4 w-4" /> },
  { id: 'fuel', name: 'Fuel Sales', icon: <Fuel className="h-4 w-4" /> },
  { id: 'ship_store', name: 'Ship Store', icon: <ShoppingCart className="h-4 w-4" /> },
  { id: 'service_repair', name: 'Service & Repair' },
  { id: 'third_party_leases', name: 'Third-Party Leases' },
  { id: 'other_revenue', name: 'Other Revenue' },
];

const expenseCategories = [
  { id: 'payroll', name: 'Payroll & Benefits' },
  { id: 'utilities', name: 'Utilities' },
  { id: 'insurance', name: 'Insurance' },
  { id: 'repairs_maintenance', name: 'Repairs & Maintenance' },
  { id: 'marketing', name: 'Marketing' },
  { id: 'professional_fees', name: 'Professional Fees' },
  { id: 'property_taxes', name: 'Property Taxes' },
  { id: 'management_fees', name: 'Management Fees' },
  { id: 'other_expenses', name: 'Other Expenses' },
];

const storageOptions = [
  { id: 'wet_slips', name: 'Wet Slips', totalUnits: 150 },
  { id: 'dry_racks', name: 'Dry Racks', totalUnits: 200 },
  { id: 'covered_slips', name: 'Covered Slips', totalUnits: 50 },
  { id: 'mooring_balls', name: 'Mooring Balls', totalUnits: 25 },
];

export default function WorkspaceAssumptions({ projectId }: WorkspaceAssumptionsProps) {
  const { toast } = useToast();

  const { data: assumptions, isLoading } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'assumptions'],
  });

  const { data: config } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'config'],
  });

  const holdPeriod = config?.holdPeriod || 5;
  const years = Array.from({ length: holdPeriod }, (_, i) => 2026 + i);

  const [growthRates, setGrowthRates] = useState<GrowthRates>({});
  const [expenseGrowth, setExpenseGrowth] = useState<GrowthRates>({});
  const [occupancy, setOccupancy] = useState<OccupancyData>({});
  const [margins, setMargins] = useState<MarginData>({});

  useEffect(() => {
    if (assumptions) {
      setGrowthRates(assumptions.growthRates || {});
      setExpenseGrowth(assumptions.expenseGrowth || {});
      setOccupancy(assumptions.occupancy || {});
      setMargins(assumptions.margins || {});
    } else {
      const defaultGrowth: GrowthRates = {};
      revenueCategories.forEach(cat => { defaultGrowth[cat.id] = 3; });
      setGrowthRates(defaultGrowth);

      const defaultExpenseGrowth: GrowthRates = {};
      expenseCategories.forEach(cat => { defaultExpenseGrowth[cat.id] = 2; });
      setExpenseGrowth(defaultExpenseGrowth);

      const defaultOccupancy: OccupancyData = {};
      storageOptions.forEach(opt => {
        defaultOccupancy[opt.id] = {};
        years.forEach(year => {
          defaultOccupancy[opt.id][year] = 85;
        });
      });
      setOccupancy(defaultOccupancy);

      const defaultMargins: MarginData = {
        fuel: { historical: 15, projected: 18 },
        ship_store: { historical: 35, projected: 38 },
      };
      setMargins(defaultMargins);
    }
  }, [assumptions, holdPeriod]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', `/api/modeling/projects/${projectId}/assumptions`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'assumptions'] });
      toast({ title: 'Saved', description: 'Assumptions have been saved.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save assumptions.', variant: 'destructive' });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      growthRates,
      expenseGrowth,
      occupancy,
      margins,
    });
  };

  const updateGrowthRate = (categoryId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setGrowthRates(prev => ({ ...prev, [categoryId]: numValue }));
  };

  const updateExpenseGrowth = (categoryId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setExpenseGrowth(prev => ({ ...prev, [categoryId]: numValue }));
  };

  const updateOccupancy = (storageId: string, year: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    setOccupancy(prev => ({
      ...prev,
      [storageId]: {
        ...prev[storageId],
        [year]: Math.min(100, Math.max(0, numValue)),
      },
    }));
  };

  const updateMargin = (categoryId: string, field: 'historical' | 'projected', value: string) => {
    const numValue = parseFloat(value) || 0;
    setMargins(prev => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        [field]: Math.min(100, Math.max(0, numValue)),
      },
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Assumptions</h2>
          <p className="text-sm text-muted-foreground">
            Configure growth rates, occupancy projections, and COGS margins
          </p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saveMutation.isPending}
          data-testid="button-save-assumptions"
        >
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? 'Saving...' : 'Save Assumptions'}
        </Button>
      </div>

      <Tabs defaultValue="growth" className="space-y-4">
        <TabsList>
          <TabsTrigger value="growth" data-testid="tab-growth">
            <TrendingUp className="h-4 w-4 mr-2" />
            Growth Rates
          </TabsTrigger>
          <TabsTrigger value="occupancy" data-testid="tab-occupancy">
            <Percent className="h-4 w-4 mr-2" />
            Occupancy
          </TabsTrigger>
          <TabsTrigger value="margins" data-testid="tab-margins">
            <DollarSign className="h-4 w-4 mr-2" />
            COGS Margins
          </TabsTrigger>
        </TabsList>

        <TabsContent value="growth" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Growth Rates</CardTitle>
              <CardDescription>
                Annual percentage increase applied to trailing 12-month actuals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {revenueCategories.map((category) => (
                  <div key={category.id} className="space-y-2">
                    <Label htmlFor={`growth-${category.id}`} className="flex items-center gap-2">
                      {category.icon}
                      {category.name}
                    </Label>
                    <div className="relative">
                      <Input
                        id={`growth-${category.id}`}
                        type="number"
                        step="0.1"
                        value={growthRates[category.id] ?? 3}
                        onChange={(e) => updateGrowthRate(category.id, e.target.value)}
                        className="pr-8"
                        data-testid={`input-growth-${category.id}`}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        %
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Expense Growth Rates</CardTitle>
              <CardDescription>
                Annual percentage increase for operating expenses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {expenseCategories.map((category) => (
                  <div key={category.id} className="space-y-2">
                    <Label htmlFor={`expense-${category.id}`}>{category.name}</Label>
                    <div className="relative">
                      <Input
                        id={`expense-${category.id}`}
                        type="number"
                        step="0.1"
                        value={expenseGrowth[category.id] ?? 2}
                        onChange={(e) => updateExpenseGrowth(category.id, e.target.value)}
                        className="pr-8"
                        data-testid={`input-expense-${category.id}`}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        %
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="occupancy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Occupancy Projections by Storage Type</CardTitle>
              <CardDescription>
                Set occupancy rates for each storage option across the hold period. 
                This drives storage revenue projections.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-48">Storage Type</TableHead>
                      <TableHead className="w-24 text-right">Units</TableHead>
                      {years.map(year => (
                        <TableHead key={year} className="text-center w-24">{year}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {storageOptions.map((storage) => (
                      <TableRow key={storage.id}>
                        <TableCell className="font-medium">{storage.name}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {storage.totalUnits}
                        </TableCell>
                        {years.map(year => (
                          <TableCell key={year} className="p-1">
                            <div className="relative">
                              <Input
                                type="number"
                                step="1"
                                min="0"
                                max="100"
                                value={occupancy[storage.id]?.[year] ?? 85}
                                onChange={(e) => updateOccupancy(storage.id, year, e.target.value)}
                                className="w-full text-center pr-6"
                                data-testid={`input-occupancy-${storage.id}-${year}`}
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                %
                              </span>
                            </div>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="margins" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>COGS Margins</CardTitle>
              <CardDescription>
                Set gross profit margins for departments with cost of goods sold. 
                COGS is calculated as (1 - Margin%) × Revenue.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {['fuel', 'ship_store'].map((categoryId) => {
                  const category = revenueCategories.find(c => c.id === categoryId);
                  const margin = margins[categoryId] || { historical: 0, projected: 0 };
                  
                  return (
                    <div key={categoryId} className="p-4 rounded-lg border space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {category?.icon}
                          <span className="font-medium">{category?.name}</span>
                        </div>
                      </div>
                      
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Info className="h-3 w-3 text-muted-foreground" />
                            Historical Average
                          </Label>
                          <div className="relative">
                            <Input
                              type="number"
                              step="0.1"
                              value={margin.historical}
                              onChange={(e) => updateMargin(categoryId, 'historical', e.target.value)}
                              className="pr-8"
                              data-testid={`input-margin-historical-${categoryId}`}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              %
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Based on actual P&L data
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Projected Margin</Label>
                          <div className="relative">
                            <Input
                              type="number"
                              step="0.1"
                              value={margin.projected}
                              onChange={(e) => updateMargin(categoryId, 'projected', e.target.value)}
                              className="pr-8"
                              data-testid={`input-margin-projected-${categoryId}`}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              %
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Applied to Pro Forma projections
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          COGS = Revenue × (1 - {margin.projected || 0}%) = Revenue × {((100 - (margin.projected || 0)) / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

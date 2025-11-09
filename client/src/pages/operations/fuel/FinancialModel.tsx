import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useProjectionCalculator } from "@/hooks/use-projection-calculator";
import { 
  Calculator, 
  TrendingUp, 
  Plus,
  DollarSign,
  BarChart3,
  PieChart,
  Trash2
} from "lucide-react";

const projectionSchema = z.object({
  month: z.string().min(1, "Please select a month"),
  year: z.string().min(1, "Please enter a year"),
  growthRate: z.string().min(1, "Please enter growth rate").refine((val) => parseFloat(val) >= -100, "Growth rate must be valid"),
});

type FinancialProjection = {
  id: string;
  month: number;
  year: number;
  projectedRevenue: string;
  projectedGallons: string;
  projectedCosts: string;
  growthRate: string;
  createdAt: string;
};

export default function FinancialModel() {
  const [isAddProjectionOpen, setIsAddProjectionOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const calculator = useProjectionCalculator();

  const form = useForm<z.infer<typeof projectionSchema>>({
    resolver: zodResolver(projectionSchema),
    defaultValues: {
      month: "",
      year: new Date().getFullYear().toString(),
      growthRate: "0",
    },
  });

  useEffect(() => {
    if (!isAddProjectionOpen) {
      calculator.reset();
      form.reset({
        month: "",
        year: new Date().getFullYear().toString(),
        growthRate: "0",
      });
    }
  }, [isAddProjectionOpen]);

  const { data: projections = [], isLoading } = useQuery<FinancialProjection[]>({
    queryKey: ['/api/operations/fuel-projections'],
  });

  const createProjectionMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/operations/fuel-projections", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/operations/fuel-projections'] });
      toast({
        title: "Success",
        description: "Financial projection added successfully!",
      });
      calculator.reset();
      form.reset({
        month: "",
        year: new Date().getFullYear().toString(),
        growthRate: "0",
      });
      setIsAddProjectionOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create projection",
        variant: "destructive",
      });
    },
  });

  const deleteProjectionMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/operations/fuel-projections/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/operations/fuel-projections'] });
      toast({
        title: "Success",
        description: "Projection deleted successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete projection",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof projectionSchema>) => {
    if (!calculator.values.revenue || !calculator.values.gallons || !calculator.values.costs) {
      toast({
        title: "Validation Error",
        description: "Please fill in all financial fields (Revenue, Gallons, Costs, or Profit Margin)",
        variant: "destructive",
      });
      return;
    }

    const projectionData = {
      month: parseInt(data.month),
      year: parseInt(data.year),
      projectedRevenue: calculator.values.revenue,
      projectedGallons: calculator.values.gallons,
      projectedCosts: calculator.values.costs,
      growthRate: data.growthRate,
    };

    createProjectionMutation.mutate(projectionData);
  };

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear + i);

  // Calculate summary metrics
  const totalProjectedRevenue = projections.reduce((sum, p) => sum + parseFloat(p.projectedRevenue), 0);
  const totalProjectedGallons = projections.reduce((sum, p) => sum + parseFloat(p.projectedGallons), 0);
  const avgGrowthRate = projections.length 
    ? projections.reduce((sum, p) => sum + parseFloat(p.growthRate), 0) / projections.length
    : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <>
      <Header 
        title="Financial Projections"
        subtitle="Create revenue projections and forecast growth"
      />

      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Total Projected Revenue</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="total-projected-revenue">
                    ${totalProjectedRevenue.toLocaleString()}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Total Projected Gallons</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="total-projected-gallons">
                    {totalProjectedGallons.toLocaleString()}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Average Growth Rate</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="avg-growth-rate">
                    {avgGrowthRate.toFixed(1)}%
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Projections Created</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="projections-count">
                    {projections.length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                  <PieChart className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add Projection Button */}
        {!isAddProjectionOpen && (
          <div className="flex justify-end">
            <Button 
              onClick={() => setIsAddProjectionOpen(true)}
              data-testid="button-add-projection"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Projection
            </Button>
          </div>
        )}

        {/* Add New Projection Form */}
        {isAddProjectionOpen && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center" data-testid="add-projection-title">
                <Calculator className="w-5 h-5 mr-2" />
                Add Financial Projection
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="month"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Month</FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger data-testid="select-projection-month">
                                <SelectValue placeholder="Select month" />
                              </SelectTrigger>
                              <SelectContent>
                                {months.map((month, index) => (
                                  <SelectItem key={month} value={(index + 1).toString()}>
                                    {month}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="year"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Year</FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger data-testid="select-projection-year">
                                <SelectValue placeholder="Select year" />
                              </SelectTrigger>
                              <SelectContent>
                                {years.map((year) => (
                                  <SelectItem key={year} value={year.toString()}>
                                    {year}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div>
                      <label className="text-sm font-medium mb-1 block">Projected Revenue</label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="25000"
                        value={calculator.values.revenue}
                        onChange={(e) => calculator.updateField('revenue', e.target.value)}
                        data-testid="input-projected-revenue"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1 block">Projected Gallons</label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="6000"
                        value={calculator.values.gallons}
                        onChange={(e) => calculator.updateField('gallons', e.target.value)}
                        data-testid="input-projected-gallons"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Projected Costs</label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="7000"
                        value={calculator.values.costs}
                        onChange={(e) => calculator.updateField('costs', e.target.value)}
                        data-testid="input-projected-costs"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1 block">
                        Profit Margin (%)
                        <span className="ml-1 text-xs text-muted-foreground">Editable</span>
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="15"
                        value={calculator.values.profitMargin}
                        onChange={(e) => calculator.updateField('profitMargin', e.target.value)}
                        data-testid="input-profit-margin"
                        className="border-green-300 focus:border-green-500"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {calculator.values.profitMargin && parseFloat(calculator.values.profitMargin) > 0 
                          ? `${parseFloat(calculator.values.profitMargin).toFixed(1)}% margin` 
                          : 'Enter margin or let it calculate'}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1 block">
                        Avg Price/Gal
                        <span className="ml-1 text-xs text-muted-foreground">Editable</span>
                      </label>
                      <Input
                        type="number"
                        step="0.001"
                        placeholder="4.167"
                        value={calculator.values.avgPricePerGallon}
                        onChange={(e) => calculator.updateField('avgPricePerGallon', e.target.value)}
                        data-testid="input-avg-price-per-gallon"
                        className="border-blue-300 focus:border-blue-500"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {calculator.values.avgPricePerGallon && parseFloat(calculator.values.avgPricePerGallon) > 0 
                          ? `$${parseFloat(calculator.values.avgPricePerGallon).toFixed(3)}/gal` 
                          : 'Enter price or let it calculate'}
                      </p>
                    </div>

                    <FormField
                      control={form.control}
                      name="growthRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Growth Rate (%)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.1"
                              placeholder="0"
                              {...field}
                              data-testid="input-growth-rate"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddProjectionOpen(false)}
                      data-testid="button-cancel-projection"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createProjectionMutation.isPending}
                      data-testid="button-save-projection"
                    >
                      {createProjectionMutation.isPending ? "Saving..." : "Save Projection"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Projections List */}
        <Card>
          <CardHeader>
            <CardTitle data-testid="projections-table-title">Financial Projections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Period</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Revenue</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Gallons</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Costs</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Profit</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Margin</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Growth</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {projections.map((projection, index) => {
                    const revenue = parseFloat(projection.projectedRevenue);
                    const costs = parseFloat(projection.projectedCosts);
                    const profit = revenue - costs;
                    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

                    return (
                      <tr key={projection.id} className="hover:bg-muted/30">
                        <td className="p-4 text-sm font-medium text-foreground" data-testid={`projection-period-${index}`}>
                          {months[projection.month - 1]} {projection.year}
                        </td>
                        <td className="p-4 text-sm text-foreground" data-testid={`projection-revenue-${index}`}>
                          ${revenue.toLocaleString()}
                        </td>
                        <td className="p-4 text-sm text-foreground" data-testid={`projection-gallons-${index}`}>
                          {parseFloat(projection.projectedGallons).toLocaleString()}
                        </td>
                        <td className="p-4 text-sm text-foreground" data-testid={`projection-costs-${index}`}>
                          ${costs.toLocaleString()}
                        </td>
                        <td className="p-4 text-sm font-medium text-foreground" data-testid={`projection-profit-${index}`}>
                          ${profit.toLocaleString()}
                        </td>
                        <td className="p-4 text-sm text-foreground" data-testid={`projection-margin-${index}`}>
                          {margin.toFixed(1)}%
                        </td>
                        <td className="p-4 text-sm text-foreground" data-testid={`projection-growth-${index}`}>
                          {parseFloat(projection.growthRate).toFixed(1)}%
                        </td>
                        <td className="p-4 text-sm">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteProjectionMutation.mutate(projection.id)}
                            disabled={deleteProjectionMutation.isPending}
                            data-testid={`button-delete-projection-${index}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {projections.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Calculator className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No projections yet. Add your first projection to get started.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

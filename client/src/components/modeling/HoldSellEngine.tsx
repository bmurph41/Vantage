import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Home,
  DollarSign,
  Calculator,
} from 'lucide-react';

interface ModelingProjectData {
  id: string;
  purchasePrice?: number | string;
  year1CapRate?: number | string;
  customMetrics?: {
    config?: {
      NOI?: number | string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  [key: string]: any;
}

interface HoldSellEngineProps {
  projectId: string;
}

interface YearAnalysis {
  year: number;
  noi: number;
  cumulativeNOI: number;
  propertyValue: number;
  netSellProceeds: number;
  holdValue: number;
  cumulativeHoldValue: number;
  recommendation: 'Hold' | 'Sell';
  breakeven: boolean;
}

export function HoldSellEngine({ projectId }: HoldSellEngineProps) {
  // Fetch modeling project data
  const { data: projectData, isLoading: isLoadingProject } = useQuery<ModelingProjectData>({
    queryKey: ['/api/analytics/modeling/projects', projectId],
  });

  const defaultPropertyValue = projectData
    ? Number(projectData.purchasePrice || 0)
    : 0;
  const defaultNOI = projectData?.customMetrics?.config?.NOI
    ? Number(projectData.customMetrics.config.NOI)
    : 0;
  const defaultCapRate = projectData?.year1CapRate
    ? Number(projectData.year1CapRate)
    : 0.075;

  const [propertyValue, setPropertyValue] = useState<number>(0);
  const [annualNOI, setAnnualNOI] = useState<number>(0);
  const [noiGrowthRate, setNoiGrowthRate] = useState<number>(3);
  const [propertyAppreciationRate, setPropertyAppreciationRate] = useState<number>(2);
  const [discountRate, setDiscountRate] = useState<number>(8);
  const [sellingCosts, setSellingCosts] = useState<number>(6);
  const [annualHoldingCosts, setAnnualHoldingCosts] = useState<number>(0);
  const [holdPeriodYears, setHoldPeriodYears] = useState<number>(15);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (projectData && !initialized) {
      if (defaultPropertyValue > 0) setPropertyValue(defaultPropertyValue);
      if (defaultNOI > 0) setAnnualNOI(defaultNOI);
      setInitialized(true);
    }
  }, [projectData, defaultPropertyValue, defaultNOI, initialized]);

  // Calculate analysis for each year
  const calculateAnalysis = (): YearAnalysis[] => {
    const analysis: YearAnalysis[] = [];
    let cumulativeNOI = 0;
    let cumulativeHoldValue = 0;
    let breakevenFound = false;

    const noiGrowth = noiGrowthRate / 100;
    const propertyAppreciation = propertyAppreciationRate / 100;
    const discount = discountRate / 100;
    const sellingCostsPct = sellingCosts / 100;

    for (let year = 1; year <= holdPeriodYears; year++) {
      // NOI for this year (growing)
      const yearlyNOI = annualNOI * Math.pow(1 + noiGrowth, year - 1);

      // Cumulative NOI minus holding costs
      cumulativeNOI += yearlyNOI - annualHoldingCosts;

      // Property value after appreciation
      const appreciatedPropertyValue =
        propertyValue * Math.pow(1 + propertyAppreciation, year);

      // Sell proceeds: Property value * (1 - selling costs %)
      const sellProceeds = appreciatedPropertyValue * (1 - sellingCostsPct);

      // Hold value calculation: NPV of remaining NOI stream
      // Terminal value = NOI at exit year / cap rate, discounted back
      const terminalNOI = yearlyNOI * Math.pow(1 + noiGrowth, 1);
      const capRate = defaultCapRate || 0.075;
      const terminalValue = terminalNOI / (capRate || 0.075);

      // Discount terminal value back to today
      const discountedTerminalValue = terminalValue / Math.pow(1 + discount, year);

      // Hold value is discounted cumulative NOI + discounted terminal value
      const holdValue = cumulativeNOI / Math.pow(1 + discount, year) + discountedTerminalValue;
      cumulativeHoldValue = holdValue;

      // Determine recommendation
      const breakeven = !breakevenFound && cumulativeNOI >= sellProceeds;
      if (breakeven) {
        breakevenFound = true;
      }

      const recommendation = cumulativeNOI >= sellProceeds ? 'Hold' : 'Sell';

      analysis.push({
        year,
        noi: yearlyNOI,
        cumulativeNOI,
        propertyValue: appreciatedPropertyValue,
        netSellProceeds: sellProceeds,
        holdValue,
        cumulativeHoldValue: holdValue,
        recommendation,
        breakeven,
      });
    }

    return analysis;
  };

  const analysis = calculateAnalysis();

  // Find breakeven year
  const breakevenYear = analysis.find((a) => a.breakeven)?.year || null;

  // Summary metrics
  const currentSellProceeds = analysis[0]?.netSellProceeds || 0;
  const totalHoldIncome = analysis.reduce((sum, a) => sum + a.noi, 0);
  const finalHoldValue = analysis[analysis.length - 1]?.cumulativeHoldValue || 0;

  // Chart data
  const chartData = analysis.map((item) => ({
    year: item.year,
    holdValue: Math.round(item.cumulativeHoldValue),
    sellProceeds: Math.round(item.netSellProceeds),
  }));

  const handleReset = () => {
    setPropertyValue(defaultPropertyValue);
    setAnnualNOI(defaultNOI);
    setNoiGrowthRate(3);
    setPropertyAppreciationRate(2);
    setDiscountRate(8);
    setSellingCosts(6);
    setAnnualHoldingCosts(0);
    setHoldPeriodYears(15);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (isLoadingProject) {
    return (
      <div className="space-y-4 p-4">
        <Card>
          <CardContent className="pt-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Input Assumptions Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Input Assumptions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Current property value */}
            <div className="space-y-2">
              <Label htmlFor="propertyValue" className="flex items-center gap-2">
                <Home className="w-4 h-4" />
                Current Property Value
              </Label>
              <Input
                id="propertyValue"
                type="number"
                value={propertyValue || ''}
                onChange={(e) => setPropertyValue(Number(e.target.value))}
                placeholder="$"
                className="font-mono"
              />
              <p className="text-xs text-gray-500">
                {formatCurrency(propertyValue)}
              </p>
            </div>

            {/* Annual NOI */}
            <div className="space-y-2">
              <Label htmlFor="annualNOI" className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Annual NOI
              </Label>
              <Input
                id="annualNOI"
                type="number"
                value={annualNOI || ''}
                onChange={(e) => setAnnualNOI(Number(e.target.value))}
                placeholder="$"
                className="font-mono"
              />
              <p className="text-xs text-gray-500">{formatCurrency(annualNOI)}</p>
            </div>

            {/* NOI growth rate */}
            <div className="space-y-2">
              <Label htmlFor="noiGrowth">NOI Growth Rate (%)</Label>
              <Input
                id="noiGrowth"
                type="number"
                value={noiGrowthRate}
                onChange={(e) => setNoiGrowthRate(Number(e.target.value))}
                step={0.1}
                placeholder="%"
                className="font-mono"
              />
              <p className="text-xs text-gray-500">{formatPercent(noiGrowthRate)}</p>
            </div>

            {/* Property appreciation rate */}
            <div className="space-y-2">
              <Label htmlFor="propertyAppreciation">
                Property Appreciation (%)
              </Label>
              <Input
                id="propertyAppreciation"
                type="number"
                value={propertyAppreciationRate}
                onChange={(e) => setPropertyAppreciationRate(Number(e.target.value))}
                step={0.1}
                placeholder="%"
                className="font-mono"
              />
              <p className="text-xs text-gray-500">
                {formatPercent(propertyAppreciationRate)}
              </p>
            </div>

            {/* Discount rate */}
            <div className="space-y-2">
              <Label htmlFor="discountRate">Discount Rate (%)</Label>
              <Input
                id="discountRate"
                type="number"
                value={discountRate}
                onChange={(e) => setDiscountRate(Number(e.target.value))}
                step={0.1}
                placeholder="%"
                className="font-mono"
              />
              <p className="text-xs text-gray-500">{formatPercent(discountRate)}</p>
            </div>

            {/* Selling costs */}
            <div className="space-y-2">
              <Label htmlFor="sellingCosts">Selling Costs (%)</Label>
              <Input
                id="sellingCosts"
                type="number"
                value={sellingCosts}
                onChange={(e) => setSellingCosts(Number(e.target.value))}
                step={0.1}
                placeholder="%"
                className="font-mono"
              />
              <p className="text-xs text-gray-500">
                {formatPercent(sellingCosts)}
              </p>
            </div>

            {/* Annual holding costs */}
            <div className="space-y-2">
              <Label htmlFor="holdingCosts">Annual Holding Costs</Label>
              <Input
                id="holdingCosts"
                type="number"
                value={annualHoldingCosts || ''}
                onChange={(e) => setAnnualHoldingCosts(Number(e.target.value))}
                placeholder="$"
                className="font-mono"
              />
              <p className="text-xs text-gray-500">
                {formatCurrency(annualHoldingCosts)}
              </p>
            </div>

            {/* Hold period */}
            <div className="space-y-2">
              <Label htmlFor="holdPeriod">Hold Period (Years)</Label>
              <Input
                id="holdPeriod"
                type="number"
                min={1}
                max={15}
                value={holdPeriodYears}
                onChange={(e) => setHoldPeriodYears(Number(e.target.value))}
                className="font-mono"
              />
              <p className="text-xs text-gray-500">{holdPeriodYears} years</p>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Reset to Defaults
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Breakeven Year</p>
              <p className="text-2xl font-bold">
                {breakevenYear ? `Year ${breakevenYear}` : 'N/A'}
              </p>
              <p className="text-xs text-gray-500">
                {breakevenYear
                  ? `Hold exceeds sell at year ${breakevenYear}`
                  : 'Selling is better throughout period'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-gray-600 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                Hold Recommendation
              </p>
              <p className="text-2xl font-bold">
                {breakevenYear ? 'Hold' : 'Sell'}
              </p>
              <p className="text-xs text-gray-500">
                {breakevenYear
                  ? `At year ${breakevenYear}`
                  : 'Throughout analysis period'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Total Hold Income</p>
              <p className="text-2xl font-bold">{formatCurrency(totalHoldIncome)}</p>
              <p className="text-xs text-gray-500">
                {holdPeriodYears}-year cumulative NOI
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Current Sell Proceeds</p>
              <p className="text-2xl font-bold">{formatCurrency(currentSellProceeds)}</p>
              <p className="text-xs text-gray-500">
                After {formatPercent(sellingCosts)} selling costs
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Hold vs Sell Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" label={{ value: 'Years', position: 'insideBottomRight', offset: -5 }} />
              <YAxis
                label={{ value: 'Value ($)', angle: -90, position: 'insideLeft' }}
                tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
              />
              <Tooltip
                formatter={(value) => [formatCurrency(value as number), '']}
                labelFormatter={(label) => `Year ${label}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="holdValue"
                stroke="#2563eb"
                dot={{ fill: '#2563eb' }}
                name="Cumulative Hold Value"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="sellProceeds"
                stroke="#dc2626"
                dot={{ fill: '#dc2626' }}
                name="Net Sell Proceeds"
                strokeWidth={2}
              />
              {breakevenYear && (
                <ReferenceLine
                  x={breakevenYear}
                  stroke="#16a34a"
                  strokeDasharray="5 5"
                  label={{
                    value: `Breakeven (Yr ${breakevenYear})`,
                    position: 'top',
                    fill: '#16a34a',
                    fontSize: 12,
                  }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Table Section */}
      <Card>
        <CardHeader>
          <CardTitle>Year-by-Year Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Year</TableHead>
                  <TableHead className="text-right">Annual NOI</TableHead>
                  <TableHead className="text-right">Cumulative NOI</TableHead>
                  <TableHead className="text-right">Property Value</TableHead>
                  <TableHead className="text-right">Net Sell Proceeds</TableHead>
                  <TableHead className="w-24">Recommendation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysis.map((row) => (
                  <TableRow key={row.year} className={row.breakeven ? 'bg-green-50' : ''}>
                    <TableCell className="font-bold">{row.year}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(row.noi)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(row.cumulativeNOI)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(row.propertyValue)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(row.netSellProceeds)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={row.recommendation === 'Hold' ? 'default' : 'secondary'}
                        className={
                          row.recommendation === 'Hold'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }
                      >
                        {row.recommendation}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}

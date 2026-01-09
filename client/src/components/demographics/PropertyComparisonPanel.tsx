import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, DollarSign, Home, GraduationCap, Briefcase, 
  TrendingUp, TrendingDown, Minus, LayoutGrid, Table2,
  MapPin, Lightbulb
} from "lucide-react";
import { useState } from "react";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

interface DemographicData {
  totalPopulation?: number;
  medianAge?: number;
  medianHouseholdIncome?: number;
  perCapitaIncome?: number;
  medianHomeValue?: number;
  householdSize?: number;
  populationDensity?: number;
  educationLevels?: Record<string, number>;
  employmentStats?: Record<string, number>;
}

interface LocationData {
  address: string;
  label?: string;
  demographics: DemographicData | null;
}

interface PropertyComparisonPanelProps {
  locations: LocationData[];
  onRemoveLocation?: (index: number) => void;
}

const formatCurrencyOrNA = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "N/A";
  return formatCurrency(value);
};

const formatNumberOrNA = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "N/A";
  return formatNumber(value);
};

const formatPercentOrNA = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "N/A";
  return formatPercent(value);
};

function calculateBachelorsPercentage(educationLevels: Record<string, number> | undefined): number | null {
  if (!educationLevels) return null;
  const total = Object.values(educationLevels).reduce((sum, val) => sum + val, 0);
  if (total === 0) return null;
  const bachelorsAndHigher = (educationLevels.bachelors || 0) + (educationLevels.graduate || 0);
  return (bachelorsAndHigher / total) * 100;
}

function calculateEmploymentRate(employmentStats: Record<string, number> | undefined): number | null {
  if (!employmentStats) return null;
  const employed = employmentStats.employed || employmentStats.civilian_employed || 0;
  const unemployed = employmentStats.unemployed || 0;
  const laborForce = employed + unemployed;
  if (laborForce === 0) return null;
  return (employed / laborForce) * 100;
}

export default function PropertyComparisonPanel({ locations, onRemoveLocation }: PropertyComparisonPanelProps) {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  
  const insights = useMemo(() => {
    if (locations.length < 2) return [];
    
    const validLocations = locations.filter(l => l.demographics);
    if (validLocations.length < 2) return [];
    
    const generated: string[] = [];
    
    const incomes = validLocations
      .map((l, i) => ({ index: i, label: l.label || `Location ${i + 1}`, value: l.demographics?.medianHouseholdIncome }))
      .filter(l => l.value != null);
    
    if (incomes.length >= 2) {
      const sorted = [...incomes].sort((a, b) => (b.value || 0) - (a.value || 0));
      const highest = sorted[0];
      const lowest = sorted[sorted.length - 1];
      if (highest.value && lowest.value && highest.value !== lowest.value) {
        const diff = ((highest.value - lowest.value) / lowest.value * 100).toFixed(0);
        generated.push(`${highest.label} has ${diff}% higher median income than ${lowest.label}`);
      }
    }
    
    const populations = validLocations
      .map((l, i) => ({ index: i, label: l.label || `Location ${i + 1}`, value: l.demographics?.totalPopulation }))
      .filter(l => l.value != null);
    
    if (populations.length >= 2) {
      const sorted = [...populations].sort((a, b) => (b.value || 0) - (a.value || 0));
      const highest = sorted[0];
      if (highest.value) {
        generated.push(`${highest.label} serves the largest population base (${formatNumberOrNA(highest.value)})`);
      }
    }
    
    const homeValues = validLocations
      .map((l, i) => ({ index: i, label: l.label || `Location ${i + 1}`, value: l.demographics?.medianHomeValue }))
      .filter(l => l.value != null);
    
    if (homeValues.length >= 2) {
      const avg = homeValues.reduce((sum, h) => sum + (h.value || 0), 0) / homeValues.length;
      const aboveAvg = homeValues.filter(h => (h.value || 0) > avg);
      if (aboveAvg.length > 0 && aboveAvg.length < homeValues.length) {
        generated.push(`${aboveAvg.map(a => a.label).join(', ')} ${aboveAvg.length > 1 ? 'have' : 'has'} above-average home values`);
      }
    }
    
    const education = validLocations
      .map((l, i) => ({ 
        index: i, 
        label: l.label || `Location ${i + 1}`, 
        value: calculateBachelorsPercentage(l.demographics?.educationLevels) 
      }))
      .filter(l => l.value != null);
    
    if (education.length >= 2) {
      const sorted = [...education].sort((a, b) => (b.value || 0) - (a.value || 0));
      const highest = sorted[0];
      if (highest.value && highest.value > 40) {
        generated.push(`${highest.label} has the most educated population (${highest.value.toFixed(0)}% with BA+)`);
      }
    }
    
    return generated.slice(0, 4);
  }, [locations]);
  
  const comparisonMetrics = useMemo(() => {
    const metrics = [
      { 
        key: 'population', 
        label: 'Population', 
        icon: Users, 
        getValue: (d: DemographicData) => d.totalPopulation,
        format: formatNumberOrNA,
        color: 'text-blue-600'
      },
      { 
        key: 'medianAge', 
        label: 'Median Age', 
        icon: Users, 
        getValue: (d: DemographicData) => d.medianAge,
        format: (v: number | null | undefined) => v != null ? `${v.toFixed(1)} yrs` : 'N/A',
        color: 'text-indigo-600'
      },
      { 
        key: 'income', 
        label: 'Median Income', 
        icon: DollarSign, 
        getValue: (d: DemographicData) => d.medianHouseholdIncome,
        format: formatCurrencyOrNA,
        color: 'text-green-600'
      },
      { 
        key: 'homeValue', 
        label: 'Home Value', 
        icon: Home, 
        getValue: (d: DemographicData) => d.medianHomeValue,
        format: formatCurrencyOrNA,
        color: 'text-purple-600'
      },
      { 
        key: 'education', 
        label: 'Bachelor\'s+', 
        icon: GraduationCap, 
        getValue: (d: DemographicData) => calculateBachelorsPercentage(d.educationLevels),
        format: formatPercentOrNA,
        color: 'text-amber-600'
      },
      { 
        key: 'employment', 
        label: 'Employment', 
        icon: Briefcase, 
        getValue: (d: DemographicData) => calculateEmploymentRate(d.employmentStats),
        format: formatPercentOrNA,
        color: 'text-teal-600'
      },
    ];
    
    return metrics.map(metric => {
      const values = locations.map(l => l.demographics ? metric.getValue(l.demographics) : null);
      const validValues = values.filter((v): v is number => v != null);
      
      let highestIdx = -1;
      let lowestIdx = -1;
      
      if (validValues.length >= 2) {
        const maxVal = Math.max(...validValues);
        const minVal = Math.min(...validValues);
        highestIdx = values.findIndex(v => v === maxVal);
        lowestIdx = values.findIndex(v => v === minVal);
        if (highestIdx === lowestIdx) lowestIdx = -1;
      }
      
      return {
        ...metric,
        values,
        highestIdx,
        lowestIdx
      };
    });
  }, [locations]);
  
  if (locations.length === 0) {
    return (
      <Card className="border-dashed" data-testid="card-comparison-empty">
        <CardContent className="py-8 text-center">
          <MapPin className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            Add multiple locations to compare their demographics
          </p>
        </CardContent>
      </Card>
    );
  }
  
  if (locations.length === 1) {
    return (
      <Card className="border-dashed" data-testid="card-comparison-single">
        <CardContent className="py-6 text-center">
          <MapPin className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Add at least one more location to enable comparison
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card data-testid="card-property-comparison">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4" />
            Location Comparison
            <Badge variant="secondary" className="ml-1">
              {locations.length} locations
            </Badge>
          </CardTitle>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'cards' | 'table')}>
            <TabsList className="h-8">
              <TabsTrigger value="cards" className="h-6 px-2">
                <LayoutGrid className="h-3.5 w-3.5" />
              </TabsTrigger>
              <TabsTrigger value="table" className="h-6 px-2">
                <Table2 className="h-3.5 w-3.5" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {insights.length > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-primary">Key Insights</p>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {insights.map((insight, i) => (
                    <li key={i}>• {insight}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
        
        {viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {locations.map((location, locIdx) => (
              <div 
                key={locIdx} 
                className="border rounded-lg p-3 bg-card"
                data-testid={`comparison-card-${locIdx}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div 
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ 
                        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][locIdx % 5] 
                      }}
                    />
                    <span className="text-sm font-medium truncate">
                      {location.label || `Location ${locIdx + 1}`}
                    </span>
                  </div>
                </div>
                
                {location.demographics ? (
                  <div className="space-y-2">
                    {comparisonMetrics.map(metric => {
                      const value = metric.values[locIdx];
                      const isHighest = metric.highestIdx === locIdx;
                      const isLowest = metric.lowestIdx === locIdx;
                      
                      return (
                        <div key={metric.key} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <metric.icon className={`h-3 w-3 ${metric.color}`} />
                            {metric.label}
                          </span>
                          <span className={`font-medium flex items-center gap-1 ${
                            isHighest ? 'text-green-600' : isLowest ? 'text-amber-600' : ''
                          }`}>
                            {metric.format(value)}
                            {isHighest && <TrendingUp className="h-3 w-3" />}
                            {isLowest && <TrendingDown className="h-3 w-3" />}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No demographic data
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Metric</th>
                  {locations.map((loc, i) => (
                    <th key={i} className="text-right py-2 px-2 font-medium">
                      <div className="flex items-center justify-end gap-1">
                        <div 
                          className="w-2 h-2 rounded-full"
                          style={{ 
                            backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][i % 5] 
                          }}
                        />
                        <span className="truncate max-w-20">
                          {loc.label || `Loc ${i + 1}`}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonMetrics.map(metric => (
                  <tr key={metric.key} className="border-b border-muted/50">
                    <td className="py-2 pr-4">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <metric.icon className={`h-3 w-3 ${metric.color}`} />
                        {metric.label}
                      </span>
                    </td>
                    {metric.values.map((value, i) => {
                      const isHighest = metric.highestIdx === i;
                      const isLowest = metric.lowestIdx === i;
                      
                      return (
                        <td key={i} className="text-right py-2 px-2">
                          <span className={`flex items-center justify-end gap-1 ${
                            isHighest ? 'text-green-600 font-medium' : 
                            isLowest ? 'text-amber-600' : ''
                          }`}>
                            {metric.format(value)}
                            {isHighest && <TrendingUp className="h-3 w-3" />}
                            {isLowest && <TrendingDown className="h-3 w-3" />}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
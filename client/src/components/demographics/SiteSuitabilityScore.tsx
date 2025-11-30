import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle, Target, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { TargetDemographics } from "@shared/schema";

interface DemographicData {
  medianAge?: number;
  medianHouseholdIncome?: number;
  populationDensity?: number;
  householdSize?: number;
  educationLevels?: Record<string, number>;
  employmentStats?: Record<string, number>;
  medianHomeValue?: number;
}

interface SiteSuitabilityScoreProps {
  demographics: DemographicData | null;
  targets: TargetDemographics | null;
  locationLabel?: string;
  compact?: boolean;
}

interface CriterionResult {
  name: string;
  key: string;
  targetMin: number | null;
  targetMax: number | null;
  actual: number | null;
  passes: boolean;
  weight: number;
  deviation?: number;
  deviationDirection?: 'above' | 'below' | 'within';
}

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

export default function SiteSuitabilityScore({ demographics, targets, locationLabel, compact = false }: SiteSuitabilityScoreProps) {
  const { score, matchedCriteria, totalCriteria, criteriaResults } = useMemo(() => {
    if (!demographics || !targets) {
      return { score: null, matchedCriteria: 0, totalCriteria: 0, criteriaResults: [] };
    }
    
    const weights = (targets.weights as Record<string, number>) || {};
    const hasCustomWeights = Object.values(weights).some(w => w > 0);
    
    const criteria: CriterionResult[] = [];
    
    const addCriterion = (
      name: string,
      key: string,
      targetMin: number | null | undefined,
      targetMax: number | null | undefined,
      actual: number | null | undefined
    ) => {
      if ((targetMin === null || targetMin === undefined) && 
          (targetMax === null || targetMax === undefined)) {
        return;
      }
      
      const weight = hasCustomWeights ? (weights[key] || 0) : 1;
      if (hasCustomWeights && weight === 0) return;
      
      let passes = false;
      let deviation = 0;
      let deviationDirection: 'above' | 'below' | 'within' = 'within';
      
      if (actual !== null && actual !== undefined) {
        const minVal = targetMin ?? -Infinity;
        const maxVal = targetMax ?? Infinity;
        passes = actual >= minVal && actual <= maxVal;
        
        if (!passes) {
          if (actual < minVal) {
            deviation = ((minVal - actual) / minVal) * 100;
            deviationDirection = 'below';
          } else if (actual > maxVal) {
            deviation = ((actual - maxVal) / maxVal) * 100;
            deviationDirection = 'above';
          }
        }
      }
      
      criteria.push({
        name,
        key,
        targetMin: targetMin ?? null,
        targetMax: targetMax ?? null,
        actual: actual ?? null,
        passes,
        weight,
        deviation: Math.round(deviation),
        deviationDirection
      });
    };
    
    addCriterion('Median Age', 'medianAge', targets.medianAgeMin, targets.medianAgeMax, demographics.medianAge);
    addCriterion('Median Income', 'medianIncome', targets.medianIncomeMin, targets.medianIncomeMax, demographics.medianHouseholdIncome);
    addCriterion('Population Density', 'populationDensity', targets.populationDensityMin, targets.populationDensityMax, demographics.populationDensity);
    addCriterion('Household Size', 'householdSize', targets.householdSizeMin, targets.householdSizeMax, demographics.householdSize);
    addCriterion('Education (BA+)', 'educationBachelors', targets.educationBachelorsMin, targets.educationBachelorsMax, calculateBachelorsPercentage(demographics.educationLevels));
    addCriterion('Employment Rate', 'employmentRate', targets.employmentRateMin, targets.employmentRateMax, calculateEmploymentRate(demographics.employmentStats));
    addCriterion('Home Value', 'homeValue', targets.homeValueMin, targets.homeValueMax, demographics.medianHomeValue);
    
    if (criteria.length === 0) {
      return { score: null, matchedCriteria: 0, totalCriteria: 0, criteriaResults: [] };
    }
    
    const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
    const matchedWeight = criteria.filter(c => c.passes).reduce((sum, c) => sum + c.weight, 0);
    
    const calculatedScore = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;
    const matched = criteria.filter(c => c.passes).length;
    
    return {
      score: calculatedScore,
      matchedCriteria: matched,
      totalCriteria: criteria.length,
      criteriaResults: criteria
    };
  }, [demographics, targets]);
  
  if (!targets) {
    return (
      <Card className="border-dashed" data-testid="card-suitability-no-targets">
        <CardContent className="py-6 text-center">
          <Target className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Configure target demographics to see suitability scores
          </p>
        </CardContent>
      </Card>
    );
  }
  
  if (!demographics) {
    return (
      <Card className="border-dashed" data-testid="card-suitability-no-demographics">
        <CardContent className="py-6 text-center">
          <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Select a location to calculate suitability score
          </p>
        </CardContent>
      </Card>
    );
  }
  
  if (score === null || totalCriteria === 0) {
    return (
      <Card className="border-dashed" data-testid="card-suitability-no-criteria">
        <CardContent className="py-6 text-center">
          <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No matching criteria available for scoring
          </p>
        </CardContent>
      </Card>
    );
  }
  
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-green-600 dark:text-green-400';
    if (s >= 60) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };
  
  const getScoreBadge = (s: number) => {
    if (s >= 80) return { label: 'Excellent Match', variant: 'default' as const, className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' };
    if (s >= 60) return { label: 'Good Match', variant: 'secondary' as const, className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' };
    if (s >= 40) return { label: 'Moderate Match', variant: 'outline' as const, className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' };
    return { label: 'Poor Match', variant: 'destructive' as const, className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' };
  };
  
  const scoreBadge = getScoreBadge(score);
  
  const formatValue = (key: string, value: number | null): string => {
    if (value === null) return 'N/A';
    
    switch (key) {
      case 'medianIncome':
      case 'homeValue':
        return `$${Math.round(value).toLocaleString()}`;
      case 'medianAge':
        return `${value.toFixed(1)} yrs`;
      case 'householdSize':
        return value.toFixed(1);
      case 'populationDensity':
        return `${Math.round(value).toLocaleString()}/sq mi`;
      case 'educationBachelors':
      case 'employmentRate':
        return `${value.toFixed(1)}%`;
      default:
        return value.toLocaleString();
    }
  };
  
  const formatRange = (key: string, min: number | null, max: number | null): string => {
    if (min === null && max === null) return 'Any';
    
    const formatSingle = (val: number): string => {
      switch (key) {
        case 'medianIncome':
        case 'homeValue':
          return `$${Math.round(val / 1000)}k`;
        case 'medianAge':
          return `${val}`;
        case 'householdSize':
          return val.toFixed(1);
        case 'populationDensity':
          return `${Math.round(val / 1000)}k`;
        case 'educationBachelors':
        case 'employmentRate':
          return `${val}%`;
        default:
          return val.toString();
      }
    };
    
    if (min !== null && max !== null) {
      return `${formatSingle(min)} - ${formatSingle(max)}`;
    } else if (min !== null) {
      return `≥ ${formatSingle(min)}`;
    } else if (max !== null) {
      return `≤ ${formatSingle(max)}`;
    }
    return 'Any';
  };

  if (compact) {
    return (
      <Card data-testid="card-suitability-score-compact">
        <CardContent className="py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`text-2xl font-bold ${getScoreColor(score)}`} data-testid="text-score">
                {score}%
              </div>
              <div>
                <Badge className={scoreBadge.className}>
                  {scoreBadge.label}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  {matchedCriteria}/{totalCriteria} criteria met
                </p>
              </div>
            </div>
            <Progress value={score} className="w-24 h-2" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card data-testid="card-suitability-score">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4" />
            Site Suitability Score
            {locationLabel && (
              <span className="text-xs font-normal text-muted-foreground ml-1">
                - {locationLabel}
              </span>
            )}
          </CardTitle>
          <Badge className={scoreBadge.className}>
            {scoreBadge.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className={`text-4xl font-bold ${getScoreColor(score)}`} data-testid="text-score-large">
            {score}%
          </div>
          <div className="flex-1">
            <Progress value={score} className="h-3" />
            <p className="text-xs text-muted-foreground mt-1">
              {matchedCriteria} of {totalCriteria} criteria matched
            </p>
          </div>
        </div>
        
        <div className="space-y-2">
          <p className="text-sm font-medium">Criteria Breakdown</p>
          <div className="space-y-1.5">
            {criteriaResults.map((criterion) => (
              <div 
                key={criterion.key} 
                className={`flex items-center justify-between p-2 rounded-lg text-sm ${
                  criterion.passes 
                    ? 'bg-green-50 dark:bg-green-950/30' 
                    : 'bg-red-50 dark:bg-red-950/30'
                }`}
                data-testid={`criterion-${criterion.key}`}
              >
                <div className="flex items-center gap-2">
                  {criterion.passes ? (
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  )}
                  <span className="font-medium">{criterion.name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground">
                    Target: {formatRange(criterion.key, criterion.targetMin, criterion.targetMax)}
                  </span>
                  <span className={criterion.passes ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                    Actual: {formatValue(criterion.key, criterion.actual)}
                  </span>
                  {!criterion.passes && criterion.deviation && criterion.deviation > 0 && (
                    <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                      {criterion.deviationDirection === 'above' ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : criterion.deviationDirection === 'below' ? (
                        <TrendingDown className="h-3 w-3" />
                      ) : (
                        <Minus className="h-3 w-3" />
                      )}
                      {criterion.deviation}% {criterion.deviationDirection}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
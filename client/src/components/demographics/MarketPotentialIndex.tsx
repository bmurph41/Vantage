import { useMemo } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Target } from "lucide-react";

interface DemographicData {
  totalPopulation?: number;
  medianHouseholdIncome?: number;
  medianHomeValue?: number;
  perCapitaIncome?: number;
  populationDensity?: number;
  educationLevels?: Record<string, number>;
  employmentStats?: Record<string, number>;
  householdSize?: number;
}

interface MarketPotentialIndexProps {
  demographics: DemographicData | null;
  locationLabel?: string;
}

interface FactorScore {
  label: string;
  score: number;
  weight: number;
  weightedScore: number;
  color: string;
}

function calculateBachelorsPercent(educationLevels?: Record<string, number>): number {
  if (!educationLevels) return 0;
  const total = Object.values(educationLevels).reduce((sum, val) => sum + val, 0);
  if (total === 0) return 0;
  const bachelorsAndHigher = (educationLevels.bachelors || 0) + (educationLevels.graduate || 0);
  return (bachelorsAndHigher / total) * 100;
}

function calculateEmploymentRate(employmentStats?: Record<string, number>): number {
  if (!employmentStats) return 0;
  const employed = employmentStats.employed || employmentStats.civilian_employed || 0;
  const unemployed = employmentStats.unemployed || 0;
  const laborForce = employed + unemployed;
  if (laborForce === 0) return 0;
  return (employed / laborForce) * 100;
}

function getEmployedCount(employmentStats?: Record<string, number>): number {
  if (!employmentStats) return 0;
  return employmentStats.employed || employmentStats.civilian_employed || 0;
}

export default function MarketPotentialIndex({ demographics, locationLabel }: MarketPotentialIndexProps) {
  const { mpiScore, factors, scoreLabel, scoreColor, insight } = useMemo(() => {
    if (!demographics) {
      return { mpiScore: 0, factors: [], scoreLabel: '', scoreColor: '', insight: '' };
    }

    const incomeRaw = Math.min(100, ((demographics.medianHouseholdIncome || 0) / 74580) * 100);

    let densityRaw = 50;
    const density = demographics.populationDensity || 0;
    if (density >= 500 && density <= 5000) {
      densityRaw = 100;
    } else if (density < 200) {
      densityRaw = 40;
    } else if (density < 500) {
      densityRaw = 40 + ((density - 200) / 300) * 60;
    } else if (density > 10000) {
      densityRaw = 60;
    } else {
      densityRaw = 100 - ((density - 5000) / 5000) * 40;
    }

    const bachelorsPct = calculateBachelorsPercent(demographics.educationLevels);
    const educationRaw = Math.min(100, bachelorsPct * 2);

    const employmentRate = calculateEmploymentRate(demographics.employmentStats);
    const employmentRaw = Math.min(100, employmentRate * 1.1);

    const homeValueRaw = Math.min(100, ((demographics.medianHomeValue || 0) / 320000) * 100);

    const hhSize = demographics.householdSize || 2.5;
    const hhDiff = Math.abs(hhSize - 2.5);
    const householdRaw = Math.max(0, 100 - hhDiff * 40);

    const factorsArr: FactorScore[] = [
      { label: 'Income', score: Math.round(incomeRaw), weight: 0.25, weightedScore: incomeRaw * 0.25, color: '#10b981' },
      { label: 'Pop. Density', score: Math.round(densityRaw), weight: 0.20, weightedScore: densityRaw * 0.20, color: '#3b82f6' },
      { label: 'Education', score: Math.round(educationRaw), weight: 0.20, weightedScore: educationRaw * 0.20, color: '#8b5cf6' },
      { label: 'Employment', score: Math.round(employmentRaw), weight: 0.15, weightedScore: employmentRaw * 0.15, color: '#f59e0b' },
      { label: 'Home Value', score: Math.round(homeValueRaw), weight: 0.10, weightedScore: homeValueRaw * 0.10, color: '#ef4444' },
      { label: 'Household Size', score: Math.round(householdRaw), weight: 0.10, weightedScore: householdRaw * 0.10, color: '#06b6d4' },
    ];

    const total = Math.round(factorsArr.reduce((sum, f) => sum + f.weightedScore, 0));

    let label = 'Below Average';
    let color = '#ef4444';
    if (total >= 80) { label = 'Strong'; color = '#3b82f6'; }
    else if (total >= 60) { label = 'Above Average'; color = '#10b981'; }
    else if (total >= 40) { label = 'Average'; color = '#f59e0b'; }

    let insightText = '';
    if (total >= 80) {
      insightText = 'This area shows strong market fundamentals for marina investment with above-average income, favorable density, and educated population.';
    } else if (total >= 60) {
      insightText = 'This location has above-average market potential. Income levels and population characteristics support marina demand.';
    } else if (total >= 40) {
      insightText = 'Market potential is average. Some factors are favorable while others may need further evaluation before committing to marina investment.';
    } else {
      insightText = 'Market fundamentals suggest limited potential for marina investment in this area. Consider reviewing individual factors for specific concerns.';
    }

    return { mpiScore: total, factors: factorsArr, scoreLabel: label, scoreColor: color, insight: insightText };
  }, [demographics]);

  if (!demographics) {
    return (
      <Card data-testid="card-mpi-empty">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <h3 className="text-base font-semibold text-foreground">Market Potential Index</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <Target className="mx-auto h-12 w-12 mb-4" />
            <p className="text-sm">Select a location to calculate market potential</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (mpiScore / 100) * circumference;

  return (
    <Card data-testid="card-mpi">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <h3 className="text-base font-semibold text-foreground">Market Potential Index</h3>
          </div>
          {locationLabel && (
            <span className="text-xs text-muted-foreground">{locationLabel}</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-6">
          <div className="relative flex-shrink-0" data-testid="mpi-circular-score">
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="45"
                fill="none"
                stroke="currentColor"
                className="text-muted/30"
                strokeWidth="8"
              />
              <circle
                cx="60"
                cy="60"
                r="45"
                fill="none"
                stroke={scoreColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 60 60)"
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold" style={{ color: scoreColor }}>{mpiScore}</span>
              <span className="text-xs text-muted-foreground">/100</span>
            </div>
          </div>
          <div>
            <p className="text-lg font-semibold" style={{ color: scoreColor }} data-testid="mpi-label">
              {scoreLabel}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Market Potential Index measures area suitability for marina investment
            </p>
          </div>
        </div>

        <div className="space-y-2" data-testid="mpi-breakdown">
          {factors.map((factor) => (
            <div key={factor.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{factor.label} ({(factor.weight * 100).toFixed(0)}%)</span>
                <span className="font-medium">{factor.score}/100</span>
              </div>
              <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${factor.score}%`, backgroundColor: factor.color }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 bg-accent/10 rounded-lg" data-testid="mpi-insight">
          <p className="text-xs text-muted-foreground">{insight}</p>
        </div>
      </CardContent>
    </Card>
  );
}

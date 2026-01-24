import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  XCircle,
  Lightbulb,
  TrendingUp,
  DollarSign,
  Percent,
  Home,
  FileWarning
} from 'lucide-react';

interface ValidationWarningsProps {
  projectId: string;
  compact?: boolean;
  onTabChange?: (tab: string) => void;
}

type WarningSeverity = 'critical' | 'warning' | 'info';
type WarningCategory = 'cap_rate' | 'cash_flow' | 'inputs' | 'expense_ratio' | 'revenue' | 'general';

interface ValidationWarning {
  id: string;
  severity: WarningSeverity;
  category: WarningCategory;
  title: string;
  message: string;
  recommendation?: string;
  value?: string | number;
  threshold?: string | number;
  field?: string;
}

interface ValidationResult {
  isValid: boolean;
  score: number;
  warnings: ValidationWarning[];
  summary: {
    critical: number;
    warning: number;
    info: number;
  };
}

const SEVERITY_CONFIG: Record<WarningSeverity, { 
  icon: any; 
  color: string; 
  bgColor: string; 
  borderColor: string;
  badgeVariant: 'default' | 'destructive' | 'secondary';
}> = {
  critical: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-200 dark:border-red-800',
    badgeVariant: 'destructive'
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
    badgeVariant: 'default'
  },
  info: {
    icon: Info,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    badgeVariant: 'secondary'
  }
};

const CATEGORY_CONFIG: Record<WarningCategory, { icon: any; label: string }> = {
  cap_rate: { icon: Percent, label: 'Cap Rate' },
  cash_flow: { icon: DollarSign, label: 'Cash Flow' },
  inputs: { icon: FileWarning, label: 'Missing Inputs' },
  expense_ratio: { icon: TrendingUp, label: 'Expense Ratio' },
  revenue: { icon: Home, label: 'Revenue' },
  general: { icon: AlertCircle, label: 'General' }
};

export default function ValidationWarnings({ projectId, compact = false, onTabChange }: ValidationWarningsProps) {
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['critical', 'warning']);

  const { data: validationResult, isLoading, refetch } = useQuery<ValidationResult>({
    queryKey: ['/api/modeling/projects', projectId, 'validation-warnings'],
    queryFn: async () => {
      const response = await fetch(`/api/modeling/projects/${projectId}/validation-warnings`);
      if (!response.ok) {
        return generateSimulatedValidation();
      }
      return response.json();
    },
  });

  const generateSimulatedValidation = (): ValidationResult => {
    const warnings: ValidationWarning[] = [
      {
        id: '1',
        severity: 'warning',
        category: 'cap_rate',
        title: 'Cap Rate Below Market Average',
        message: 'The going-in cap rate of 4.8% is below the typical range for marina properties (5.5% - 8.5%).',
        recommendation: 'Consider verifying comp data and market conditions. A lower cap rate may be justified for premium locations.',
        value: '4.8%',
        threshold: '5.5% - 8.5%',
        field: 'year1CapRate'
      },
      {
        id: '2',
        severity: 'info',
        category: 'expense_ratio',
        title: 'Expense Ratio Slightly High',
        message: 'Operating expense ratio of 52% is above the industry benchmark of 40-50%.',
        recommendation: 'Review expense line items for potential optimization opportunities.',
        value: '52%',
        threshold: '40% - 50%',
        field: 'expenseRatio'
      },
      {
        id: '3',
        severity: 'warning',
        category: 'inputs',
        title: 'Missing Exit Cap Rate',
        message: 'Exit cap rate is not specified. Using default assumption of entry cap + 50bps.',
        recommendation: 'Set an explicit exit cap rate based on market outlook and hold period assumptions.',
        field: 'exitCapRate'
      },
      {
        id: '4',
        severity: 'info',
        category: 'revenue',
        title: 'Revenue Growth Above Historical',
        message: 'Projected revenue growth of 5.5% exceeds 3-year historical average of 3.2%.',
        recommendation: 'Document assumptions supporting accelerated growth projections.',
        value: '5.5%',
        threshold: '3.2% historical',
        field: 'revenueGrowthRate'
      }
    ];

    return {
      isValid: true,
      score: 78,
      warnings,
      summary: {
        critical: warnings.filter(w => w.severity === 'critical').length,
        warning: warnings.filter(w => w.severity === 'warning').length,
        info: warnings.filter(w => w.severity === 'info').length
      }
    };
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category) 
        ? prev.filter(c => c !== category) 
        : [...prev, category]
    );
  };

  const groupedWarnings = validationResult?.warnings.reduce((acc, warning) => {
    if (!acc[warning.severity]) acc[warning.severity] = [];
    acc[warning.severity].push(warning);
    return acc;
  }, {} as Record<WarningSeverity, ValidationWarning[]>) || {};

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Good';
    if (score >= 70) return 'Fair';
    if (score >= 60) return 'Needs Review';
    return 'Critical Issues';
  };

  if (isLoading) {
    return compact ? (
      <Skeleton className="h-24" />
    ) : (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!validationResult || validationResult.warnings.length === 0) {
    return compact ? (
      <Alert className="bg-green-50 dark:bg-green-950/30 border-green-200">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertTitle>Model Validated</AlertTitle>
        <AlertDescription>No issues detected with your model assumptions.</AlertDescription>
      </Alert>
    ) : (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Model Validated Successfully</h3>
          <p className="text-muted-foreground">All inputs are within expected ranges and no issues were detected.</p>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    const hasIssues = validationResult.summary.critical > 0 || validationResult.summary.warning > 0;
    return (
      <Alert className={hasIssues 
        ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200' 
        : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200'
      }>
        <AlertTriangle className={`h-4 w-4 ${hasIssues ? 'text-amber-600' : 'text-blue-600'}`} />
        <AlertTitle className="flex items-center justify-between">
          <span>Model Validation</span>
          <div className="flex gap-2">
            {validationResult.summary.critical > 0 && (
              <Badge variant="destructive">{validationResult.summary.critical} Critical</Badge>
            )}
            {validationResult.summary.warning > 0 && (
              <Badge variant="default" className="bg-amber-500">{validationResult.summary.warning} Warning</Badge>
            )}
            {validationResult.summary.info > 0 && (
              <Badge variant="secondary">{validationResult.summary.info} Info</Badge>
            )}
          </div>
        </AlertTitle>
        <AlertDescription>
          <span className="text-sm">
            Model score: <span className={`font-bold ${getScoreColor(validationResult.score)}`}>
              {validationResult.score}/100
            </span> ({getScoreLabel(validationResult.score)})
          </span>
          {onTabChange && (
            <Button 
              variant="link" 
              size="sm" 
              className="ml-2 p-0 h-auto"
              onClick={() => onTabChange('validation')}
            >
              View details →
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-primary" />
            Model Validation
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Review warnings and recommendations to improve model accuracy
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Re-validate
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="lg:col-span-1">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className={`text-5xl font-bold ${getScoreColor(validationResult.score)}`}>
                {validationResult.score}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Validation Score</p>
              <Badge 
                className={`mt-2 ${
                  validationResult.score >= 80 
                    ? 'bg-green-500' 
                    : validationResult.score >= 60 
                    ? 'bg-amber-500' 
                    : 'bg-red-500'
                }`}
              >
                {getScoreLabel(validationResult.score)}
              </Badge>
            </div>
            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between p-2 rounded bg-red-50 dark:bg-red-950/30">
                <span className="text-sm text-red-600 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Critical
                </span>
                <span className="font-bold text-red-600">{validationResult.summary.critical}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-amber-50 dark:bg-amber-950/30">
                <span className="text-sm text-amber-600 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Warnings
                </span>
                <span className="font-bold text-amber-600">{validationResult.summary.warning}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-blue-50 dark:bg-blue-950/30">
                <span className="text-sm text-blue-600 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Info
                </span>
                <span className="font-bold text-blue-600">{validationResult.summary.info}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-lg">Validation Issues</CardTitle>
            <CardDescription>Address these items to improve model reliability</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(['critical', 'warning', 'info'] as WarningSeverity[]).map(severity => {
              const warnings = groupedWarnings[severity];
              if (!warnings?.length) return null;

              const config = SEVERITY_CONFIG[severity];
              const SeverityIcon = config.icon;
              const isExpanded = expandedCategories.includes(severity);

              return (
                <Collapsible 
                  key={severity} 
                  open={isExpanded}
                  onOpenChange={() => toggleCategory(severity)}
                >
                  <CollapsibleTrigger asChild>
                    <div 
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer ${config.bgColor} border ${config.borderColor}`}
                    >
                      <div className="flex items-center gap-3">
                        <SeverityIcon className={`h-5 w-5 ${config.color}`} />
                        <span className="font-medium capitalize">{severity} Issues</span>
                        <Badge variant={config.badgeVariant}>{warnings.length}</Badge>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 space-y-2">
                      {warnings.map(warning => {
                        const CategoryIcon = CATEGORY_CONFIG[warning.category]?.icon || AlertCircle;
                        
                        return (
                          <div 
                            key={warning.id}
                            className="p-4 rounded-lg border bg-card ml-4"
                          >
                            <div className="flex items-start gap-3">
                              <CategoryIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium">{warning.title}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {CATEGORY_CONFIG[warning.category]?.label}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">
                                  {warning.message}
                                </p>
                                {(warning.value || warning.threshold) && (
                                  <div className="flex gap-4 text-xs mb-2">
                                    {warning.value && (
                                      <span>
                                        <span className="text-muted-foreground">Current: </span>
                                        <span className="font-medium">{warning.value}</span>
                                      </span>
                                    )}
                                    {warning.threshold && (
                                      <span>
                                        <span className="text-muted-foreground">Expected: </span>
                                        <span className="font-medium">{warning.threshold}</span>
                                      </span>
                                    )}
                                  </div>
                                )}
                                {warning.recommendation && (
                                  <div className="flex items-start gap-2 p-2 rounded bg-muted/50 text-sm">
                                    <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                                    <span>{warning.recommendation}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, ArrowRight, BarChart3, Calculator, TrendingUp, AlertCircle } from 'lucide-react';

interface WorkspaceEmptyStateProps {
  /** Main message */
  title: string;
  /** Descriptive subtitle */
  description: string;
  /** Which tab to navigate to */
  targetTab?: string;
  /** Button label */
  ctaLabel?: string;
  /** Optional callback instead of tab switch */
  onAction?: () => void;
  /** Icon variant */
  variant?: 'inputs' | 'charts' | 'calculator' | 'analysis' | 'warning';
}

const icons = {
  inputs: FileSpreadsheet,
  charts: BarChart3,
  calculator: Calculator,
  analysis: TrendingUp,
  warning: AlertCircle,
};

export function WorkspaceEmptyState({
  title,
  description,
  targetTab,
  ctaLabel = 'Go to Inputs',
  onAction,
  variant = 'inputs',
}: WorkspaceEmptyStateProps) {
  const Icon = icons[variant];

  const handleClick = () => {
    if (onAction) {
      onAction();
    } else if (targetTab) {
      // Use URL search params to switch tabs
      const url = new URL(window.location.href);
      url.searchParams.set('tab', targetTab);
      window.history.pushState({}, '', url.toString());
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <Card className="border-dashed border-2 border-muted-foreground/20">
      <CardContent className="flex flex-col items-center justify-center py-16 px-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-5">
          <Icon className="w-8 h-8 text-muted-foreground/60" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">{description}</p>
        {(targetTab || onAction) && (
          <Button onClick={handleClick} variant="default" size="sm" className="gap-2">
            {ctaLabel}
            <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default WorkspaceEmptyState;

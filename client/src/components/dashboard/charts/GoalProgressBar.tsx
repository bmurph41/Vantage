import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GoalProgressBarProps {
  title: string;
  current: number;
  goal: number;
  format?: 'currency' | 'number' | 'percent';
  subtitle?: string;
  showPercentage?: boolean;
  className?: string;
}

export function GoalProgressBar({ 
  title, 
  current, 
  goal, 
  format = 'number',
  subtitle,
  showPercentage = true,
  className 
}: GoalProgressBarProps) {
  const percentage = Math.min((current / goal) * 100, 100);
  const isComplete = current >= goal;

  const formatValue = (val: number): string => {
    switch (format) {
      case 'currency':
        return `$${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      case 'percent':
        return `${val.toFixed(2)}%`;
      default:
        return val.toLocaleString();
    }
  };

  return (
    <Card className={cn('hover:shadow-md transition-shadow', className)} data-testid="goal-tracker">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          <Target className={cn(
            'h-5 w-5',
            isComplete ? 'text-green-600' : 'text-gray-400'
          )} />
        </div>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Progress 
            value={percentage} 
            className="h-3"
            data-testid="goal-progress"
          />
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">
                {formatValue(current)}
              </span>
              <span className="text-gray-500">of</span>
              <span className="text-gray-700">
                {formatValue(goal)}
              </span>
            </div>
            {showPercentage && (
              <span className={cn(
                'font-medium',
                isComplete ? 'text-green-600' : 'text-gray-600'
              )}>
                {percentage.toFixed(0)}%
              </span>
            )}
          </div>
          {isComplete && (
            <div className="text-xs font-medium text-green-600 flex items-center gap-1">
              🎯 Goal achieved!
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

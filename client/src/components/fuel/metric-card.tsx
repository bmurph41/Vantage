import { ArrowUp, ArrowDown, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  change?: {
    value: string;
    type: 'increase' | 'decrease' | 'warning';
    label: string;
  };
}

export function MetricCard({ title, value, icon, change }: MetricCardProps) {
  const getChangeIcon = () => {
    switch (change?.type) {
      case 'increase':
        return <ArrowUp className="w-3 h-3" />;
      case 'decrease':
        return <ArrowDown className="w-3 h-3" />;
      case 'warning':
        return <AlertTriangle className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const getChangeColor = () => {
    switch (change?.type) {
      case 'increase':
        return 'text-accent';
      case 'decrease':
        return 'text-destructive';
      case 'warning':
        return 'text-yellow-600';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm font-medium" data-testid={`metric-title-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            {title}
          </p>
          <p className="text-2xl font-bold text-foreground" data-testid={`metric-value-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            {value}
          </p>
        </div>
        <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
          {icon}
        </div>
      </div>
      {change && (
        <div className="flex items-center mt-4">
          <div className={`flex items-center ${getChangeColor()}`}>
            {getChangeIcon()}
            <span className="text-sm font-medium ml-1" data-testid={`metric-change-${title.toLowerCase().replace(/\s+/g, '-')}`}>
              {change.value}
            </span>
          </div>
          <span className="text-muted-foreground text-sm ml-2">
            {change.label}
          </span>
        </div>
      )}
    </Card>
  );
}

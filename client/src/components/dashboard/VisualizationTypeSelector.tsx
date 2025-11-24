import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  LineChart, 
  PieChart, 
  TrendingUp, 
  Grid3x3, 
  Table2, 
  Target, 
  ArrowLeftRight,
  LayoutGrid,
  Activity 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VisualizationType } from '@shared/schema';

interface VisualizationOption {
  type: VisualizationType;
  name: string;
  description: string;
  icon: any;
  badge?: string;
}

const VISUALIZATION_TYPES: VisualizationOption[] = [
  {
    type: 'kpi_card',
    name: 'KPI Card',
    description: 'Single metric display with trend indicator',
    icon: TrendingUp,
    badge: 'Popular',
  },
  {
    type: 'line_chart',
    name: 'Line Chart',
    description: 'Track trends and changes over time',
    icon: LineChart,
  },
  {
    type: 'area_chart',
    name: 'Area Chart',
    description: 'Visualize volume trends with filled areas',
    icon: Activity,
  },
  {
    type: 'bar_chart',
    name: 'Bar Chart',
    description: 'Compare values across categories',
    icon: BarChart3,
  },
  {
    type: 'pie_chart',
    name: 'Pie Chart',
    description: 'Show proportions and distribution',
    icon: PieChart,
  },
  {
    type: 'combo_chart',
    name: 'Combo Chart',
    description: 'Mix lines, bars, and areas in one chart',
    icon: LayoutGrid,
    badge: 'Advanced',
  },
  {
    type: 'stat_grid',
    name: 'Stat Grid',
    description: 'Multiple metrics in a compact grid',
    icon: Grid3x3,
  },
  {
    type: 'table',
    name: 'Data Table',
    description: 'Detailed tabular data view',
    icon: Table2,
  },
  {
    type: 'goal_tracker',
    name: 'Goal Tracker',
    description: 'Progress bar towards a target value',
    icon: Target,
  },
  {
    type: 'comparison_card',
    name: 'Comparison Card',
    description: 'Compare two time periods side-by-side',
    icon: ArrowLeftRight,
  },
];

interface VisualizationTypeSelectorProps {
  selectedType?: VisualizationType;
  onSelect: (type: VisualizationType) => void;
}

export function VisualizationTypeSelector({ selectedType, onSelect }: VisualizationTypeSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-1">Choose Visualization Type</h3>
        <p className="text-sm text-gray-600">
          Select how you want to display your data
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {VISUALIZATION_TYPES.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedType === option.type;

          return (
            <Card
              key={option.type}
              className={cn(
                'cursor-pointer transition-all hover:shadow-md',
                isSelected && 'ring-2 ring-blue-500 bg-blue-50'
              )}
              onClick={() => onSelect(option.type)}
              data-testid={`viz-type-${option.type}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'p-2 rounded-lg',
                    isSelected ? 'bg-blue-100' : 'bg-gray-100'
                  )}>
                    <Icon className={cn(
                      'h-5 w-5',
                      isSelected ? 'text-blue-600' : 'text-gray-600'
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm">{option.name}</h4>
                      {option.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {option.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {option.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

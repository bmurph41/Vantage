import type { VisualizationType, ChartConfig } from '@shared/schema';
import { DollarSign, TrendingUp, Percent, FileText, Users, Building2, Fuel, ShoppingCart } from 'lucide-react';

export interface ChartTemplate {
  id: string;
  name: string;
  description: string;
  visualizationType: VisualizationType;
  moduleType: string;
  icon: any;
  config: Partial<ChartConfig>;
  category: 'financial' | 'operations' | 'analytics';
}

export const CHART_TEMPLATES: ChartTemplate[] = [
  // Financial Templates
  {
    id: 'revenue-trend',
    name: 'Revenue Trend',
    description: 'Track revenue over time with a line chart',
    visualizationType: 'line_chart',
    moduleType: 'crm',
    icon: DollarSign,
    category: 'financial',
    config: {
      metrics: [{
        key: 'value',
        label: 'Revenue',
        aggregation: 'sum',
        format: 'currency',
        color: '#3b82f6',
      }],
      timeframe: {
        type: 'relative',
        start: '-90d',
        granularity: 'week',
      },
      showGrid: true,
      showLegend: false,
    },
  },
  {
    id: 'pipeline-health',
    name: 'Pipeline Health',
    description: 'Monitor deal pipeline with KPI cards',
    visualizationType: 'kpi_card',
    moduleType: 'crm',
    icon: TrendingUp,
    category: 'financial',
    config: {
      metrics: [{
        key: 'value',
        label: 'Pipeline Value',
        aggregation: 'sum',
        format: 'currency',
      }],
    },
  },
  {
    id: 'deal-status-breakdown',
    name: 'Deal Status Breakdown',
    description: 'Visualize deal distribution by status',
    visualizationType: 'pie_chart',
    moduleType: 'crm',
    icon: Building2,
    category: 'analytics',
    config: {
      metrics: [{
        key: 'count',
        label: 'Deals',
        aggregation: 'count',
      }],
      showLegend: true,
    },
  },
  {
    id: 'quarterly-revenue-comparison',
    name: 'Quarterly Revenue Comparison',
    description: 'Compare current vs previous quarter revenue',
    visualizationType: 'comparison_card',
    moduleType: 'crm',
    icon: DollarSign,
    category: 'financial',
    config: {
      metrics: [{
        key: 'value',
        label: 'Revenue',
        aggregation: 'sum',
        format: 'currency',
      }],
      timeframe: {
        type: 'relative',
        start: '-90d',
        granularity: 'quarter',
      },
      comparisonTimeframe: {
        type: 'relative',
        start: '-180d',
        end: '-90d',
        granularity: 'quarter',
      },
    },
  },

  // Operations Templates
  {
    id: 'fuel-sales-trend',
    name: 'Fuel Sales Trend',
    description: 'Track fuel revenue and gallons over time',
    visualizationType: 'combo_chart',
    moduleType: 'fuel',
    icon: Fuel,
    category: 'operations',
    config: {
      metrics: [
        {
          key: 'revenue',
          label: 'Revenue',
          aggregation: 'sum',
          format: 'currency',
          color: '#3b82f6',
        },
        {
          key: 'gallons',
          label: 'Gallons',
          aggregation: 'sum',
          format: 'number',
          color: '#10b981',
        },
      ],
      timeframe: {
        type: 'relative',
        start: '-30d',
        granularity: 'day',
      },
      showGrid: true,
      showLegend: true,
    },
  },
  {
    id: 'occupancy-rate',
    name: 'Occupancy Rate',
    description: 'Monitor slip occupancy percentage',
    visualizationType: 'kpi_card',
    moduleType: 'rentRoll',
    icon: Percent,
    category: 'operations',
    config: {
      metrics: [{
        key: 'occupancy_rate',
        label: 'Occupancy',
        aggregation: 'avg',
        format: 'percent',
      }],
    },
  },
  {
    id: 'ship-store-revenue-goal',
    name: 'Ship Store Revenue Goal',
    description: 'Track progress towards monthly revenue target',
    visualizationType: 'goal_tracker',
    moduleType: 'shipStore',
    icon: ShoppingCart,
    category: 'financial',
    config: {
      metrics: [{
        key: 'revenue',
        label: 'Revenue',
        aggregation: 'sum',
        format: 'currency',
      }],
      goalValue: 50000,
      timeframe: {
        type: 'relative',
        start: '-30d',
      },
    },
  },

  // Analytics Templates
  {
    id: 'dd-task-completion',
    name: 'DD Task Completion',
    description: 'View task completion statistics',
    visualizationType: 'stat_grid',
    moduleType: 'dueDiligence',
    icon: FileText,
    category: 'analytics',
    config: {
      metrics: [
        {
          key: 'total',
          label: 'Total Tasks',
          aggregation: 'count',
        },
        {
          key: 'completed',
          label: 'Completed',
          aggregation: 'count',
        },
        {
          key: 'in_progress',
          label: 'In Progress',
          aggregation: 'count',
        },
      ],
      layout: 'grid',
      columns: 3,
    },
  },
  {
    id: 'monthly-sales-comparison',
    name: 'Monthly Sales Comparison',
    description: 'Compare monthly sales across different sources',
    visualizationType: 'bar_chart',
    moduleType: 'salesComps',
    icon: Building2,
    category: 'analytics',
    config: {
      metrics: [{
        key: 'sale_price',
        label: 'Sale Price',
        aggregation: 'avg',
        format: 'currency',
        color: '#3b82f6',
      }],
      timeframe: {
        type: 'relative',
        start: '-12m',
        granularity: 'month',
      },
      showGrid: true,
      showLegend: false,
    },
  },
  {
    id: 'vdr-activity-trend',
    name: 'VDR Activity Trend',
    description: 'Monitor document activity over time',
    visualizationType: 'area_chart',
    moduleType: 'vdr',
    icon: FileText,
    category: 'analytics',
    config: {
      metrics: [{
        key: 'activity_count',
        label: 'Activities',
        aggregation: 'count',
        color: '#8b5cf6',
      }],
      timeframe: {
        type: 'relative',
        start: '-30d',
        granularity: 'day',
      },
      showGrid: true,
      showLegend: false,
    },
  },
];

export const getTemplatesByCategory = (category: 'financial' | 'operations' | 'analytics') => {
  return CHART_TEMPLATES.filter(t => t.category === category);
};

export const getTemplatesByVisualizationType = (type: VisualizationType) => {
  return CHART_TEMPLATES.filter(t => t.visualizationType === type);
};

export const getTemplateById = (id: string) => {
  return CHART_TEMPLATES.find(t => t.id === id);
};

/**
 * Smart Content Blocks
 * Reusable building blocks for rendering document content in previews and exports
 */

import * as React from 'react';
import { cn, formatCurrency, formatPercent, formatNumber, formatDate } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Building2,
  MapPin,
  DollarSign,
  Percent,
  Calendar,
  Hash,
  BarChart3,
  PieChart,
  LineChart,
  Activity,
  Anchor,
  Ship,
  Fuel,
  Map,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface MetricTileProps {
  label: string;
  value: string | number;
  format?: 'currency' | 'percent' | 'number' | 'date' | 'text';
  prefix?: string;
  suffix?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string | number;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'primary' | 'muted' | 'highlight';
  className?: string;
}

export interface MetricGridProps {
  metrics: MetricTileProps[];
  columns?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

export interface DataTableColumn<T = any> {
  key: string;
  label: string;
  format?: 'currency' | 'percent' | 'number' | 'date' | 'text';
  align?: 'left' | 'center' | 'right';
  width?: string | number;
  render?: (value: any, row: T) => React.ReactNode;
}

export interface DataTableProps<T = any> {
  columns: DataTableColumn<T>[];
  data: T[];
  caption?: string;
  showHeader?: boolean;
  striped?: boolean;
  bordered?: boolean;
  compact?: boolean;
  highlightTotal?: boolean;
  className?: string;
}

export interface PropertyCardProps {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  imageUrl?: string;
  metrics?: Array<{ label: string; value: string | number; format?: string }>;
  tags?: string[];
  className?: string;
}

export interface ChartPlaceholderProps {
  type: 'bar' | 'line' | 'pie' | 'area' | 'donut' | 'scatter';
  title?: string;
  description?: string;
  height?: number | string;
  className?: string;
}

export interface MapPlaceholderProps {
  title?: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  zoom?: number;
  height?: number | string;
  className?: string;
}

export interface TextBlockProps {
  content: string;
  variant?: 'body' | 'lead' | 'heading' | 'subheading' | 'caption';
  className?: string;
}

export interface BulletListProps {
  items: string[];
  variant?: 'disc' | 'check' | 'number' | 'arrow';
  columns?: 1 | 2 | 3;
  className?: string;
}

export interface HighlightBoxProps {
  title?: string;
  content: React.ReactNode;
  variant?: 'info' | 'success' | 'warning' | 'highlight' | 'quote';
  icon?: React.ReactNode;
  className?: string;
}

export interface SectionDividerProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
}

// =============================================================================
// Utility Functions
// =============================================================================

function formatValue(value: any, format?: string): string {
  if (value === null || value === undefined) return '—';
  
  switch (format) {
    case 'currency':
      return formatCurrency(Number(value));
    case 'percent':
      return formatPercent(Number(value));
    case 'number':
      return formatNumber(Number(value));
    case 'date':
      return formatDate(value);
    default:
      return String(value);
  }
}

function getTrendIcon(trend?: 'up' | 'down' | 'neutral') {
  switch (trend) {
    case 'up':
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    case 'down':
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    case 'neutral':
      return <Minus className="w-4 h-4 text-gray-400" />;
    default:
      return null;
  }
}

// =============================================================================
// Metric Tile Component
// =============================================================================

export function MetricTile({
  label,
  value,
  format = 'text',
  prefix,
  suffix,
  trend,
  trendValue,
  icon,
  size = 'md',
  variant = 'default',
  className,
}: MetricTileProps) {
  const formattedValue = formatValue(value, format);

  const sizeStyles = {
    sm: 'p-2',
    md: 'p-4',
    lg: 'p-6',
  };

  const valueSizeStyles = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  const labelSizeStyles = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const variantStyles = {
    default: 'bg-card border',
    primary: 'bg-primary/10 border-primary/20',
    muted: 'bg-muted border-muted-foreground/10',
    highlight: 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200',
  };

  return (
    <div
      className={cn(
        'rounded-lg transition-shadow hover:shadow-md',
        sizeStyles[size],
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <span className={cn('text-muted-foreground font-medium', labelSizeStyles[size])}>
          {label}
        </span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>

      <div className="flex items-baseline gap-1">
        {prefix && (
          <span className={cn('text-muted-foreground', labelSizeStyles[size])}>{prefix}</span>
        )}
        <span className={cn('font-bold tracking-tight', valueSizeStyles[size])}>
          {formattedValue}
        </span>
        {suffix && (
          <span className={cn('text-muted-foreground', labelSizeStyles[size])}>{suffix}</span>
        )}
      </div>

      {(trend || trendValue) && (
        <div className="flex items-center gap-1 mt-2">
          {getTrendIcon(trend)}
          {trendValue && (
            <span
              className={cn(
                'text-sm',
                trend === 'up' && 'text-green-600',
                trend === 'down' && 'text-red-600',
                trend === 'neutral' && 'text-gray-500'
              )}
            >
              {trendValue}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Metric Grid Component
// =============================================================================

export function MetricGrid({ metrics, columns = 4, className }: MetricGridProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
    5: 'grid-cols-2 md:grid-cols-5',
    6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
  };

  return (
    <div className={cn('grid gap-4', gridCols[columns], className)}>
      {metrics.map((metric, index) => (
        <MetricTile key={`${metric.label}-${index}`} {...metric} />
      ))}
    </div>
  );
}

// =============================================================================
// Data Table Component
// =============================================================================

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  caption,
  showHeader = true,
  striped = true,
  bordered = true,
  compact = false,
  highlightTotal = false,
  className,
}: DataTableProps<T>) {
  const isLastRow = (index: number) => index === data.length - 1;

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className={cn('w-full text-sm', bordered && 'border')}>
        {caption && (
          <caption className="text-left text-muted-foreground mb-2 font-medium">
            {caption}
          </caption>
        )}
        
        {showHeader && (
          <thead>
            <tr className={cn('bg-muted/50', bordered && 'border-b')}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'font-semibold text-muted-foreground',
                    compact ? 'px-2 py-1.5' : 'px-4 py-2',
                    col.align === 'center' && 'text-center',
                    col.align === 'right' && 'text-right',
                    col.align !== 'center' && col.align !== 'right' && 'text-left'
                  )}
                  style={{ width: col.width }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
        )}
        
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={cn(
                striped && rowIndex % 2 === 1 && 'bg-muted/30',
                bordered && 'border-b',
                highlightTotal && isLastRow(rowIndex) && 'bg-muted font-semibold'
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    compact ? 'px-2 py-1.5' : 'px-4 py-2',
                    col.align === 'center' && 'text-center',
                    col.align === 'right' && 'text-right'
                  )}
                >
                  {col.render
                    ? col.render(row[col.key], row)
                    : formatValue(row[col.key], col.format)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// Property Card Component
// =============================================================================

export function PropertyCard({
  name,
  address,
  city,
  state,
  zipCode,
  imageUrl,
  metrics,
  tags,
  className,
}: PropertyCardProps) {
  const locationParts = [city, state].filter(Boolean);
  const fullAddress = [address, ...locationParts, zipCode].filter(Boolean).join(', ');

  return (
    <div className={cn('rounded-lg border bg-card overflow-hidden', className)}>
      {imageUrl && (
        <div className="aspect-video bg-muted relative overflow-hidden">
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-lg">{name}</h3>
          {fullAddress && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
              <MapPin className="w-4 h-4" />
              <span>{fullAddress}</span>
            </div>
          )}
        </div>

        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {metrics && metrics.length > 0 && (
          <div className="grid grid-cols-2 gap-2 pt-2 border-t">
            {metrics.map((metric) => (
              <div key={metric.label}>
                <p className="text-xs text-muted-foreground">{metric.label}</p>
                <p className="font-semibold">{formatValue(metric.value, metric.format)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Chart Placeholder Component
// =============================================================================

export function ChartPlaceholder({
  type,
  title,
  description,
  height = 240,
  className,
}: ChartPlaceholderProps) {
  const chartIcons = {
    bar: <BarChart3 className="w-12 h-12" />,
    line: <LineChart className="w-12 h-12" />,
    pie: <PieChart className="w-12 h-12" />,
    area: <Activity className="w-12 h-12" />,
    donut: <PieChart className="w-12 h-12" />,
    scatter: <BarChart3 className="w-12 h-12" />,
  };

  return (
    <div
      className={cn(
        'rounded-lg border bg-muted/30 flex flex-col items-center justify-center text-muted-foreground',
        className
      )}
      style={{ height }}
    >
      {chartIcons[type]}
      {title && <p className="mt-2 font-medium">{title}</p>}
      {description && <p className="text-sm mt-1">{description}</p>}
      <p className="text-xs mt-2 opacity-50">Chart will render in final export</p>
    </div>
  );
}

// =============================================================================
// Map Placeholder Component
// =============================================================================

export function MapPlaceholder({
  title,
  address,
  coordinates,
  height = 300,
  className,
}: MapPlaceholderProps) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-gradient-to-br from-blue-50 to-green-50 flex flex-col items-center justify-center text-muted-foreground overflow-hidden',
        className
      )}
      style={{ height }}
    >
      <Map className="w-12 h-12" />
      {title && <p className="mt-2 font-medium">{title}</p>}
      {address && <p className="text-sm mt-1">{address}</p>}
      {coordinates && (
        <p className="text-xs mt-1 opacity-75">
          {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}
        </p>
      )}
      <p className="text-xs mt-2 opacity-50">Map will render in final export</p>
    </div>
  );
}

// =============================================================================
// Text Block Component
// =============================================================================

export function TextBlock({ content, variant = 'body', className }: TextBlockProps) {
  const variantStyles = {
    body: 'text-base leading-relaxed',
    lead: 'text-lg leading-relaxed text-muted-foreground',
    heading: 'text-2xl font-bold',
    subheading: 'text-xl font-semibold',
    caption: 'text-sm text-muted-foreground',
  };

  // Support basic HTML content
  return (
    <div
      className={cn(variantStyles[variant], 'prose prose-sm max-w-none', className)}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}

// =============================================================================
// Bullet List Component
// =============================================================================

export function BulletList({ items, variant = 'disc', columns = 1, className }: BulletListProps) {
  const listStyles = {
    disc: 'list-disc',
    check: 'list-none',
    number: 'list-decimal',
    arrow: 'list-none',
  };

  const columnStyles = {
    1: '',
    2: 'md:columns-2',
    3: 'md:columns-3',
  };

  return (
    <ul
      className={cn(
        'pl-4 space-y-1.5',
        listStyles[variant],
        columnStyles[columns],
        className
      )}
    >
      {items.map((item, index) => (
        <li key={index} className={cn(variant !== 'disc' && variant !== 'number' && 'flex items-start gap-2')}>
          {variant === 'check' && (
            <span className="text-green-500 mt-0.5">✓</span>
          )}
          {variant === 'arrow' && (
            <span className="text-primary mt-0.5">→</span>
          )}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// =============================================================================
// Highlight Box Component
// =============================================================================

export function HighlightBox({ title, content, variant = 'info', icon, className }: HighlightBoxProps) {
  const variantStyles = {
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    success: 'bg-green-50 border-green-200 text-green-900',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    highlight: 'bg-primary/5 border-primary/20 text-primary-foreground',
    quote: 'bg-muted border-l-4 border-muted-foreground/30 italic',
  };

  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        variantStyles[variant],
        className
      )}
    >
      {(title || icon) && (
        <div className="flex items-center gap-2 mb-2 font-semibold">
          {icon}
          {title && <span>{title}</span>}
        </div>
      )}
      <div className="text-sm">{content}</div>
    </div>
  );
}

// =============================================================================
// Section Divider Component
// =============================================================================

export function SectionDivider({ title, subtitle, icon, className }: SectionDividerProps) {
  return (
    <div className={cn('py-8 text-center', className)}>
      <div className="flex items-center justify-center gap-3 mb-2">
        {icon && <span className="text-primary">{icon}</span>}
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      </div>
      {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
      <div className="mt-4 w-24 h-1 bg-primary mx-auto rounded-full" />
    </div>
  );
}

// =============================================================================
// Marina-Specific Components
// =============================================================================

export interface MarinaMetricsProps {
  totalSlips: number;
  wetSlips?: number;
  dryStorage?: number;
  occupancy: number;
  avgSlipRate?: number;
  fuelSales?: number;
  className?: string;
}

export function MarinaMetrics({
  totalSlips,
  wetSlips,
  dryStorage,
  occupancy,
  avgSlipRate,
  fuelSales,
  className,
}: MarinaMetricsProps) {
  const metrics: MetricTileProps[] = [
    { label: 'Total Slips', value: totalSlips, format: 'number', icon: <Anchor className="w-4 h-4" /> },
    ...(wetSlips !== undefined ? [{ label: 'Wet Slips', value: wetSlips, format: 'number' as const, icon: <Ship className="w-4 h-4" /> }] : []),
    ...(dryStorage !== undefined ? [{ label: 'Dry Storage', value: dryStorage, format: 'number' as const, icon: <Building2 className="w-4 h-4" /> }] : []),
    { label: 'Occupancy', value: occupancy, format: 'percent', icon: <Percent className="w-4 h-4" /> },
    ...(avgSlipRate !== undefined ? [{ label: 'Avg Slip Rate', value: avgSlipRate, format: 'currency' as const, suffix: '/mo', icon: <DollarSign className="w-4 h-4" /> }] : []),
    ...(fuelSales !== undefined ? [{ label: 'Annual Fuel Sales', value: fuelSales, format: 'currency' as const, icon: <Fuel className="w-4 h-4" /> }] : []),
  ];

  return <MetricGrid metrics={metrics} columns={3} className={className} />;
}

// =============================================================================
// Investment Metrics Component
// =============================================================================

export interface InvestmentMetricsProps {
  askingPrice: number;
  noi?: number;
  capRate?: number;
  pricePerSlip?: number;
  pricePerSqFt?: number;
  irr?: number;
  cashOnCash?: number;
  className?: string;
}

export function InvestmentMetrics({
  askingPrice,
  noi,
  capRate,
  pricePerSlip,
  pricePerSqFt,
  irr,
  cashOnCash,
  className,
}: InvestmentMetricsProps) {
  const metrics: MetricTileProps[] = [
    { label: 'Asking Price', value: askingPrice, format: 'currency', variant: 'primary' },
    ...(noi !== undefined ? [{ label: 'Net Operating Income', value: noi, format: 'currency' as const }] : []),
    ...(capRate !== undefined ? [{ label: 'Cap Rate', value: capRate, format: 'percent' as const }] : []),
    ...(pricePerSlip !== undefined ? [{ label: 'Price Per Slip', value: pricePerSlip, format: 'currency' as const }] : []),
    ...(pricePerSqFt !== undefined ? [{ label: 'Price Per Sq Ft', value: pricePerSqFt, format: 'currency' as const }] : []),
    ...(irr !== undefined ? [{ label: 'Projected IRR', value: irr, format: 'percent' as const }] : []),
    ...(cashOnCash !== undefined ? [{ label: 'Cash on Cash', value: cashOnCash, format: 'percent' as const }] : []),
  ];

  return <MetricGrid metrics={metrics} columns={4} className={className} />;
}

// =============================================================================
// Export Components
// =============================================================================

export {
  MetricTile,
  MetricGrid,
  DataTable,
  PropertyCard,
  ChartPlaceholder,
  MapPlaceholder,
  TextBlock,
  BulletList,
  HighlightBox,
  SectionDivider,
  MarinaMetrics,
  InvestmentMetrics,
};

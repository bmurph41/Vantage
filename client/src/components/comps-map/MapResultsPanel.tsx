import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  ChevronLeft, 
  ChevronRight, 
  MapPin, 
  ArrowUpDown,
  Download,
  ExternalLink,
  Search
} from 'lucide-react';
import type { MapItem, MapConfig } from './types';
import { formatMetricValue, formatMetricLabel } from './types';

interface MapResultsPanelProps {
  config: MapConfig;
  items: MapItem[];
  selectedItemId?: string;
  hoveredItemId?: string;
  onItemSelect: (item: MapItem) => void;
  onItemHover: (item: MapItem | null) => void;
  onExport?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function MapResultsPanel({
  config,
  items,
  selectedItemId,
  hoveredItemId,
  onItemSelect,
  onItemHover,
  onExport,
  isCollapsed = false,
  onToggleCollapse,
}: MapResultsPanelProps) {
  const [sortBy, setSortBy] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const filteredItems = items.filter(item => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(query) ||
      item.city?.toLowerCase().includes(query) ||
      item.state?.toLowerCase().includes(query)
    );
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (!sortBy) return 0;
    const aVal = a.metrics[sortBy] ?? 0;
    const bVal = b.metrics[sortBy] ?? 0;
    const comparison = Number(aVal) - Number(bVal);
    return sortDir === 'asc' ? comparison : -comparison;
  });

  const paginatedItems = sortedItems.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(sortedItems.length / pageSize);

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  if (isCollapsed) {
    return (
      <div className="w-10 bg-background border-l flex flex-col items-center py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="h-8 w-8 p-0"
          data-testid="button-expand-panel"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="mt-4 text-xs font-medium vertical-text">
          {items.length} Results
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-background border-l flex flex-col" data-testid="map-results-panel">
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">{items.length} Results</h3>
          <div className="flex items-center gap-1">
            {onExport && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onExport}
                className="h-8 w-8 p-0"
                data-testid="button-export-results"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className="h-8 w-8 p-0"
              data-testid="button-collapse-panel"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Filter results..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 text-xs pl-7"
            data-testid="input-filter-results"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Sort:</span>
          <Select value={sortBy || 'none'} onValueChange={(v) => setSortBy(v === 'none' ? '' : v)}>
            <SelectTrigger className="h-7 text-xs flex-1" data-testid="select-sort-by">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {config.metricsConfig.sort.map(field => (
                <SelectItem key={field} value={field}>
                  {formatMetricLabel(field)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
            data-testid="button-toggle-sort"
          >
            <ArrowUpDown className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {paginatedItems.map(item => (
            <Card
              key={item.id}
              className={`p-3 cursor-pointer transition-colors ${
                selectedItemId === item.id 
                  ? 'ring-2 ring-primary bg-primary/5' 
                  : hoveredItemId === item.id 
                    ? 'bg-muted' 
                    : 'hover:bg-muted/50'
              }`}
              onClick={() => onItemSelect(item)}
              onMouseEnter={() => onItemHover(item)}
              onMouseLeave={() => onItemHover(null)}
              data-testid={`result-card-${item.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">{item.title}</h4>
                  {(item.city || item.state) && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" />
                      {[item.city, item.state].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
                {item.isSubject && (
                  <Badge variant="destructive" className="text-[10px] px-1 py-0">
                    Subject
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
                {config.metricsConfig.card.slice(0, 4).map(field => {
                  const value = item.metrics[field];
                  if (value === undefined || value === null) return null;
                  return (
                    <div key={field} className="text-xs">
                      <span className="text-muted-foreground">{formatMetricLabel(field)}:</span>{' '}
                      <span className="font-medium">{formatMetricValue(field, value)}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}

          {paginatedItems.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              No results found
            </div>
          )}
        </div>
      </ScrollArea>

      {totalPages > 1 && (
        <div className="p-2 border-t flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="h-7"
            data-testid="button-prev-page"
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <span className="text-xs text-muted-foreground">
            {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="h-7"
            data-testid="button-next-page"
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Layers, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UnitTypeBreakdown {
  unitType: string;
  unitTypeLabel: string;
  unitUtil: {
    totalUnits: number;
    occupiedUnits: number;
    vacantUnits: number;
    offlineUnits: number;
    availableUnits: number;
    utilizationPct: number;
  };
  weightedUtil: {
    totalCapacity: number;
    occupiedCapacity: number;
    weightedUtilPct: number;
    label: string;
  };
  bands: any[];
}

interface UtilizationByTypeTableProps {
  byUnitType: UnitTypeBreakdown[];
  viewMode: 'unit' | 'weighted';
  loading: boolean;
  onRowClick?: (unitType: string) => void;
}

export default function UtilizationByTypeTable({
  byUnitType,
  viewMode,
  loading,
  onRowClick,
}: UtilizationByTypeTableProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!byUnitType || byUnitType.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Utilization by Unit Type
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">No unit type data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Utilization by Unit Type
        </CardTitle>
        <CardDescription>
          {viewMode === 'unit' ? 'Unit count-based' : 'Capacity-weighted'} utilization by slip/storage type
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto w-full">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Occupied</TableHead>
              <TableHead className="text-right">Offline</TableHead>
              {viewMode === 'weighted' && (
                <>
                  <TableHead className="text-right">Capacity</TableHead>
                  <TableHead className="text-right">Occ. Capacity</TableHead>
                </>
              )}
              <TableHead className="text-right w-[140px]">Utilization</TableHead>
              <TableHead className="w-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {byUnitType.map((ut) => {
              const pct = viewMode === 'unit' ? ut.unitUtil.utilizationPct : ut.weightedUtil.weightedUtilPct;
              return (
                <TableRow
                  key={ut.unitType}
                  className={cn(onRowClick && "cursor-pointer hover:bg-muted/50")}
                  onClick={() => onRowClick?.(ut.unitType)}
                >
                  <TableCell className="font-medium">{ut.unitTypeLabel}</TableCell>
                  <TableCell className="text-right">{ut.unitUtil.totalUnits}</TableCell>
                  <TableCell className="text-right text-green-600">{ut.unitUtil.occupiedUnits}</TableCell>
                  <TableCell className="text-right">
                    {ut.unitUtil.offlineUnits > 0 ? (
                      <span className="text-amber-600">{ut.unitUtil.offlineUnits}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  {viewMode === 'weighted' && (
                    <>
                      <TableCell className="text-right text-muted-foreground">
                        {ut.weightedUtil.totalCapacity.toFixed(0)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {ut.weightedUtil.occupiedCapacity.toFixed(0)}
                      </TableCell>
                    </>
                  )}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Progress value={pct} className="h-2 w-16" />
                      <Badge
                        variant={pct >= 90 ? "default" : pct >= 70 ? "secondary" : "destructive"}
                        className="min-w-[52px] justify-center"
                      >
                        {pct.toFixed(1)}%
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    {onRowClick && ut.bands.length > 0 && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );
}

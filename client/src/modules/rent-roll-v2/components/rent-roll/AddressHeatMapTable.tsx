import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { getAddressHeatMap } from "../lib/rentRollApi";
import { MapPin, Download } from "lucide-react";

interface AddressHeatMapTableProps {
  locationId: string | null;
}

export default function AddressHeatMapTable({ locationId }: AddressHeatMapTableProps) {
  const [groupBy, setGroupBy] = useState<"state" | "city">("state");

  const { data: stateData = [], isLoading: isLoadingState } = useQuery({
    queryKey: ["/api/rent-roll/address-heatmap", "state", locationId],
    queryFn: () => getAddressHeatMap("state", locationId),
  });

  const { data: cityData = [], isLoading: isLoadingCity } = useQuery({
    queryKey: ["/api/rent-roll/address-heatmap", "city", locationId],
    queryFn: () => getAddressHeatMap("city", locationId),
  });

  const isLoading = groupBy === "state" ? isLoadingState : isLoadingCity;

  const data = groupBy === "state" ? stateData : cityData;
  const maxCount = data.length > 0 ? Math.max(...data.map((d) => d.count)) : 1;

  const getBarWidth = (count: number) => {
    return (count / maxCount) * 100;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="address-heatmap">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 space-y-0 pb-4">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Customer Address Distribution
        </CardTitle>
        <Button variant="outline" size="default" data-testid="button-export-heatmap">
          <Download className="w-4 h-4" />
          Export
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as "state" | "city")}>
          <TabsList className="mb-4">
            <TabsTrigger value="state" data-testid="tab-by-state">
              By State
            </TabsTrigger>
            <TabsTrigger value="city" data-testid="tab-by-city">
              By City
            </TabsTrigger>
          </TabsList>

          <TabsContent value="state" className="mt-0">
            {stateData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground" data-testid="empty-state-heatmap">
                <p className="text-sm">No address data available</p>
                <p className="text-xs mt-1">Add leases with state information to see distribution</p>
              </div>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold w-32">State</TableHead>
                      <TableHead className="font-semibold text-right w-24">Count</TableHead>
                      <TableHead className="font-semibold">Distribution</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stateData.map((item, idx) => (
                      <TableRow
                        key={item.label}
                        className={idx % 2 === 0 ? "bg-background" : "bg-muted/30"}
                        data-testid={`state-row-${item.label}`}
                      >
                        <TableCell className="font-medium">{item.label}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {item.count}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <Progress
                                value={getBarWidth(item.count)}
                                className="h-6"
                                data-testid={`progress-${item.label}`}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-12 text-right tabular-nums">
                              {((item.count / stateData.reduce((sum, d) => sum + d.count, 0)) * 100).toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="city" className="mt-0">
            {cityData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground" data-testid="empty-state-heatmap-city">
                <p className="text-sm">No address data available</p>
                <p className="text-xs mt-1">Add leases with city information to see distribution</p>
              </div>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">City</TableHead>
                      <TableHead className="font-semibold text-right w-24">Count</TableHead>
                      <TableHead className="font-semibold">Distribution</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cityData.map((item, idx) => (
                      <TableRow
                        key={item.label}
                        className={idx % 2 === 0 ? "bg-background" : "bg-muted/30"}
                        data-testid={`city-row-${item.label}`}
                      >
                        <TableCell className="font-medium">{item.label}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {item.count}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <Progress
                                value={getBarWidth(item.count)}
                                className="h-6"
                                data-testid={`progress-${item.label}`}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-12 text-right tabular-nums">
                              {((item.count / cityData.reduce((sum, d) => sum + d.count, 0)) * 100).toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

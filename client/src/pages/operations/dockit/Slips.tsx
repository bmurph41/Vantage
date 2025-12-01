import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Anchor, Plus, Search, Filter, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DockitAppShell from "@/components/dockit/DockitAppShell";

export default function DockitSlips() {
  const { data: slips, isLoading } = useQuery({
    queryKey: ["/dockit/api/slips"],
    retry: false,
  });

  const { data: leases } = useQuery({
    queryKey: ["/dockit/api/leases/active"],
    retry: false,
  });

  return (
    <DockitAppShell title="Slips & Leases" description="Manage marina slips and lease agreements">
      <Tabs defaultValue="slips" className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <TabsList>
            <TabsTrigger value="slips" data-testid="tab-slips">Slips</TabsTrigger>
            <TabsTrigger value="leases" data-testid="tab-leases">Active Leases</TabsTrigger>
          </TabsList>
          <Button data-testid="button-add-slip">
            <Plus className="h-4 w-4 mr-2" />
            Add Slip
          </Button>
        </div>

        <TabsContent value="slips" className="space-y-6">
          {/* Slips Search */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search slips..." className="pl-9" data-testid="input-search-slips" />
            </div>
            <Button variant="outline" size="icon" data-testid="button-filter-slips">
              <Filter className="h-4 w-4" />
            </Button>
          </div>

          {/* Slips List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Anchor className="h-5 w-5" />
                All Slips
              </CardTitle>
              <CardDescription>
                {isLoading ? "Loading..." : `${Array.isArray(slips) ? slips.length : 0} slips`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : !slips || (Array.isArray(slips) && slips.length === 0) ? (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <Anchor className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No slips configured</p>
                  <Button variant="link" className="mt-2" data-testid="button-add-first-slip">
                    Add your first slip
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.isArray(slips) && slips.map((slip: any, index: number) => (
                    <div 
                      key={slip.id || index} 
                      className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                      data-testid={`slip-item-${index}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Slip {slip.number || slip.slipNumber || index + 1}</span>
                        <Badge variant={slip.status === 'occupied' ? 'default' : 'secondary'}>
                          {slip.status || 'available'}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Size: {slip.length || 'N/A'}' x {slip.width || 'N/A'}'</p>
                        {slip.currentTenant && <p>Tenant: {slip.currentTenant}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leases" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Active Leases</CardTitle>
              <CardDescription>
                {Array.isArray(leases) ? leases.length : 0} active lease agreements
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!leases || (Array.isArray(leases) && leases.length === 0) ? (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <Anchor className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No active leases</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Array.isArray(leases) && leases.map((lease: any, index: number) => (
                    <div 
                      key={lease.id || index} 
                      className="flex items-center justify-between p-4 border rounded-lg"
                      data-testid={`lease-item-${index}`}
                    >
                      <div>
                        <p className="font-medium">{lease.customerName || 'Unknown Customer'}</p>
                        <p className="text-sm text-muted-foreground">
                          Slip {lease.slipNumber || 'N/A'} • ${lease.monthlyRate || 0}/month
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">
                          {lease.endDate ? new Date(lease.endDate).toLocaleDateString() : 'Ongoing'}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuItem>Renew Lease</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">End Lease</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DockitAppShell>
  );
}

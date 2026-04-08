import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Building2, DollarSign, Users, TrendingUp } from "lucide-react";
import { RentRollEntriesTable } from "@/components/rent-roll/RentRollEntriesTable";
import { RentRollDialog } from "@/components/rent-roll/RentRollDialog";
import { RentRollEntryDialog } from "@/components/rent-roll/RentRollEntryDialog";
import { RENT_ROLL_QUERY_KEYS } from "@/types/rent-roll";
import type { RentRoll, RentRollEntry, RentRollSummary } from "@/types/rent-roll";

export default function RentRollPage() {
  const [selectedRentRollId, setSelectedRentRollId] = useState<string | null>(null);
  const [selectedContext, setSelectedContext] = useState<"operational" | "valuation">("operational");
  const [isRentRollDialogOpen, setIsRentRollDialogOpen] = useState(false);
  const [isEntryDialogOpen, setIsEntryDialogOpen] = useState(false);
  const [editingRentRoll, setEditingRentRoll] = useState<RentRoll | null>(null);

  const rentRollsQuery = useQuery<RentRoll[]>({
    queryKey: RENT_ROLL_QUERY_KEYS.all(),
  });

  const filteredRentRolls = rentRollsQuery.data?.filter(
    (rr) => rr.context === selectedContext
  ) || [];

  const selectedRentRoll = filteredRentRolls.find((rr) => rr.id === selectedRentRollId);

  // Reset selection when context changes or selected rent roll is no longer in filtered list
  useEffect(() => {
    if (selectedRentRollId && !selectedRentRoll) {
      setSelectedRentRollId(null);
      setIsEntryDialogOpen(false);
    }
  }, [selectedContext, selectedRentRollId, selectedRentRoll]);

  const entriesQuery = useQuery<RentRollEntry[]>({
    queryKey: selectedRentRollId ? RENT_ROLL_QUERY_KEYS.entries(selectedRentRollId) : ['no-rent-roll'],
    enabled: !!selectedRentRollId,
  });

  const summaryQuery = useQuery<RentRollSummary>({
    queryKey: selectedRentRollId ? RENT_ROLL_QUERY_KEYS.summary(selectedRentRollId) : ['no-summary'],
    enabled: !!selectedRentRollId,
  });

  const handleCreateRentRoll = () => {
    setEditingRentRoll(null);
    setIsRentRollDialogOpen(true);
  };

  const handleEditRentRoll = () => {
    if (selectedRentRoll) {
      setEditingRentRoll(selectedRentRoll);
      setIsRentRollDialogOpen(true);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-rent-roll">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="heading-rent-roll">
            Rent Roll
          </h1>
          <p className="text-muted-foreground" data-testid="description-rent-roll">
            Manage and analyze marina unit occupancy and rental income across operational and valuation scenarios.
          </p>
        </div>
        <Button
          onClick={handleCreateRentRoll}
          data-testid="button-create-rent-roll"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Rent Roll
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block">Select Rent Roll</label>
          <Select
            value={selectedRentRollId || ""}
            onValueChange={setSelectedRentRollId}
            disabled={!filteredRentRolls.length}
          >
            <SelectTrigger data-testid="select-rent-roll">
              <SelectValue placeholder="Choose a rent roll..." />
            </SelectTrigger>
            <SelectContent>
              {filteredRentRolls.map((rr) => (
                <SelectItem key={rr.id} value={rr.id}>
                  {rr.name} - {new Date(rr.effectiveDate).toLocaleDateString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-64">
          <label className="text-sm font-medium mb-2 block">Context</label>
          <Tabs value={selectedContext} onValueChange={(v) => setSelectedContext(v as typeof selectedContext)}>
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2">
              <TabsTrigger value="operational" data-testid="tab-operational">
                Operational
              </TabsTrigger>
              <TabsTrigger value="valuation" data-testid="tab-valuation">
                Valuation
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {selectedRentRoll && (
          <div className="pt-6">
            <Button
              variant="outline"
              onClick={handleEditRentRoll}
              data-testid="button-edit-rent-roll"
            >
              Edit Rent Roll
            </Button>
          </div>
        )}
      </div>

      {!selectedRentRollId && filteredRentRolls.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Rent Rolls Found</h3>
            <p className="text-muted-foreground mb-4">
              Create your first {selectedContext} rent roll to start tracking unit occupancy and revenue.
            </p>
            <Button onClick={handleCreateRentRoll}>
              <Plus className="h-4 w-4 mr-2" />
              Create Rent Roll
            </Button>
          </CardContent>
        </Card>
      )}

      {!selectedRentRollId && filteredRentRolls.length > 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Select a Rent Roll</h3>
            <p className="text-muted-foreground">
              Choose a rent roll from the dropdown above to view details and entries.
            </p>
          </CardContent>
        </Card>
      )}

      {selectedRentRollId && selectedRentRoll && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Units</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {summaryQuery.isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-bold" data-testid="metric-total-units">
                    {summaryQuery.data?.totalUnits || 0}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {summaryQuery.data?.occupiedUnits || 0} occupied, {summaryQuery.data?.vacantUnits || 0} vacant
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {summaryQuery.isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold" data-testid="metric-occupancy-rate">
                    {formatPercent(summaryQuery.data?.occupancyRate || 0)}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Current occupancy
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {summaryQuery.isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold" data-testid="metric-monthly-revenue">
                    {formatCurrency(summaryQuery.data?.totalMonthlyRevenue || 0)}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Total monthly
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {summaryQuery.isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold" data-testid="metric-average-rate">
                    {formatCurrency(summaryQuery.data?.averageRatePerUnit || 0)}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Per unit/month
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Rent Roll Entries</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    All units in {selectedRentRoll.name}
                  </p>
                </div>
                <Button
                  onClick={() => setIsEntryDialogOpen(true)}
                  data-testid="button-add-entry"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Entry
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <RentRollEntriesTable
                entries={entriesQuery.data || []}
                isLoading={entriesQuery.isLoading}
                rentRollId={selectedRentRollId}
              />
            </CardContent>
          </Card>
        </>
      )}

      <RentRollDialog
        open={isRentRollDialogOpen}
        onOpenChange={setIsRentRollDialogOpen}
        rentRoll={editingRentRoll}
        defaultContext={selectedContext}
      />

      {selectedRentRollId && (
        <RentRollEntryDialog
          open={isEntryDialogOpen}
          onOpenChange={setIsEntryDialogOpen}
          rentRollId={selectedRentRollId}
          entry={null}
        />
      )}
    </div>
  );
}

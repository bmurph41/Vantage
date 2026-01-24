import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, subMonths } from "date-fns";
import { Download, Building2, Fuel, ShoppingCart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface Marina {
  id: string;
  name: string;
  location: string;
  fuelTransactionCount: number;
  shipStoreSaleCount: number;
  hasData: boolean;
}

interface ImportFromActualsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName?: string;
}

export default function ImportFromActualsModal({
  open,
  onOpenChange,
  projectId,
  projectName,
}: ImportFromActualsModalProps) {
  const { toast } = useToast();
  const [selectedMarina, setSelectedMarina] = useState<string | null>(null);
  const [importFuel, setImportFuel] = useState(true);
  const [importStore, setImportStore] = useState(true);
  const [startDate, setStartDate] = useState(format(subMonths(new Date(), 12), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: marinas = [], isLoading } = useQuery<Marina[]>({
    queryKey: ["/api/operations-context/projects", projectId, "ops/import/available"],
    queryFn: async () => {
      const res = await fetch(`/api/operations-context/projects/${projectId}/ops/import/available`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch marinas");
      const data = await res.json();
      return data.data || [];
    },
    enabled: open,
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const dataTypes: string[] = [];
      if (importFuel) dataTypes.push("fuel");
      if (importStore) dataTypes.push("ship-store");
      
      return apiRequest(`/api/operations-context/projects/${projectId}/ops/import`, {
        method: "POST",
        body: JSON.stringify({
          marinaId: selectedMarina,
          dataTypes,
          startDate,
          endDate,
        }),
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations-context/projects", projectId] });
      const imported = data.data?.imported || {};
      toast({
        title: "Import Complete",
        description: `Imported ${imported.fuelTransactions || 0} fuel transactions and ${imported.shipStoreSales || 0} ship store sales`,
      });
      onOpenChange(false);
      setSelectedMarina(null);
    },
    onError: () => {
      toast({
        title: "Import Failed",
        description: "Failed to import operations data",
        variant: "destructive",
      });
    },
  });

  const selectedMarinaData = marinas.find((m) => m.id === selectedMarina);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Import from Actuals
          </DialogTitle>
          <DialogDescription>
            Import operations data from your owned marinas into {projectName || "this project"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label className="mb-2 block">Select Marina</Label>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : marinas.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-6 text-center">
                  <Building2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    No marinas with operations data available
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add operations data in the Operations sidebar first
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {marinas.map((marina) => (
                  <Card
                    key={marina.id}
                    className={`cursor-pointer transition-colors ${
                      selectedMarina === marina.id
                        ? "border-primary bg-primary/5"
                        : "hover:border-primary/50"
                    }`}
                    onClick={() => setSelectedMarina(marina.id)}
                  >
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{marina.name}</p>
                          <p className="text-xs text-muted-foreground">{marina.location}</p>
                        </div>
                        <div className="flex gap-2">
                          {marina.fuelTransactionCount > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <Fuel className="h-3 w-3 mr-1" />
                              {marina.fuelTransactionCount}
                            </Badge>
                          )}
                          {marina.shipStoreSaleCount > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <ShoppingCart className="h-3 w-3 mr-1" />
                              {marina.shipStoreSaleCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {selectedMarina && (
            <>
              <div>
                <Label className="mb-2 block">Data to Import</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="import-fuel"
                      checked={importFuel}
                      onCheckedChange={(checked) => setImportFuel(checked === true)}
                      disabled={selectedMarinaData?.fuelTransactionCount === 0}
                    />
                    <Label htmlFor="import-fuel" className="flex items-center gap-2">
                      <Fuel className="h-4 w-4" />
                      Fuel Transactions
                      {selectedMarinaData && (
                        <Badge variant="secondary" className="text-xs">
                          {selectedMarinaData.fuelTransactionCount} records
                        </Badge>
                      )}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="import-store"
                      checked={importStore}
                      onCheckedChange={(checked) => setImportStore(checked === true)}
                      disabled={selectedMarinaData?.shipStoreSaleCount === 0}
                    />
                    <Label htmlFor="import-store" className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      Ship Store Sales
                      {selectedMarinaData && (
                        <Badge variant="secondary" className="text-xs">
                          {selectedMarinaData.shipStoreSaleCount} records
                        </Badge>
                      )}
                    </Label>
                  </div>
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Date Range</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start-date" className="text-xs text-muted-foreground">
                      Start Date
                    </Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-date" className="text-xs text-muted-foreground">
                      End Date
                    </Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => importMutation.mutate()}
            disabled={!selectedMarina || (!importFuel && !importStore) || importMutation.isPending}
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Import Data
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

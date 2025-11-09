import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { AddDeliveryModal } from "@/components/fuel/add-delivery-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { InventoryResponse, DeliveriesResponse } from "@/types/fuel-api";
import { 
  Package, 
  AlertTriangle, 
  TrendingDown, 
  Truck, 
  Edit3,
  CheckCircle 
} from "lucide-react";

export default function Inventory() {
  const [isAddDeliveryModalOpen, setIsAddDeliveryModalOpen] = useState(false);
  const [editingInventory, setEditingInventory] = useState<string | null>(null);
  const [newLevel, setNewLevel] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: inventory = [], isLoading: inventoryLoading } = useQuery<InventoryResponse>({
    queryKey: ['/api/operations/fuel-inventory'],
  });

  const { data: deliveries = [], isLoading: deliveriesLoading } = useQuery<DeliveriesResponse>({
    queryKey: ['/api/operations/fuel-deliveries'],
  });

  const updateInventoryMutation = useMutation({
    mutationFn: async (data: { id: string; level: string }) => {
      const response = await apiRequest("PATCH", `/api/operations/fuel-inventory/${data.id}`, { currentLevel: data.level });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/operations/fuel-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/operations/fuel-sales/stats/summary'] });
      toast({
        title: "Success",
        description: "Inventory level updated successfully!",
      });
      setEditingInventory(null);
      setNewLevel("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update inventory",
        variant: "destructive",
      });
    },
  });

  const handleUpdateInventory = (id: string) => {
    if (newLevel && parseFloat(newLevel) >= 0) {
      updateInventoryMutation.mutate({ id, level: newLevel });
    }
  };

  const getStockStatus = (currentLevel: number, reorderPoint: number) => {
    if (currentLevel <= reorderPoint) {
      return { status: 'low', color: 'bg-destructive', text: 'Low Stock' };
    } else if (currentLevel <= reorderPoint * 1.5) {
      return { status: 'medium', color: 'bg-yellow-500', text: 'Medium Stock' };
    } else {
      return { status: 'good', color: 'bg-accent', text: 'Good Stock' };
    }
  };

  const calculateStockPercentage = (currentLevel: number, capacity: number) => {
    return Math.min((currentLevel / capacity) * 100, 100);
  };

  const getDaysRemaining = (currentLevel: number, avgDaily: number = 500) => {
    return Math.floor(currentLevel / avgDaily);
  };

  if (inventoryLoading || deliveriesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <>
      <Header 
        title="Fuel Inventory Management"
        subtitle="Monitor fuel tank levels and manage inventory"
      />

      <div className="p-6 space-y-6">
        {/* Action Buttons */}
        <div className="flex justify-end">
          <Button 
            onClick={() => setIsAddDeliveryModalOpen(true)}
            data-testid="button-add-delivery"
          >
            <Package className="w-4 h-4 mr-2" />
            Add Delivery
          </Button>
        </div>

        {/* Current Inventory Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {inventory?.map((item, index) => {
            const currentLevel = parseFloat(item.currentLevel);
            const capacity = parseFloat(item.capacity);
            const reorderPoint = parseFloat(item.reorderPoint);
            const stockStatus = getStockStatus(currentLevel, reorderPoint);
            const stockPercentage = calculateStockPercentage(currentLevel, capacity);
            const daysRemaining = getDaysRemaining(currentLevel);

            return (
              <Card key={item.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg" data-testid={`inventory-title-${index}`}>
                      {item.fuelType.name}
                    </CardTitle>
                    <div className={`w-3 h-3 rounded-full ${stockStatus.color}`} data-testid={`inventory-status-indicator-${index}`} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Fuel Level Display */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Current Level</span>
                      <span className="font-medium" data-testid={`inventory-level-${index}`}>
                        {currentLevel.toLocaleString()} / {capacity.toLocaleString()} gal
                      </span>
                    </div>
                    <Progress value={stockPercentage} className="h-2" data-testid={`inventory-progress-${index}`} />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{stockPercentage.toFixed(1)}% Full</span>
                      <span>{daysRemaining} days remaining</span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <Badge 
                    className={`${stockStatus.color} text-white`}
                    data-testid={`inventory-status-badge-${index}`}
                  >
                    {stockStatus.status === 'low' && <AlertTriangle className="w-3 h-3 mr-1" />}
                    {stockStatus.status === 'medium' && <TrendingDown className="w-3 h-3 mr-1" />}
                    {stockStatus.status === 'good' && <CheckCircle className="w-3 h-3 mr-1" />}
                    {stockStatus.text}
                  </Badge>

                  {/* Quick Actions */}
                  <div className="flex space-x-2">
                    {editingInventory === item.id ? (
                      <div className="flex space-x-2 w-full">
                        <Input
                          type="number"
                          placeholder="New level"
                          value={newLevel}
                          onChange={(e) => setNewLevel(e.target.value)}
                          className="flex-1"
                          data-testid={`input-new-level-${index}`}
                        />
                        <Button 
                          size="sm" 
                          onClick={() => handleUpdateInventory(item.id)}
                          disabled={updateInventoryMutation.isPending}
                          data-testid={`button-save-level-${index}`}
                        >
                          Save
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => {
                            setEditingInventory(null);
                            setNewLevel("");
                          }}
                          data-testid={`button-cancel-edit-${index}`}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => {
                          setEditingInventory(item.id);
                          setNewLevel(currentLevel.toString());
                        }}
                        className="w-full"
                        data-testid={`button-edit-level-${index}`}
                      >
                        <Edit3 className="w-4 h-4 mr-2" />
                        Update Level
                      </Button>
                    )}
                  </div>

                  {/* Reorder Info */}
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>Reorder Point:</span>
                      <span data-testid={`inventory-reorder-point-${index}`}>{reorderPoint.toLocaleString()} gal</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Reorder Quantity:</span>
                      <span data-testid={`inventory-reorder-quantity-${index}`}>{parseFloat(item.reorderQuantity).toLocaleString()} gal</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last Updated:</span>
                      <span data-testid={`inventory-last-updated-${index}`}>{new Date(item.lastUpdated).toLocaleDateString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Recent Deliveries */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center" data-testid="recent-deliveries-title">
              <Truck className="w-5 h-5 mr-2" />
              Recent Deliveries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Fuel Type</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Quantity</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Cost</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Cost/Gal</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Supplier</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {deliveries?.map((delivery, index) => {
                    const costPerGallon = parseFloat(delivery.cost) / parseFloat(delivery.quantity);
                    
                    return (
                      <tr key={delivery.id} className="hover:bg-muted/30">
                        <td className="p-4 text-sm text-foreground" data-testid={`delivery-date-${index}`}>
                          {new Date(delivery.deliveryDate).toLocaleDateString()}
                        </td>
                        <td className="p-4 text-sm text-foreground" data-testid={`delivery-fuel-${index}`}>
                          {delivery.fuelType.name}
                        </td>
                        <td className="p-4 text-sm text-foreground" data-testid={`delivery-quantity-${index}`}>
                          {parseFloat(delivery.quantity).toLocaleString()} gal
                        </td>
                        <td className="p-4 text-sm font-medium text-foreground" data-testid={`delivery-cost-${index}`}>
                          ${parseFloat(delivery.cost).toLocaleString()}
                        </td>
                        <td className="p-4 text-sm text-foreground" data-testid={`delivery-cost-per-gal-${index}`}>
                          ${costPerGallon.toFixed(3)}
                        </td>
                        <td className="p-4 text-sm text-foreground" data-testid={`delivery-supplier-${index}`}>
                          {delivery.supplier}
                        </td>
                        <td className="p-4 text-sm text-muted-foreground" data-testid={`delivery-invoice-${index}`}>
                          {delivery.invoiceNumber || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <AddDeliveryModal
        isOpen={isAddDeliveryModalOpen}
        onClose={() => setIsAddDeliveryModalOpen(false)}
      />
    </>
  );
}

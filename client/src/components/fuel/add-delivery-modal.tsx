import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { FuelTypesResponse } from "@/types/fuel-api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const deliverySchema = z.object({
  fuelTypeId: z.string().min(1, "Please select a fuel type"),
  quantity: z.string().min(1, "Please enter quantity").refine((val) => parseFloat(val) > 0, "Quantity must be greater than 0"),
  cost: z.string().min(1, "Please enter cost").refine((val) => parseFloat(val) > 0, "Cost must be greater than 0"),
  supplier: z.string().min(1, "Please enter supplier name"),
  deliveryDate: z.string().min(1, "Please select delivery date"),
  invoiceNumber: z.string().optional(),
});

interface AddDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddDeliveryModal({ isOpen, onClose }: AddDeliveryModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof deliverySchema>>({
    resolver: zodResolver(deliverySchema),
    defaultValues: {
      fuelTypeId: "",
      quantity: "",
      cost: "",
      supplier: "",
      deliveryDate: "",
      invoiceNumber: "",
    },
  });

  const { data: fuelTypes = [] } = useQuery<FuelTypesResponse>({
    queryKey: ['/api/operations/fuel-types'],
  });

  const createDeliveryMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/operations/fuel-deliveries", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/operations/fuel-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/operations/fuel-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/operations/fuel-sales/stats/summary'] });
      toast({
        title: "Success",
        description: "Delivery added successfully!",
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add delivery",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof deliverySchema>) => {
    const deliveryData = {
      ...data,
      deliveryDate: new Date(data.deliveryDate).toISOString(),
    };

    createDeliveryMutation.mutate(deliveryData);
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-lg" data-testid="modal-add-delivery">
        <DialogHeader>
          <DialogTitle>Add Fuel Delivery</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fuelTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fuel Type</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger data-testid="select-delivery-fuel-type">
                          <SelectValue placeholder="Select fuel type" />
                        </SelectTrigger>
                        <SelectContent>
                          {fuelTypes?.map((fuel) => (
                            <SelectItem key={fuel.id} value={fuel.id}>
                              {fuel.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity (gallons)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.1" 
                        placeholder="0.0"
                        data-testid="input-delivery-quantity"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Cost</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="$0.00"
                        data-testid="input-delivery-cost"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="deliveryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Date</FormLabel>
                    <FormControl>
                      <Input 
                        type="date"
                        data-testid="input-delivery-date"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="supplier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supplier</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter supplier name"
                      data-testid="input-delivery-supplier"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="invoiceNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Number</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter invoice number"
                      data-testid="input-delivery-invoice"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                data-testid="button-cancel-delivery"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createDeliveryMutation.isPending}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                data-testid="button-add-delivery"
              >
                {createDeliveryMutation.isPending ? "Adding..." : "Add Delivery"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

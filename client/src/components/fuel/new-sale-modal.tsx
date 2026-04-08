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

const saleSchema = z.object({
  fuelTypeId: z.string().min(1, "Please select a fuel type"),
  gallons: z.string().min(1, "Please enter gallons").refine((val) => parseFloat(val) > 0, "Gallons must be greater than 0"),
  pricePerGallon: z.string().min(1, "Please enter price per gallon").refine((val) => parseFloat(val) > 0, "Price must be greater than 0"),
  paymentMethod: z.enum(['cash', 'check']),
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional().or(z.literal("")),
});

interface NewSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewSaleModal({ isOpen, onClose }: NewSaleModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof saleSchema>>({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      fuelTypeId: "",
      gallons: "",
      pricePerGallon: "",
      paymentMethod: "cash",
      customerName: "",
      customerEmail: "",
    },
  });

  const { data: fuelTypes = [] } = useQuery<FuelTypesResponse>({
    queryKey: ['/api/operations/fuel-types'],
  });

  const createTransactionMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/operations/fuel-sales", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/operations/fuel-sales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/operations/fuel-sales/stats/summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/operations/fuel-inventory'] });
      toast({
        title: "Success",
        description: "Sale recorded successfully!",
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create sale",
        variant: "destructive",
      });
    },
  });

  const data = form.watch();
  const totalAmount = data.gallons && data.pricePerGallon 
    ? parseFloat(data.gallons) * parseFloat(data.pricePerGallon)
    : 0;

  const onSubmit = (data: z.infer<typeof saleSchema>) => {
    const transactionData = {
      fuelTypeId: data.fuelTypeId,
      gallons: data.gallons,
      pricePerGallon: data.pricePerGallon,
      totalAmount: totalAmount.toString(),
      paymentMethod: data.paymentMethod,
      customerName: data.customerName || null,
      customerEmail: data.customerEmail || null,
      status: 'completed',
    };

    createTransactionMutation.mutate(transactionData);
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-lg" data-testid="modal-new-sale">
        <DialogHeader>
          <DialogTitle>Record New Sale</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fuelTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fuel Type</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger data-testid="select-fuel-type">
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
                name="gallons"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gallons</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.1" 
                        placeholder="0.0"
                        data-testid="input-gallons"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="pricePerGallon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price per Gallon</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="$0.00"
                        data-testid="input-price"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>Total Amount</FormLabel>
                <FormControl>
                  <Input 
                    type="text" 
                    value={totalAmount > 0 ? `$${totalAmount.toFixed(2)}` : "$0.00"}
                    readOnly
                    className="bg-muted"
                    data-testid="input-total"
                  />
                </FormControl>
              </FormItem>
            </div>

            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger data-testid="select-payment-method">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="check">Check</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter customer name"
                        data-testid="input-customer-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customerEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Email</FormLabel>
                    <FormControl>
                      <Input 
                        type="email"
                        placeholder="customer@email.com"
                        data-testid="input-customer-email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createTransactionMutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="button-create-sale"
              >
                {createTransactionMutation.isPending ? "Creating..." : "Create Sale"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

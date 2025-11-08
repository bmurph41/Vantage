import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { insertFuelSaleSchema, type FuelSale } from "@shared/schema";

interface FuelSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fuelSale?: FuelSale | null;
}

const formSchema = insertFuelSaleSchema.extend({
  quantityGallons: z.string().min(1, "Quantity is required"),
  pricePerGallon: z.string().min(1, "Price is required"),
  totalAmount: z.string().min(1, "Total is required"),
  transactionDate: z.string().min(1, "Date is required"),
});

type FormValues = z.infer<typeof formSchema>;

export default function FuelSaleDialog({ open, onOpenChange, fuelSale }: FuelSaleDialogProps) {
  const { toast } = useToast();
  const isEditing = !!fuelSale;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      transactionDate: new Date().toISOString().slice(0, 16),
      fuelType: "regular_gas",
      quantityGallons: "",
      pricePerGallon: "",
      totalAmount: "",
      customerName: "",
      boatName: "",
      slipNumber: "",
      paymentMethod: undefined,
      processedBy: undefined,
      notes: "",
    },
  });

  // Reset form when dialog opens/closes or fuelSale changes
  useEffect(() => {
    if (open) {
      if (fuelSale) {
        form.reset({
          transactionDate: new Date(fuelSale.transactionDate).toISOString().slice(0, 16),
          fuelType: fuelSale.fuelType,
          quantityGallons: fuelSale.quantityGallons.toString(),
          pricePerGallon: fuelSale.pricePerGallon.toString(),
          totalAmount: fuelSale.totalAmount.toString(),
          customerName: fuelSale.customerName || "",
          boatName: fuelSale.boatName || "",
          slipNumber: fuelSale.slipNumber || "",
          paymentMethod: fuelSale.paymentMethod || undefined,
          processedBy: fuelSale.processedBy || undefined,
          notes: fuelSale.notes || "",
        });
      } else {
        form.reset({
          transactionDate: new Date().toISOString().slice(0, 16),
          fuelType: "regular_gas",
          quantityGallons: "",
          pricePerGallon: "",
          totalAmount: "",
          customerName: "",
          boatName: "",
          slipNumber: "",
          paymentMethod: undefined,
          processedBy: undefined,
          notes: "",
        });
      }
    }
  }, [open, fuelSale, form]);

  // Auto-calculate total when quantity or price changes
  const watchQuantity = form.watch("quantityGallons");
  const watchPrice = form.watch("pricePerGallon");

  useEffect(() => {
    if (watchQuantity && watchPrice) {
      const quantity = parseFloat(watchQuantity);
      const price = parseFloat(watchPrice);
      if (!isNaN(quantity) && !isNaN(price)) {
        form.setValue("totalAmount", (quantity * price).toFixed(2));
      }
    }
  }, [watchQuantity, watchPrice, form]);

  // Create/Update mutation
  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const url = isEditing
        ? `/api/operations/fuel-sales/${fuelSale.id}`
        : "/api/operations/fuel-sales";
      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          transactionDate: new Date(data.transactionDate).toISOString(),
        }),
      });

      if (!response.ok) throw new Error("Failed to save fuel sale");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/fuel-sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/operations/fuel-sales/stats/summary"] });
      toast({
        title: "Success",
        description: `Fuel sale ${isEditing ? "updated" : "created"} successfully`,
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: `Failed to ${isEditing ? "update" : "create"} fuel sale`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormValues) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit" : "Add"} Fuel Sale</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update the fuel sale details" : "Record a new fuel sale transaction"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Transaction Date */}
            <FormField
              control={form.control}
              name="transactionDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transaction Date & Time</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} data-testid="input-transaction-date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Fuel Type */}
            <FormField
              control={form.control}
              name="fuelType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fuel Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-fuel-type-form">
                        <SelectValue placeholder="Select fuel type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="diesel">Diesel</SelectItem>
                      <SelectItem value="regular_gas">Regular Gas</SelectItem>
                      <SelectItem value="premium_gas">Premium Gas</SelectItem>
                      <SelectItem value="ethanol_free">Ethanol Free</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Quantity and Price */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="quantityGallons"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gallons</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        data-testid="input-quantity"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pricePerGallon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price/Gallon</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        data-testid="input-price"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="totalAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        data-testid="input-total"
                        readOnly
                      />
                    </FormControl>
                    <FormDescription className="text-xs">Auto-calculated</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Customer Info */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} data-testid="input-customer-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="boatName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Boat Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Sea Breeze" {...field} data-testid="input-boat-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slipNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slip Number</FormLabel>
                    <FormControl>
                      <Input placeholder="A-12" {...field} data-testid="input-slip-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Payment Method */}
            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-payment-method-form">
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                      <SelectItem value="debit_card">Debit Card</SelectItem>
                      <SelectItem value="account_charge">Account Charge</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes..."
                      className="resize-none"
                      {...field}
                      data-testid="input-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-save">
                {mutation.isPending ? "Saving..." : isEditing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

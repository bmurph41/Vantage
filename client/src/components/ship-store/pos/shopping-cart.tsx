import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  sku: string;
}

interface ShoppingCartProps {
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onClear: () => void;
}

export default function ShoppingCart({
  items,
  subtotal,
  tax,
  total,
  onUpdateQuantity,
  onClear,
}: ShoppingCartProps) {
  const [, setLocation] = useLocation();
  const [processingPayment, setProcessingPayment] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createTransactionMutation = useMutation({
    mutationFn: async (transactionData: any) => {
      const response = await apiRequest("POST", "/api/ship-store/transactions", transactionData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ship-store/dashboard/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ship-store/transactions/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ship-store/products"] });
    },
  });

  const processPayment = async (paymentMethod: string) => {
    if (items.length === 0) {
      toast({
        title: "Empty Cart",
        description: "Please add items to cart before processing payment",
        variant: "destructive",
      });
      return;
    }

    setProcessingPayment(true);

    try {
      if (paymentMethod === "stripe") {
        // Create payment intent and redirect to checkout
        const response = await apiRequest("POST", "/api/ship-store/create-payment-intent", {
          amount: total,
        });
        const { clientSecret } = await response.json();
        
        // Store cart data for checkout page
        sessionStorage.setItem("checkoutData", JSON.stringify({
          clientSecret,
          items,
          subtotal,
          tax,
          total,
        }));
        
        setLocation("/operations/ship-store/checkout");
      } else {
        // Simulate Square or other payment methods
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const transactionData = {
          subtotal,
          tax,
          total,
          paymentMethod,
          items: items.map(item => ({
            productId: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            sku: item.sku,
          })),
        };

        await createTransactionMutation.mutateAsync(transactionData);
        
        toast({
          title: "Payment Successful",
          description: `Transaction completed via ${paymentMethod}`,
        });
        
        onClear();
      }
    } catch (error) {
      toast({
        title: "Payment Failed",
        description: "There was an error processing your payment",
        variant: "destructive",
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Current Sale</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Cart Items */}
        <div className="space-y-3 mb-6 max-h-64 overflow-y-auto">
          {items.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <i className="fas fa-shopping-cart text-3xl mb-4"></i>
              <p>Cart is empty</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between py-2 border-b border-border last:border-b-0"
                data-testid={`cart-item-${item.sku}`}
              >
                <div className="flex-1">
                  <p className="font-medium text-sm">{item.name}</p>
                  <p className="text-xs text-muted-foreground">${item.price.toFixed(2)} each</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-6 h-6 p-0"
                    onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                    data-testid={`decrease-${item.sku}`}
                  >
                    -
                  </Button>
                  <span className="font-medium text-sm w-6 text-center">{item.quantity}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-6 h-6 p-0"
                    onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    data-testid={`increase-${item.sku}`}
                  >
                    +
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Total */}
        <div className="space-y-2 mb-6">
          <div className="flex justify-between text-sm">
            <span>Subtotal:</span>
            <span data-testid="cart-subtotal">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Tax (8.25%):</span>
            <span data-testid="cart-tax">${tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg border-t border-border pt-2">
            <span>Total:</span>
            <span data-testid="cart-total">${total.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Options */}
        <div className="space-y-3">
          <Button
            className="w-full"
            onClick={() => processPayment("stripe")}
            disabled={processingPayment || items.length === 0}
            data-testid="pay-stripe"
          >
            <i className="fas fa-credit-card mr-2"></i>
            {processingPayment ? "Processing..." : "Pay with Card (Stripe)"}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => processPayment("square")}
            disabled={processingPayment || items.length === 0}
            data-testid="pay-square"
          >
            <i className="fas fa-mobile-alt mr-2"></i>
            {processingPayment ? "Processing..." : "Pay with Square"}
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={onClear}
            disabled={items.length === 0}
            data-testid="clear-cart"
          >
            Clear Cart
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

import { useEffect, useState } from "react";
import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function Checkout() {
  const stripe = useStripe();
  const elements = useElements();
  const [, setLocation] = useLocation();
  const [checkoutData, setCheckoutData] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createTransactionMutation = useMutation({
    mutationFn: async (transactionData: any) => {
      const response = await apiRequest("POST", "/api/transactions", transactionData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
  });

  useEffect(() => {
    const data = sessionStorage.getItem("checkoutData");
    if (data) {
      setCheckoutData(JSON.parse(data));
    } else {
      setLocation("/pos");
    }
  }, [setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements || !checkoutData) {
      return;
    }

    setProcessing(true);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin + "/pos",
        },
        redirect: "if_required",
      });

      if (error) {
        toast({
          title: "Payment Failed",
          description: error.message,
          variant: "destructive",
        });
      } else if (paymentIntent && paymentIntent.status === "succeeded") {
        // Create transaction record
        const transactionData = {
          subtotal: checkoutData.subtotal.toFixed(2),
          tax: checkoutData.tax.toFixed(2),
          total: checkoutData.total.toFixed(2),
          paymentMethod: "stripe",
          paymentIntentId: paymentIntent.id,
          items: checkoutData.items.map((item: any) => ({
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
          description: "Thank you for your purchase!",
        });

        sessionStorage.removeItem("checkoutData");
        setLocation("/pos");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (!checkoutData) {
    return (
      <div className="p-6">
        <div className="h-screen flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold" data-testid="checkout-title">Checkout</h2>
          <p className="text-muted-foreground">Complete your payment to finish the transaction</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                {checkoutData.items.map((item: any) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{item.name} x{item.quantity}</span>
                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-2 border-t pt-4">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>${checkoutData.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax:</span>
                  <span>${checkoutData.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span>${checkoutData.total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Form */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <PaymentElement />
                <Button
                  type="submit"
                  disabled={!stripe || processing}
                  className="w-full"
                  data-testid="submit-payment"
                >
                  {processing ? "Processing..." : `Pay $${checkoutData.total.toFixed(2)}`}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/pos")}
                  className="w-full"
                  data-testid="cancel-payment"
                >
                  Cancel
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "pk_test_dummy");

function CheckoutForm({ 
  clientSecret, 
  items, 
  subtotal, 
  tax, 
  total,
  customerId,
  customerType,
  customerName,
  onSuccess 
}: { 
  clientSecret: string;
  items: any[];
  subtotal: number;
  tax: number;
  total: number;
  customerId: string | null;
  customerType: string | null;
  customerName: string | null;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });

      if (error) {
        toast({
          title: "Payment Failed",
          description: error.message,
          variant: "destructive",
        });
      } else if (paymentIntent && paymentIntent.status === "succeeded") {
        // Create transaction record after successful payment
        const transactionData = {
          subtotal: subtotal.toString(),
          tax: tax.toString(),
          total: total.toString(),
          paymentMethod: "stripe",
          paymentIntentId: paymentIntent.id,
          customerId,
          customerType,
          customerName,
          items: items.map(item => ({
            productId: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            sku: item.sku,
          })),
        };

        await apiRequest("POST", "/api/ship-store/transactions", transactionData);

        queryClient.invalidateQueries({ queryKey: ["/api/ship-store/dashboard/metrics"] });
        queryClient.invalidateQueries({ queryKey: ["/api/ship-store/transactions/recent"] });
        queryClient.invalidateQueries({ queryKey: ["/api/ship-store/products"] });

        toast({
          title: "Payment Successful",
          description: "Transaction completed successfully",
        });

        onSuccess();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process payment",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-6">
        <PaymentElement />
      </div>
      <div className="flex space-x-3">
        <Button
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-1"
          data-testid="confirm-payment"
        >
          {isProcessing ? "Processing..." : `Pay $${total.toFixed(2)}`}
        </Button>
      </div>
    </form>
  );
}

export default function Checkout() {
  const [, setLocation] = useLocation();
  const [checkoutData, setCheckoutData] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    const data = sessionStorage.getItem("checkoutData");
    if (!data) {
      toast({
        title: "No Checkout Data",
        description: "Returning to POS",
        variant: "destructive",
      });
      setLocation("/operations/ship-store/pos");
      return;
    }

    try {
      const parsed = JSON.parse(data);
      setCheckoutData(parsed);
    } catch (error) {
      toast({
        title: "Invalid Checkout Data",
        description: "Returning to POS",
        variant: "destructive",
      });
      setLocation("/operations/ship-store/pos");
    }
  }, [setLocation, toast]);

  const handleSuccess = () => {
    sessionStorage.removeItem("checkoutData");
    setLocation("/operations/ship-store/pos");
  };

  const handleCancel = () => {
    sessionStorage.removeItem("checkoutData");
    setLocation("/operations/ship-store/pos");
  };

  if (!checkoutData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading checkout...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Complete Payment</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Order Summary */}
          <div className="mb-6 space-y-2">
            <h3 className="font-medium mb-3">Order Summary</h3>
            {checkoutData.items.map((item: any) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>{item.name} x {item.quantity}</span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>${checkoutData.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax</span>
                <span>${checkoutData.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>${checkoutData.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Stripe Payment Form */}
          <Elements stripe={stripePromise} options={{ clientSecret: checkoutData.clientSecret }}>
            <CheckoutForm
              clientSecret={checkoutData.clientSecret}
              items={checkoutData.items}
              subtotal={checkoutData.subtotal}
              tax={checkoutData.tax}
              total={checkoutData.total}
              customerId={checkoutData.customerId || null}
              customerType={checkoutData.customerType || null}
              customerName={checkoutData.customerName || null}
              onSuccess={handleSuccess}
            />
          </Elements>

          {/* Cancel Button */}
          <Button
            variant="outline"
            className="w-full mt-3"
            onClick={handleCancel}
            data-testid="cancel-checkout"
          >
            Cancel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

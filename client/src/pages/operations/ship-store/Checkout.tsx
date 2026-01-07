import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, CreditCard } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Checkout() {
  const [, setLocation] = useLocation();

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card data-testid="checkout-coming-soon">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Online Checkout
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Online payment processing is coming soon. During beta, please use the Point of Sale 
              system to process cash or card payments directly.
            </AlertDescription>
          </Alert>
          
          <p className="text-muted-foreground">
            We're working on integrating secure online payment processing. In the meantime, 
            all transactions can be completed through the Ship Store POS system.
          </p>

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => setLocation("/operations/ship-store")}
              data-testid="button-back-to-store"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Ship Store
            </Button>
            <Button 
              onClick={() => setLocation("/operations/ship-store/pos")}
              data-testid="button-go-to-pos"
            >
              Go to POS
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

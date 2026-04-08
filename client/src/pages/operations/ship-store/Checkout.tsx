import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CreditCard, Trash2, ShoppingCart } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

interface CartItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

const TAX_RATE = 0.0825;

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([
    { id: "1", name: "Dock Line 3/8\" x 15'", quantity: 2, price: 24.99 },
    { id: "2", name: "Marine Polish 16oz", quantity: 1, price: 18.50 },
    { id: "3", name: "LED Navigation Light", quantity: 1, price: 45.00 },
  ]);

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;

  const removeItem = (id: string) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, qty: number) => {
    if (qty < 1) return;
    setCartItems(prev => prev.map(item => item.id === id ? { ...item, quantity: qty } : item));
  };

  const handleProcessPayment = async () => {
    if (!paymentMethod) {
      toast({ title: "Select Payment Method", description: "Please choose a payment method before processing.", variant: "destructive" });
      return;
    }
    if (cartItems.length === 0) {
      toast({ title: "Cart Empty", description: "Add items to the cart before checkout.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      toast({ title: "Payment Processed", description: `$${total.toFixed(2)} charged via ${paymentMethod}. Receipt sent.` });
      setCartItems([]);
      setPaymentMethod("");
    }, 1500);
  };

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <Card data-testid="checkout-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Checkout
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {cartItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Cart is empty</p>
              <p>Add items from the Ship Store to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-center w-24">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cartItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</Button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">${item.price.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">${(item.price * item.quantity).toFixed(2)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem(item.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}

          {cartItems.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax (8.25%)</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Payment Method</label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Credit Card">Credit Card</SelectItem>
                    <SelectItem value="Store Account">Store Account</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button className="w-full" size="lg" onClick={handleProcessPayment} disabled={isProcessing}>
                <CreditCard className="h-4 w-4 mr-2" />
                {isProcessing ? "Processing..." : `Process Payment — $${total.toFixed(2)}`}
              </Button>
            </>
          )}

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

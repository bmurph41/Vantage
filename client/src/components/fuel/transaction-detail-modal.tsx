import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { TransactionWithFuelType } from "@/types/fuel-api";
import { format } from "date-fns";
import { Calendar, User, Mail, Droplet, DollarSign, CreditCard, CheckCircle2 } from "lucide-react";

interface TransactionDetailModalProps {
  transaction: TransactionWithFuelType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransactionDetailModal({ transaction, open, onOpenChange }: TransactionDetailModalProps) {
  if (!transaction) return null;

  const getPaymentMethodBadge = (method: string) => {
    const variants: Record<string, string> = {
      cash: "bg-green-100 text-green-800 border-green-200",
      check: "bg-yellow-100 text-yellow-800 border-yellow-200",
    };
    return variants[method] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      completed: "bg-green-100 text-green-800 border-green-200",
      pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
      failed: "bg-red-100 text-red-800 border-red-200",
      refunded: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return variants[status] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="transaction-detail-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Transaction Details</span>
            <Badge className={getStatusBadge(transaction.status)} data-testid="badge-header-status">
              {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            <span data-testid="text-transaction-id">Transaction ID: {transaction.id}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Date & Time */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Calendar className="w-4 h-4" />
              Date & Time
            </div>
            <div className="pl-6 space-y-1">
              <p className="font-medium" data-testid="text-transaction-date">
                {format(new Date(transaction.createdAt), "MMMM dd, yyyy")}
              </p>
              <p className="text-sm text-muted-foreground" data-testid="text-transaction-time">
                {format(new Date(transaction.createdAt), "hh:mm:ss a")}
              </p>
            </div>
          </div>

          <Separator />

          {/* Customer Information */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <User className="w-4 h-4" />
              Customer Information
            </div>
            <div className="pl-6 space-y-2">
              {transaction.customerName ? (
                <div className="flex items-center gap-2" data-testid="text-customer-name">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>{transaction.customerName}</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="text-customer-name-empty">No customer name provided</p>
              )}
              {transaction.customerEmail ? (
                <div className="flex items-center gap-2" data-testid="text-customer-email">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span>{transaction.customerEmail}</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="text-customer-email-empty">No customer email provided</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Fuel Details */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Droplet className="w-4 h-4" />
              Fuel Details
            </div>
            <div className="pl-6 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Fuel Type</span>
                <span className="font-medium" data-testid="text-fuel-type">{transaction.fuelType?.name || 'Unknown'}</span>
              </div>
              {transaction.fuelType?.category && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Category</span>
                  <span className="font-medium" data-testid="text-fuel-category">{transaction.fuelType.category}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Gallons</span>
                <span className="font-medium" data-testid="text-fuel-gallons">{parseFloat(transaction.gallons).toFixed(2)} gal</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Price per Gallon</span>
                <span className="font-medium" data-testid="text-fuel-price-per-gallon">${parseFloat(transaction.pricePerGallon).toFixed(3)}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Payment Information */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CreditCard className="w-4 h-4" />
              Payment Information
            </div>
            <div className="pl-6 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Payment Method</span>
                <Badge className={getPaymentMethodBadge(transaction.paymentMethod)} data-testid="badge-payment-method">
                  {transaction.paymentMethod.charAt(0).toUpperCase() + transaction.paymentMethod.slice(1)}
                </Badge>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm font-medium">Total Amount</span>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <span className="text-2xl font-bold text-green-600" data-testid="text-total-amount">
                    {parseFloat(transaction.totalAmount).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Transaction Status */}
          {transaction.status !== 'completed' && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4" />
                  Status
                </div>
                <div className="pl-6">
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusBadge(transaction.status)} data-testid="badge-transaction-status">
                      {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                    </Badge>
                    {transaction.status === 'failed' && (
                      <span className="text-sm text-muted-foreground" data-testid="text-status-message">This transaction failed to process</span>
                    )}
                    {transaction.status === 'pending' && (
                      <span className="text-sm text-muted-foreground" data-testid="text-status-message">This transaction is being processed</span>
                    )}
                    {transaction.status === 'refunded' && (
                      <span className="text-sm text-muted-foreground" data-testid="text-status-message">This transaction was refunded</span>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

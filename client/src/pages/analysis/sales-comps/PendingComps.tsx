import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, X, MapPin, DollarSign, Calendar, Building, ArrowLeft, Clock, Send, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type PendingSalesComp = {
  id: string;
  orgId: string;
  sourceType: string;
  sourcePropertyId?: string | null;
  marina?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  salePrice?: number | null;
  saleMonth?: number | null;
  saleYear?: number | null;
  capRate?: string | null;
  sellerName?: string | null;
  buyerName?: string | null;
  brokerName?: string | null;
  transactionType?: string | null;
  notes?: string | null;
  status: string;
  suggestedDuplicates?: any[];
  createdSalesCompId?: string | null;
  createdBy: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
};

const formatCurrency = (amount: number | string | null | undefined) => {
  if (!amount) return "—";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

const statusBadge = (status: string) => {
  switch (status) {
    case 'pending':
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" />Pending Review</Badge>;
    case 'accepted':
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><Check className="w-3 h-3 mr-1" />Accepted</Badge>;
    case 'rejected':
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><X className="w-3 h-3 mr-1" />Rejected</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export default function PendingComps() {
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: 'accept' | 'reject' } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pendingComps = [], isLoading } = useQuery<PendingSalesComp[]>({
    queryKey: ['/api/pending-sales-comps'],
  });

  const acceptMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/pending-sales-comps/${id}/accept`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pending-sales-comps'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales-comps'] });
      toast({ title: "Sales comp created from pending transaction" });
      setConfirmAction(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to accept", description: error?.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/pending-sales-comps/${id}/reject`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pending-sales-comps'] });
      toast({ title: "Pending comp rejected" });
      setConfirmAction(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to reject", description: error?.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/pending-sales-comps/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pending-sales-comps'] });
      toast({ title: "Pending comp deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete", description: error?.message, variant: "destructive" });
    },
  });

  const pendingItems = pendingComps.filter(c => c.status === 'pending');
  const reviewedItems = pendingComps.filter(c => c.status !== 'pending');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/analysis/sales-comps">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Sales Comps
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Pending Sales Comps</h1>
          <p className="text-sm text-muted-foreground">
            Review transactions sent from property sales history before adding them as sales comps
          </p>
        </div>
        {pendingItems.length > 0 && (
          <Badge className="ml-auto bg-yellow-100 text-yellow-800 border-yellow-200">
            {pendingItems.length} pending
          </Badge>
        )}
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6 space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : pendingComps.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Send className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-600 mb-1">No Pending Comps</h3>
            <p className="text-sm text-gray-500">
              When you send transactions from a property's sales history, they'll appear here for review
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {pendingItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  Awaiting Review ({pendingItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Marina / Address</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Sale Price</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Seller</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingItems.map((comp) => (
                      <TableRow key={comp.id}>
                        <TableCell>
                          <div className="space-y-0.5">
                            {comp.marina && <div className="font-medium">{comp.marina}</div>}
                            {comp.address && <div className="text-xs text-muted-foreground">{comp.address}</div>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            {[comp.city, comp.state].filter(Boolean).join(', ') || '—'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="w-3 h-3 text-gray-400" />
                            {comp.saleMonth && comp.saleYear
                              ? `${String(comp.saleMonth).padStart(2, '0')}/${comp.saleYear}`
                              : comp.saleYear || '—'}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {comp.salePrice ? (
                            <span className="text-green-700">{formatCurrency(comp.salePrice)}</span>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-sm">{comp.buyerName || '—'}</TableCell>
                        <TableCell className="text-sm">{comp.sellerName || '—'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-green-700 border-green-200 hover:bg-green-50"
                              onClick={() => setConfirmAction({ id: comp.id, action: 'accept' })}
                              disabled={acceptMutation.isPending}
                            >
                              <Check className="w-3.5 h-3.5 mr-1" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-red-700 border-red-200 hover:bg-red-50"
                              onClick={() => setConfirmAction({ id: comp.id, action: 'reject' })}
                              disabled={rejectMutation.isPending}
                            >
                              <X className="w-3.5 h-3.5 mr-1" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                              onClick={() => deleteMutation.mutate(comp.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {reviewedItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Check className="w-5 h-5 text-gray-400" />
                  Reviewed ({reviewedItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Marina / Address</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Sale Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reviewed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviewedItems.map((comp) => (
                      <TableRow key={comp.id} className="opacity-70">
                        <TableCell>
                          <div className="space-y-0.5">
                            {comp.marina && <div className="font-medium">{comp.marina}</div>}
                            {comp.address && <div className="text-xs text-muted-foreground">{comp.address}</div>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            {[comp.city, comp.state].filter(Boolean).join(', ') || '—'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {comp.saleMonth && comp.saleYear
                            ? `${String(comp.saleMonth).padStart(2, '0')}/${comp.saleYear}`
                            : comp.saleYear || '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {comp.salePrice ? formatCurrency(comp.salePrice) : '—'}
                        </TableCell>
                        <TableCell>{statusBadge(comp.status)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {comp.reviewedAt ? new Date(comp.reviewedAt).toLocaleDateString() : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.action === 'accept' ? 'Accept this transaction?' : 'Reject this transaction?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.action === 'accept'
                ? 'This will create a new sales comp from this transaction data.'
                : 'This transaction will be marked as rejected and will not be added to sales comps.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={confirmAction?.action === 'accept' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
              onClick={() => {
                if (confirmAction?.action === 'accept') {
                  acceptMutation.mutate(confirmAction.id);
                } else if (confirmAction) {
                  rejectMutation.mutate(confirmAction.id);
                }
              }}
            >
              {confirmAction?.action === 'accept' ? 'Accept & Create Comp' : 'Reject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

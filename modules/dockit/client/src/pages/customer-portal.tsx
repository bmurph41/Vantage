import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Calendar, MapPin, Anchor, User, Mail, Phone, Edit2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Mock customer ID - in production this would come from authentication
const CUSTOMER_ID = "mock-customer-id";

type Reservation = {
  id: string;
  confirmationCode: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  numberOfNights: number;
  totalAmount: string;
  baseRate: string;
  specialRequests?: string;
  marinaId: string;
  slipId: string;
  boatId: string;
  customerId: string;
  createdAt: string;
};

export default function CustomerPortal() {
  const { toast } = useToast();
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  // Fetch customer data
  const { data: customer } = useQuery({
    queryKey: ["/api/customers", CUSTOMER_ID],
    queryFn: async () => apiRequest(`/api/customers/${CUSTOMER_ID}`),
  });

  // Fetch customer reservations
  const { data: reservations = [], isLoading: reservationsLoading } = useQuery({
    queryKey: ["/api/customers", CUSTOMER_ID, "reservations"],
    queryFn: async () => apiRequest(`/api/customers/${CUSTOMER_ID}/reservations`),
  });

  // Fetch customer boats
  const { data: boats = [] } = useQuery({
    queryKey: ["/api/boats"],
    queryFn: async () => apiRequest("/api/boats"),
  });

  // Cancel reservation mutation
  const cancelMutation = useMutation({
    mutationFn: async (reservationId: string) => {
      return apiRequest(`/api/reservations/${reservationId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: "Reservation cancelled",
        description: "Your reservation has been successfully cancelled.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", CUSTOMER_ID, "reservations"] });
      setCancelDialogOpen(false);
      setSelectedReservation(null);
    },
    onError: () => {
      toast({
        title: "Cancellation failed",
        description: "Unable to cancel your reservation. Please contact support.",
        variant: "destructive",
      });
    },
  });

  const upcomingReservations = reservations.filter((r: Reservation) => 
    new Date(r.checkInDate) >= new Date() && r.status !== "cancelled"
  );

  const pastReservations = reservations.filter((r: Reservation) => 
    new Date(r.checkOutDate) < new Date() || r.status === "cancelled"
  );

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      confirmed: "default",
      pending: "secondary",
      cancelled: "destructive",
      completed: "outline",
    };
    return (
      <Badge variant={variants[status] || "default"} className="capitalize">
        {status}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <User className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-4xl font-bold"data-testid="text-customer-name">{customer?.name || "My Account"}</h1>
              <p className="text-blue-100">Manage your reservations and account details</p>
            </div>
          </div>

          {customer && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-blue-100" />
                    <div>
                      <p className="text-xs text-blue-100">Email</p>
                      <p className="font-medium" data-testid="text-customer-email">{customer.email}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-blue-100" />
                    <div>
                      <p className="text-xs text-blue-100">Phone</p>
                      <p className="font-medium" data-testid="text-customer-phone">{customer.phone}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Anchor className="w-5 h-5 text-blue-100" />
                    <div>
                      <p className="text-xs text-blue-100">Total Reservations</p>
                      <p className="font-medium text-2xl" data-testid="text-total-reservations">{reservations.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Tabs defaultValue="upcoming" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="upcoming" data-testid="tab-upcoming">
              Upcoming ({upcomingReservations.length})
            </TabsTrigger>
            <TabsTrigger value="past" data-testid="tab-past">
              Past ({pastReservations.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-4">
            {reservationsLoading ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">Loading reservations...</p>
                </CardContent>
              </Card>
            ) : upcomingReservations.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <Anchor className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">No upcoming reservations</p>
                  <p className="text-muted-foreground mb-6">Book your next slip to get started</p>
                  <Button onClick={() => window.location.href = '/book'} data-testid="button-book-now">
                    Book Now
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {upcomingReservations.map((reservation: Reservation) => (
                  <Card key={reservation.id} data-testid={`card-reservation-${reservation.id}`}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            Confirmation: {reservation.confirmationCode}
                          </CardTitle>
                          <CardDescription className="mt-2">
                            {reservation.numberOfNights} night{reservation.numberOfNights !== 1 ? 's' : ''}
                          </CardDescription>
                        </div>
                        {getStatusBadge(reservation.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div>
                          <Label className="text-muted-foreground">Check-in</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Calendar className="w-4 h-4 text-blue-600" />
                            <p className="font-medium">{format(new Date(reservation.checkInDate), "PPP")}</p>
                          </div>
                        </div>

                        <div>
                          <Label className="text-muted-foreground">Check-out</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Calendar className="w-4 h-4 text-blue-600" />
                            <p className="font-medium">{format(new Date(reservation.checkOutDate), "PPP")}</p>
                          </div>
                        </div>

                        <div>
                          <Label className="text-muted-foreground">Total Amount</Label>
                          <p className="text-2xl font-bold text-blue-600 mt-1">
                            ${parseFloat(reservation.totalAmount).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {reservation.specialRequests && (
                        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                          <Label className="text-muted-foreground">Special Requests</Label>
                          <p className="mt-1">{reservation.specialRequests}</p>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setSelectedReservation(reservation);
                            setCancelDialogOpen(true);
                          }}
                          data-testid={`button-cancel-${reservation.id}`}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel Reservation
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-4">
            {pastReservations.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">No past reservations</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {pastReservations.map((reservation: Reservation) => (
                  <Card key={reservation.id} className="opacity-75" data-testid={`card-past-reservation-${reservation.id}`}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="flex items-center gap-2 text-lg">
                            Confirmation: {reservation.confirmationCode}
                          </CardTitle>
                          <CardDescription className="mt-2">
                            {format(new Date(reservation.checkInDate), "PP")} - {format(new Date(reservation.checkOutDate), "PP")}
                          </CardDescription>
                        </div>
                        {getStatusBadge(reservation.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center">
                        <div>
                          <Label className="text-muted-foreground">Total Paid</Label>
                          <p className="text-xl font-bold">
                            ${parseFloat(reservation.totalAmount).toFixed(2)}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm">View Details</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* My Boats Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>My Vessels</CardTitle>
            <CardDescription>Manage your registered boats</CardDescription>
          </CardHeader>
          <CardContent>
            {boats.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No vessels registered yet</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {boats.filter((boat: any) => boat.customerId === CUSTOMER_ID).map((boat: any) => (
                  <Card key={boat.id} data-testid={`card-boat-${boat.id}`}>
                    <CardHeader>
                      <CardTitle className="text-lg">{boat.name}</CardTitle>
                      <CardDescription>
                        {boat.make} {boat.model} {boat.year ? `(${boat.year})` : ''}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Length:</span>
                          <span className="font-medium">{boat.length}'</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Beam:</span>
                          <span className="font-medium">{boat.beam}'</span>
                        </div>
                        {boat.draft && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Draft:</span>
                            <span className="font-medium">{boat.draft}'</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent data-testid="dialog-cancel-confirmation">
          <DialogHeader>
            <DialogTitle>Cancel Reservation</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this reservation? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedReservation && (
            <div className="py-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Confirmation:</span>
                  <span className="font-medium">{selectedReservation.confirmationCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Check-in:</span>
                  <span className="font-medium">{format(new Date(selectedReservation.checkInDate), "PP")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Amount:</span>
                  <span className="font-medium">${parseFloat(selectedReservation.totalAmount).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setCancelDialogOpen(false)}
              data-testid="button-cancel-dialog-close"
            >
              Keep Reservation
            </Button>
            <Button 
              variant="destructive"
              onClick={() => selectedReservation && cancelMutation.mutate(selectedReservation.id)}
              disabled={cancelMutation.isPending}
              data-testid="button-confirm-cancel"
            >
              {cancelMutation.isPending ? "Cancelling..." : "Cancel Reservation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

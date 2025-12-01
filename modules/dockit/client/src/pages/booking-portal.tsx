import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays } from "date-fns";
import { CalendarIcon, Anchor, Waves, Shield, Check, MapPin, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

type Slip = {
  id: string;
  number: string;
  type: string;
  section: string;
  maxLength: string;
  maxBeam: string;
  maxDraft: string | null;
  utilities: string[] | null;
  monthlyRate: string;
};

const searchFormSchema = z.object({
  marinaId: z.string().min(1, "Marina is required"),
  checkInDate: z.date({ required_error: "Check-in date is required" }),
  checkOutDate: z.date({ required_error: "Check-out date is required" }),
  boatLength: z.string().min(1, "Boat length is required").transform((val) => parseFloat(val)).pipe(
    z.number().positive("Boat length must be a positive number")
  ),
  boatBeam: z.string().min(1, "Boat beam is required").transform((val) => parseFloat(val)).pipe(
    z.number().positive("Boat beam must be a positive number")
  ),
  boatDraft: z.string().optional().transform((val) => val ? parseFloat(val) : undefined).pipe(
    z.number().positive("Boat draft must be a positive number").optional()
  ),
}).refine((data) => data.checkOutDate > data.checkInDate, {
  message: "Check-out date must be after check-in date",
  path: ["checkOutDate"],
}).refine((data) => {
  const nights = differenceInDays(data.checkOutDate, data.checkInDate);
  return nights >= 1;
}, {
  message: "Minimum stay is 1 night",
  path: ["checkOutDate"],
});

const bookingFormSchema = z.object({
  customerName: z.string().min(2, "Name is required"),
  customerEmail: z.string().email("Valid email is required"),
  customerPhone: z.string().min(10, "Valid phone number is required"),
  boatName: z.string().min(1, "Boat name is required"),
  boatMake: z.string().optional(),
  boatModel: z.string().optional(),
  boatYear: z.string().optional().transform((val) => val ? parseInt(val) : undefined).pipe(
    z.number().int().min(1900).max(new Date().getFullYear() + 1).optional().or(z.undefined())
  ),
  specialRequests: z.string().optional(),
});

export default function BookingPortal() {
  const { toast } = useToast();
  const [step, setStep] = useState<"search" | "select" | "details" | "confirmation">("search");
  const [searchParams, setSearchParams] = useState<any>(null);
  const [selectedSlip, setSelectedSlip] = useState<Slip | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<any>(null);

  const searchForm = useForm({
    resolver: zodResolver(searchFormSchema),
    defaultValues: {
      marinaId: "",
      checkInDate: undefined,
      checkOutDate: undefined,
      boatLength: "",
      boatBeam: "",
      boatDraft: "",
    },
  });

  const bookingForm = useForm({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      boatName: "",
      boatMake: "",
      boatModel: "",
      boatYear: "",
      specialRequests: "",
    },
  });

  // Fetch marinas
  const { data: marinas = [] } = useQuery({
    queryKey: ["/api/marinas"],
  });

  // Search available slips
  const searchMutation = useMutation({
    mutationFn: async (data: any) => {
      // Store validated data for later use
      setSearchParams(data);
      
      return apiRequest("/api/reservations/search-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marinaId: data.marinaId,
          checkInDate: data.checkInDate.toISOString(),
          checkOutDate: data.checkOutDate.toISOString(),
          boatLength: data.boatLength, // Already a number from Zod transform
          boatBeam: data.boatBeam, // Already a number from Zod transform
        }),
      });
    },
    onSuccess: (slips) => {
      if (slips.length === 0) {
        toast({
          title: "No availability",
          description: "No slips match your search criteria. Try different dates or boat dimensions.",
          variant: "destructive",
        });
      } else {
        setStep("select");
      }
    },
    onError: () => {
      toast({
        title: "Search failed",
        description: "Unable to search for available slips. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create reservation
  const bookingMutation = useMutation({
    mutationFn: async (data: any) => {
      // First create customer
      const customer = await apiRequest("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.customerName,
          email: data.customerEmail,
          phone: data.customerPhone,
        }),
      });

      // Then create boat
      const boat = await apiRequest("/api/boats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer.id,
          name: data.boatName,
          make: data.boatMake || "",
          model: data.boatModel || "",
          year: data.boatYear || null, // Already a number from Zod transform
          length: searchParams.boatLength, // Already a number from Zod transform
          beam: searchParams.boatBeam, // Already a number from Zod transform
          draft: searchParams.boatDraft || null, // Already a number or undefined from Zod transform
        }),
      });

      // Finally create reservation
      const numberOfNights = differenceInDays(searchParams.checkOutDate, searchParams.checkInDate);
      return apiRequest("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marinaId: searchParams.marinaId,
          customerId: customer.id,
          boatId: boat.id,
          slipId: selectedSlip!.id,
          checkInDate: searchParams.checkInDate.toISOString(),
          checkOutDate: searchParams.checkOutDate.toISOString(),
          numberOfNights,
          status: "confirmed",
          specialRequests: data.specialRequests || "",
        }),
      });
    },
    onSuccess: (reservation) => {
      setConfirmedBooking(reservation);
      setStep("confirmation");
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
    },
    onError: (error: any) => {
      toast({
        title: "Booking failed",
        description: error.message || "Unable to complete your reservation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSearch = (data: any) => {
    searchMutation.mutate(data);
  };

  const handleSlipSelect = (slip: Slip) => {
    setSelectedSlip(slip);
    setStep("details");
  };

  const handleBooking = (data: any) => {
    bookingMutation.mutate(data);
  };

  const availableSlips = searchMutation.data || [];
  const numberOfNights = searchParams 
    ? differenceInDays(searchParams.checkOutDate, searchParams.checkInDate)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero Section */}
      {step === "search" && (
        <div className="relative h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1920')] bg-cover bg-center opacity-20"></div>
          
          <div className="relative z-10 max-w-2xl mx-auto px-4 w-full">
            <div className="text-center mb-8">
              <Anchor className="w-16 h-16 mx-auto mb-4 text-white" />
              <h1 className="text-5xl font-bold text-white mb-4">Find Your Perfect Slip</h1>
              <p className="text-xl text-blue-100">Book your transient slip in minutes with instant confirmation</p>
            </div>

            <Card className="backdrop-blur-xl bg-white/95 shadow-2xl">
              <CardHeader>
                <CardTitle data-testid="text-booking-title">Search Available Slips</CardTitle>
                <CardDescription>Enter your boat details and dates to find available slips</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...searchForm}>
                  <form onSubmit={searchForm.handleSubmit(handleSearch)} className="space-y-6">
                    <FormField
                      control={searchForm.control}
                      name="marinaId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Marina</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-marina">
                                <SelectValue placeholder="Select a marina" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {marinas.map((marina: any) => (
                                <SelectItem key={marina.id} value={marina.id}>
                                  {marina.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={searchForm.control}
                        name="checkInDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Check-in Date</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    data-testid="button-check-in-date"
                                    className={cn(
                                      "pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? format(field.value, "PPP") : "Pick a date"}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) => date < new Date()}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={searchForm.control}
                        name="checkOutDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Check-out Date</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    data-testid="button-check-out-date"
                                    className={cn(
                                      "pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? format(field.value, "PPP") : "Pick a date"}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) => date < new Date() || (searchForm.watch("checkInDate") && date <= searchForm.watch("checkInDate"))}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={searchForm.control}
                        name="boatLength"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Length (ft)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="35" data-testid="input-boat-length" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={searchForm.control}
                        name="boatBeam"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Beam (ft)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="12" data-testid="input-boat-beam" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={searchForm.control}
                        name="boatDraft"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Draft (ft) <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="4.5" data-testid="input-boat-draft" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-6"
                      disabled={searchMutation.isPending}
                      data-testid="button-search-availability"
                    >
                      {searchMutation.isPending ? "Searching..." : "Search Availability"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Trust Elements */}
            <div className="mt-12 grid grid-cols-3 gap-8 text-center text-white">
              <div>
                <Shield className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">Secure Booking</p>
              </div>
              <div>
                <Zap className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">Instant Confirmation</p>
              </div>
              <div>
                <Waves className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">Premium Facilities</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Available Slips Selection */}
      {step === "select" && (
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="mb-8">
            <Button 
              variant="outline" 
              onClick={() => setStep("search")}
              data-testid="button-back-to-search"
            >
              ← Back to Search
            </Button>
          </div>

          <div className="mb-12">
            <h2 className="text-4xl font-bold mb-4">Available Slips</h2>
            <p className="text-lg text-muted-foreground">
              Found {availableSlips.length} slip{availableSlips.length !== 1 ? 's' : ''} for {numberOfNights} night{numberOfNights !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableSlips.map((slip: Slip) => (
              <Card 
                key={slip.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleSlipSelect(slip)}
                data-testid={`card-slip-${slip.id}`}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Slip {slip.number}</CardTitle>
                      <CardDescription className="mt-1">
                        <MapPin className="inline w-4 h-4 mr-1" />
                        Section {slip.section}
                      </CardDescription>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                      Available
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Type</p>
                      <p className="font-medium capitalize">{slip.type}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-muted-foreground">Dimensions</p>
                      <p className="font-medium">{slip.maxLength}' × {slip.maxBeam}'</p>
                    </div>

                    {slip.utilities && slip.utilities.length > 0 && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Amenities</p>
                        <div className="flex flex-wrap gap-2">
                          {slip.utilities.map((utility: string, idx: number) => (
                            <span 
                              key={idx}
                              className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700"
                            >
                              {utility}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-4 border-t">
                      <p className="text-2xl font-bold text-blue-600">
                        ${parseFloat(slip.monthlyRate) / 30 * numberOfNights}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ${parseFloat(slip.monthlyRate) / 30}/night
                      </p>
                    </div>

                    <Button className="w-full" data-testid={`button-select-slip-${slip.id}`}>
                      Select This Slip
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Booking Details Form */}
      {step === "details" && selectedSlip && (
        <div className="max-w-4xl mx-auto px-4 py-16">
          <div className="mb-8">
            <Button 
              variant="outline" 
              onClick={() => setStep("select")}
              data-testid="button-back-to-slips"
            >
              ← Back to Slip Selection
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Complete Your Booking</CardTitle>
                  <CardDescription>Fill in your details to confirm your reservation</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...bookingForm}>
                    <form onSubmit={bookingForm.handleSubmit(handleBooking)} className="space-y-6">
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Contact Information</h3>
                        
                        <FormField
                          control={bookingForm.control}
                          name="customerName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name</FormLabel>
                              <FormControl>
                                <Input placeholder="John Smith" data-testid="input-customer-name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={bookingForm.control}
                            name="customerEmail"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                  <Input type="email" placeholder="john@example.com" data-testid="input-customer-email" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={bookingForm.control}
                            name="customerPhone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Phone</FormLabel>
                                <FormControl>
                                  <Input placeholder="(555) 123-4567" data-testid="input-customer-phone" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Vessel Information</h3>
                        
                        <FormField
                          control={bookingForm.control}
                          name="boatName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Boat Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Sea Breeze" data-testid="input-boat-name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            control={bookingForm.control}
                            name="boatMake"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Make</FormLabel>
                                <FormControl>
                                  <Input placeholder="Beneteau" data-testid="input-boat-make" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={bookingForm.control}
                            name="boatModel"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Model</FormLabel>
                                <FormControl>
                                  <Input placeholder="Oceanis 38" data-testid="input-boat-model" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={bookingForm.control}
                            name="boatYear"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Year</FormLabel>
                                <FormControl>
                                  <Input placeholder="2020" data-testid="input-boat-year" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      <FormField
                        control={bookingForm.control}
                        name="specialRequests"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Special Requests <span className="text-muted-foreground text-sm">(optional)</span></FormLabel>
                            <FormControl>
                              <Input placeholder="Early check-in, specific dock location, etc." data-testid="input-special-requests" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button 
                        type="submit" 
                        className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-6"
                        disabled={bookingMutation.isPending}
                        data-testid="button-complete-booking"
                      >
                        {bookingMutation.isPending ? "Processing..." : "Complete Booking"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </div>

            {/* Booking Summary Sidebar */}
            <div>
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle>Booking Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Slip</p>
                    <p className="font-semibold">#{selectedSlip.number} - Section {selectedSlip.section}</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Check-in</p>
                    <p className="font-semibold">{format(searchParams.checkInDate, "PPP")}</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Check-out</p>
                    <p className="font-semibold">{format(searchParams.checkOutDate, "PPP")}</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Duration</p>
                    <p className="font-semibold">{numberOfNights} night{numberOfNights !== 1 ? 's' : ''}</p>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Rate per night</span>
                      <span className="font-medium">${(parseFloat(selectedSlip.monthlyRate) / 30).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between mb-4">
                      <span className="text-sm">{numberOfNights} × nights</span>
                      <span className="font-medium">${(parseFloat(selectedSlip.monthlyRate) / 30 * numberOfNights).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="text-lg font-semibold">Total</span>
                      <span className="text-2xl font-bold text-blue-600" data-testid="text-total-amount">
                        ${(parseFloat(selectedSlip.monthlyRate) / 30 * numberOfNights).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation */}
      {step === "confirmation" && confirmedBooking && (
        <div className="max-w-3xl mx-auto px-4 py-16">
          <Card>
            <CardHeader className="text-center pb-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-3xl">Booking Confirmed!</CardTitle>
              <CardDescription className="text-lg mt-2">
                Your reservation has been confirmed. Check your email for details.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-blue-50 p-6 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Confirmation Code</p>
                <p className="text-3xl font-bold text-blue-600" data-testid="text-confirmation-code">
                  {confirmedBooking.confirmationCode}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Slip Number</p>
                  <p className="font-semibold text-lg">{selectedSlip?.number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Section</p>
                  <p className="font-semibold text-lg">{selectedSlip?.section}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Check-in</p>
                  <p className="font-semibold">{format(new Date(confirmedBooking.checkInDate), "PPP")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Check-out</p>
                  <p className="font-semibold">{format(new Date(confirmedBooking.checkOutDate), "PPP")}</p>
                </div>
              </div>

              <div className="pt-6 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Total Paid</span>
                  <span className="text-2xl font-bold text-blue-600">
                    ${parseFloat(confirmedBooking.totalAmount).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="pt-6 flex gap-4">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => window.print()}
                  data-testid="button-print-confirmation"
                >
                  Print Confirmation
                </Button>
                <Button 
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    setStep("search");
                    setSearchParams(null);
                    setSelectedSlip(null);
                    setConfirmedBooking(null);
                    searchForm.reset();
                    bookingForm.reset();
                  }}
                  data-testid="button-new-booking"
                >
                  Make Another Booking
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

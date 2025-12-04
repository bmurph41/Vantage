import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Ship, Send, RefreshCw, CheckCircle, AlertCircle, Anchor } from "lucide-react";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

interface BrokerInfo {
  brokerName: string;
  contactName: string;
}

export default function BrokerPortal() {
  const params = useParams();
  const token = params.token as string;
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    propertyName: "",
    propertyAddress: "",
    city: "",
    state: "",
    askingPrice: "",
    totalSlips: "",
    grossRevenue: "",
    description: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    additionalNotes: "",
  });

  const { data: brokerInfo, isLoading, error } = useQuery<BrokerInfo>({
    queryKey: ["/api/marinamatch/public/broker-portal", token],
    queryFn: async () => {
      const response = await fetch(`/api/marinamatch/public/broker-portal/${token}`);
      if (!response.ok) {
        throw new Error("Invalid or expired portal link");
      }
      return response.json();
    },
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/marinamatch/public/broker-portal/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to submit");
      }
      return response.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: "Deal Submitted!",
        description: "Your marina listing has been submitted for review.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitMutation.mutate({
      ...formData,
      totalSlips: formData.totalSlips ? parseInt(formData.totalSlips) : undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <Skeleton className="h-12 w-12 mx-auto rounded-full mb-4" />
            <Skeleton className="h-6 w-48 mx-auto mb-2" />
            <Skeleton className="h-4 w-32 mx-auto" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !brokerInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto p-3 bg-red-100 dark:bg-red-900 rounded-full w-fit mb-4">
              <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-xl">Invalid Portal Link</CardTitle>
            <CardDescription>
              This broker portal link is invalid or has expired. Please contact your MarinaMatch representative for a new link.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto p-3 bg-green-100 dark:bg-green-900 rounded-full w-fit mb-4">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-xl">Deal Submitted Successfully!</CardTitle>
            <CardDescription>
              Thank you for submitting your marina listing. The investment team will review it shortly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => {
              setSubmitted(false);
              setFormData({
                propertyName: "",
                propertyAddress: "",
                city: "",
                state: "",
                askingPrice: "",
                totalSlips: "",
                grossRevenue: "",
                description: "",
                contactName: "",
                contactEmail: "",
                contactPhone: "",
                additionalNotes: "",
              });
            }}>
              Submit Another Deal
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-800 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="mx-auto p-3 bg-primary/10 rounded-full w-fit mb-4">
            <Anchor className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">MarinaMatch Deal Submission</h1>
          <p className="text-muted-foreground">
            Welcome, {brokerInfo.contactName || brokerInfo.brokerName}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ship className="h-5 w-5" />
              Submit Marina Listing
            </CardTitle>
            <CardDescription>
              Fill out the details below to submit a marina listing for investment review
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="propertyName">Marina Name *</Label>
                <Input
                  id="propertyName"
                  value={formData.propertyName}
                  onChange={(e) => setFormData({ ...formData, propertyName: e.target.value })}
                  placeholder="Sunset Marina"
                  required
                  data-testid="portal-input-property-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="propertyAddress">Address</Label>
                <Input
                  id="propertyAddress"
                  value={formData.propertyAddress}
                  onChange={(e) => setFormData({ ...formData, propertyAddress: e.target.value })}
                  placeholder="123 Harbor Drive"
                  data-testid="portal-input-address"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Miami"
                    data-testid="portal-input-city"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Select
                    value={formData.state}
                    onValueChange={(value) => setFormData({ ...formData, state: value })}
                  >
                    <SelectTrigger data-testid="portal-select-state">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="askingPrice">Asking Price ($)</Label>
                  <Input
                    id="askingPrice"
                    value={formData.askingPrice}
                    onChange={(e) => setFormData({ ...formData, askingPrice: e.target.value })}
                    placeholder="2,500,000"
                    data-testid="portal-input-price"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="totalSlips">Total Slips</Label>
                  <Input
                    id="totalSlips"
                    type="number"
                    value={formData.totalSlips}
                    onChange={(e) => setFormData({ ...formData, totalSlips: e.target.value })}
                    placeholder="150"
                    data-testid="portal-input-slips"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="grossRevenue">Annual Gross Revenue ($)</Label>
                <Input
                  id="grossRevenue"
                  value={formData.grossRevenue}
                  onChange={(e) => setFormData({ ...formData, grossRevenue: e.target.value })}
                  placeholder="500,000"
                  data-testid="portal-input-revenue"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Property Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the marina, its amenities, and condition..."
                  rows={3}
                  data-testid="portal-textarea-description"
                />
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium mb-3">Your Contact Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactName">Your Name</Label>
                    <Input
                      id="contactName"
                      value={formData.contactName}
                      onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                      placeholder="John Smith"
                      data-testid="portal-input-contact-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">Email</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={formData.contactEmail}
                      onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                      placeholder="john@example.com"
                      data-testid="portal-input-contact-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactPhone">Phone</Label>
                    <Input
                      id="contactPhone"
                      value={formData.contactPhone}
                      onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                      placeholder="(555) 123-4567"
                      data-testid="portal-input-contact-phone"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="additionalNotes">Additional Notes</Label>
                <Textarea
                  id="additionalNotes"
                  value={formData.additionalNotes}
                  onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
                  placeholder="Any other information that might be helpful..."
                  rows={2}
                  data-testid="portal-textarea-notes"
                />
              </div>
            </CardContent>

            <CardFooter>
              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={submitMutation.isPending}
                data-testid="portal-btn-submit"
              >
                {submitMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Listing
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Powered by MarinaMatch Intel
        </p>
      </div>
    </div>
  );
}

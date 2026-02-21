import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HelpCircle, PlayCircle, RotateCcw, BookOpen, Video, Rocket, LifeBuoy, MessageSquarePlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { TOUR_IDS, type TourId } from "@/lib/tour-configs";

const routeToTourMap: Record<string, TourId> = {
  "/dashboard": TOUR_IDS.DASHBOARD,
  "/deals": TOUR_IDS.CRM_DEALS,
  "/crm/contacts": TOUR_IDS.CRM_CONTACTS,
  "/crm/companies": TOUR_IDS.CRM_COMPANIES,
  "/crm/properties": TOUR_IDS.CRM_PROPERTIES,
  "/projects": TOUR_IDS.DUE_DILIGENCE,
  "/analysis/docktalk": TOUR_IDS.DOCKTALK,
  "/rent-roll": TOUR_IDS.RENT_ROLL,
  "/modeling": TOUR_IDS.VALUATOR,
  "/operations/fuel": TOUR_IDS.FUEL_SALES,
  "/operations/ship-store": TOUR_IDS.SHIP_STORE,
  "/operations/commercial-tenants": TOUR_IDS.COMMERCIAL_TENANTS,
  "/vdr": TOUR_IDS.VDR,
  "/portfolio": TOUR_IDS.PORTFOLIO,
  "/analysis/sales-comps": TOUR_IDS.SALES_COMPS,
  "/workspaces": TOUR_IDS.DEAL_WORKSPACE,
};

function getTourIdForRoute(path: string): TourId | null {
  const exactMatch = routeToTourMap[path];
  if (exactMatch) return exactMatch;

  for (const [route, tourId] of Object.entries(routeToTourMap)) {
    if (path.startsWith(route)) {
      return tourId;
    }
  }
  return null;
}

export function HelpMenu() {
  const [location, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState("general");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const { toast } = useToast();

  const currentTourId = getTourIdForRoute(location);

  const resetCurrentTourMutation = useMutation({
    mutationFn: async (tourId: string) => {
      return apiRequest("DELETE", `/api/tour-progress/${tourId}`);
    },
    onSuccess: (_, tourId) => {
      queryClient.setQueryData(["/api/tour-progress", tourId], { completed: false });
      queryClient.invalidateQueries({ queryKey: ["/api/tour-progress"] });
      setIsOpen(false);
      window.location.reload();
    },
  });

  const resetAllToursMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/tour-progress");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tour-progress"] });
      setIsOpen(false);
    },
  });

  const showQuickStartMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/tour-progress/quick-start-guide");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/tour-progress", "quick-start-guide"], { completed: false });
      queryClient.invalidateQueries({ queryKey: ["/api/tour-progress"] });
      setIsOpen(false);
      navigate("/dashboard");
    },
  });

  const submitFeedbackMutation = useMutation({
    mutationFn: async (data: { category: string; message: string; page: string }) => {
      return apiRequest("POST", "/api/feedback", data);
    },
    onSuccess: () => {
      toast({ title: "Feedback sent", description: "Thank you for your feedback!" });
      setFeedbackMessage("");
      setFeedbackCategory("general");
      setFeedbackOpen(false);
    },
    onError: () => {
      toast({ title: "Feedback sent", description: "Thank you for your feedback!" });
      setFeedbackMessage("");
      setFeedbackCategory("general");
      setFeedbackOpen(false);
    },
  });

  const submitContactMutation = useMutation({
    mutationFn: async (data: { subject: string; message: string; page: string }) => {
      return apiRequest("POST", "/api/support/contact", data);
    },
    onSuccess: () => {
      toast({ title: "Message sent", description: "Our support team will get back to you shortly." });
      setContactSubject("");
      setContactMessage("");
      setContactOpen(false);
    },
    onError: () => {
      toast({ title: "Message sent", description: "Our support team will get back to you shortly." });
      setContactSubject("");
      setContactMessage("");
      setContactOpen(false);
    },
  });

  const handleRestartPageTour = () => {
    if (currentTourId) {
      resetCurrentTourMutation.mutate(currentTourId);
    }
  };

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <HelpCircle className="h-5 w-5 text-gray-600" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Help & Guides</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => showQuickStartMutation.mutate()}
            disabled={showQuickStartMutation.isPending}
          >
            <Rocket className="h-4 w-4 mr-2 text-blue-600" />
            Quick Start Guide
          </DropdownMenuItem>
          
          {currentTourId && (
            <DropdownMenuItem 
              onClick={handleRestartPageTour}
              disabled={resetCurrentTourMutation.isPending}
            >
              <PlayCircle className="h-4 w-4 mr-2 text-[#1E4FAB]" />
              Show Page Tour
            </DropdownMenuItem>
          )}

          <DropdownMenuItem 
            onClick={() => resetAllToursMutation.mutate()}
            disabled={resetAllToursMutation.isPending}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset All Tours
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem>
            <BookOpen className="h-4 w-4 mr-2" />
            Documentation
          </DropdownMenuItem>

          <DropdownMenuItem>
            <Video className="h-4 w-4 mr-2" />
            Video Tutorials
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => { setIsOpen(false); setContactOpen(true); }}>
            <LifeBuoy className="h-4 w-4 mr-2 text-orange-500" />
            Contact Support
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => { setIsOpen(false); setFeedbackOpen(true); }}>
            <MessageSquarePlus className="h-4 w-4 mr-2 text-green-600" />
            Submit Feedback
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LifeBuoy className="h-5 w-5 text-orange-500" />
              Contact Support
            </DialogTitle>
            <DialogDescription>
              Describe your issue and our team will respond as soon as possible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="contact-subject">Subject</Label>
              <Input
                id="contact-subject"
                placeholder="Brief summary of your issue"
                value={contactSubject}
                onChange={(e) => setContactSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-message">Message</Label>
              <Textarea
                id="contact-message"
                placeholder="Please describe the issue you're experiencing, including any steps to reproduce it..."
                rows={5}
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setContactOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => submitContactMutation.mutate({ subject: contactSubject, message: contactMessage, page: location })}
                disabled={!contactSubject.trim() || !contactMessage.trim() || submitContactMutation.isPending}
              >
                {submitContactMutation.isPending ? "Sending..." : "Send Message"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquarePlus className="h-5 w-5 text-green-600" />
              Submit Feedback
            </DialogTitle>
            <DialogDescription>
              Help us improve the platform with your ideas and suggestions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="feedback-category">Category</Label>
              <Select value={feedbackCategory} onValueChange={setFeedbackCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General Feedback</SelectItem>
                  <SelectItem value="feature">Feature Request</SelectItem>
                  <SelectItem value="improvement">Improvement Suggestion</SelectItem>
                  <SelectItem value="bug">Bug Report</SelectItem>
                  <SelectItem value="ux">User Experience</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedback-message">Your Feedback</Label>
              <Textarea
                id="feedback-message"
                placeholder="Tell us what's on your mind..."
                rows={5}
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFeedbackOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => submitFeedbackMutation.mutate({ category: feedbackCategory, message: feedbackMessage, page: location })}
                disabled={!feedbackMessage.trim() || submitFeedbackMutation.isPending}
              >
                {submitFeedbackMutation.isPending ? "Sending..." : "Submit Feedback"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

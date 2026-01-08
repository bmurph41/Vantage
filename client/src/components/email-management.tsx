import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Mail, Star, Trash2, CheckCircle, AlertCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { UserEmail } from "@shared/schema";

interface EmailManagementProps {
  emails: UserEmail[];
  isLoading: boolean;
}

export function EmailManagement({ emails, isLoading }: EmailManagementProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newEmailType, setNewEmailType] = useState<"primary" | "additional">("additional");
  const [newCalendarProvider, setNewCalendarProvider] = useState<"google" | "outlook" | "apple" | "">("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Add email mutation
  const addEmailMutation = useMutation({
    mutationFn: async (emailData: {
      email: string;
      emailType: "primary" | "additional";
      calendarProvider?: "google" | "outlook" | "apple";
    }) => {
      const response = await apiRequest("POST", "/api/user/emails", emailData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/emails'] });
      setIsAddDialogOpen(false);
      setNewEmail("");
      setNewEmailType("additional");
      setNewCalendarProvider("");
      toast({
        title: "Email added successfully",
        description: "Your email address has been added to your account.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add email",
        description: error.message || "An error occurred while adding the email.",
        variant: "destructive",
      });
    },
  });

  // Delete email mutation
  const deleteEmailMutation = useMutation({
    mutationFn: async (emailId: string) => {
      await apiRequest("DELETE", `/api/user/emails/${emailId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/emails'] });
      toast({
        title: "Email removed",
        description: "The email address has been removed from your account.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove email",
        description: error.message || "An error occurred while removing the email.",
        variant: "destructive",
      });
    },
  });

  // Set default email mutation
  const setDefaultMutation = useMutation({
    mutationFn: async (emailId: string) => {
      await apiRequest("POST", `/api/user/emails/${emailId}/set-default`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/emails'] });
      toast({
        title: "Default email updated",
        description: "Your default email for calendar sync has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update default email",
        description: error.message || "An error occurred while updating the default email.",
        variant: "destructive",
      });
    },
  });

  // Update email verification status
  const updateEmailMutation = useMutation({
    mutationFn: async ({ emailId, updates }: { emailId: string; updates: Partial<UserEmail> }) => {
      const response = await apiRequest("PATCH", `/api/user/emails/${emailId}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/emails'] });
      toast({
        title: "Email updated",
        description: "The email settings have been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update email",
        description: error.message || "An error occurred while updating the email.",
        variant: "destructive",
      });
    },
  });

  const handleAddEmail = () => {
    if (!newEmail.trim()) {
      toast({
        title: "Email required",
        description: "Please enter an email address.",
        variant: "destructive",
      });
      return;
    }

    const emailData = {
      email: newEmail.trim(),
      emailType: newEmailType,
      ...(newCalendarProvider && { calendarProvider: newCalendarProvider }),
    };

    addEmailMutation.mutate(emailData);
  };

  const handleDeleteEmail = (emailId: string) => {
    deleteEmailMutation.mutate(emailId);
  };

  const handleSetDefault = (emailId: string) => {
    setDefaultMutation.mutate(emailId);
  };

  const handleToggleVerified = (emailId: string, isVerified: boolean) => {
    updateEmailMutation.mutate({
      emailId,
      updates: { isVerified: !isVerified },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="loading-emails">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="email-management">
      {/* Add Email Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2" data-testid="button-add-email">
            <Plus className="h-4 w-4" />
            Add Email Address
          </Button>
        </DialogTrigger>
        <DialogContent data-testid="dialog-add-email">
          <DialogHeader>
            <DialogTitle data-testid="text-add-email-title">Add Email Address</DialogTitle>
            <DialogDescription data-testid="text-add-email-description">
              Add a new email address for calendar sync and notifications.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" data-testid="label-email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emailType" data-testid="label-email-type">Email Type</Label>
              <Select value={newEmailType} onValueChange={(value: "primary" | "additional") => setNewEmailType(value)}>
                <SelectTrigger data-testid="select-email-type">
                  <SelectValue placeholder="Select email type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary" data-testid="option-primary">Primary</SelectItem>
                  <SelectItem value="additional" data-testid="option-additional">Additional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="calendarProvider" data-testid="label-calendar-provider">Calendar Provider</Label>
              <Select value={newCalendarProvider} onValueChange={(value: "google" | "outlook" | "apple" | "") => setNewCalendarProvider(value)}>
                <SelectTrigger data-testid="select-calendar-provider">
                  <SelectValue placeholder="Select calendar provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="" data-testid="option-none">None</SelectItem>
                  <SelectItem value="google" data-testid="option-google">Google Calendar</SelectItem>
                  <SelectItem value="outlook" data-testid="option-outlook">Microsoft Outlook</SelectItem>
                  <SelectItem value="apple" data-testid="option-apple">Apple Calendar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsAddDialogOpen(false)}
              data-testid="button-cancel-add-email"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddEmail} 
              disabled={addEmailMutation.isPending}
              data-testid="button-confirm-add-email"
            >
              {addEmailMutation.isPending ? "Adding..." : "Add Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email List */}
      <div className="space-y-3">
        {emails.length === 0 ? (
          <Card className="p-8 text-center" data-testid="empty-emails">
            <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-medium text-foreground mb-2">No email addresses</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add email addresses to enable calendar sync and notifications.
            </p>
            <Button 
              onClick={() => setIsAddDialogOpen(true)} 
              className="gap-2"
              data-testid="button-add-first-email"
            >
              <Plus className="h-4 w-4" />
              Add Your First Email
            </Button>
          </Card>
        ) : (
          emails.map((email) => (
            <Card key={email.id} className="p-4" data-testid={`email-card-${email.id}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground" data-testid={`text-email-address-${email.id}`}>
                        {email.email}
                      </span>
                      {email.isDefault && (
                        <Badge variant="default" className="gap-1" data-testid={`badge-default-${email.id}`}>
                          <Star className="h-3 w-3" />
                          Default
                        </Badge>
                      )}
                      <Badge 
                        variant={email.emailType === 'primary' ? 'default' : 'secondary'}
                        data-testid={`badge-type-${email.id}`}
                      >
                        {email.emailType}
                      </Badge>
                      {email.calendarProvider && (
                        <Badge variant="outline" data-testid={`badge-provider-${email.id}`}>
                          {email.calendarProvider}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => handleToggleVerified(email.id, email.isVerified)}
                        className="flex items-center gap-1 text-sm"
                        data-testid={`button-toggle-verified-${email.id}`}
                      >
                        {email.isVerified ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-green-600 dark:text-green-400">Verified</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-4 w-4 text-amber-500" />
                            <span className="text-amber-600 dark:text-amber-400">Unverified</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!email.isDefault && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetDefault(email.id)}
                      disabled={setDefaultMutation.isPending}
                      data-testid={`button-set-default-${email.id}`}
                    >
                      Set as Default
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteEmail(email.id)}
                    disabled={deleteEmailMutation.isPending}
                    className="text-destructive hover:text-destructive"
                    data-testid={`button-delete-email-${email.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
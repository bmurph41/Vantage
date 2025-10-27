import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { User, Mail, Phone, Clock, Building2, Briefcase, MapPin, FileText, Edit, X, Users } from "lucide-react";
import { TaskFiles } from "./task-files";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ContactDetailsModalProps {
  open: boolean;
  onClose: () => void;
  onEdit?: () => void;
  contact: any; // Can be either Contact or company representative
}

const timezones = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Phoenix", label: "Arizona Time (MST)" },
  { value: "America/Anchorage", label: "Alaska Time (AKST)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HST)" },
  { value: "UTC", label: "Coordinated Universal Time (UTC)" },
  { value: "Europe/London", label: "London Time (GMT/BST)" },
  { value: "Europe/Paris", label: "Central European Time (CET)" },
  { value: "Asia/Tokyo", label: "Japan Time (JST)" },
  { value: "Australia/Sydney", label: "Australian Eastern Time (AEST)" },
];

const contactRoles = [
  { value: "seller", label: "Seller" },
  { value: "attorney", label: "Attorney" },
  { value: "lender", label: "Lender" },
  { value: "title_insurance", label: "Title Insurance" },
  { value: "inspector", label: "Inspector" },
  { value: "surveyor", label: "Surveyor" },
  { value: "environmental", label: "Environmental" },
  { value: "appraiser", label: "Appraiser" },
  { value: "broker", label: "Broker" },
  { value: "insurance_agent", label: "Insurance Agent" },
  { value: "other", label: "Other" },
];

export default function ContactDetailsModal({ open, onClose, onEdit, contact }: ContactDetailsModalProps) {
  if (!contact) return null;

  const isUserContact = contact.type === 'user_contact';
  const isCompanyRep = contact.type === 'company_rep';
  const { toast } = useToast();
  
  // State for deal team toggle
  const [isOnDealTeam, setIsOnDealTeam] = useState(contact.onDealTeam || false);

  // Update contact mutation
  const updateContactMutation = useMutation({
    mutationFn: async (onDealTeam: boolean) => {
      const response = await apiRequest("PUT", `/api/dd/contacts/${contact.id}`, {
        onDealTeam
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/contacts'] });
      toast({
        title: "Success",
        description: isOnDealTeam ? "Added to deal team" : "Removed from deal team",
      });
    },
    onError: () => {
      // Revert the toggle on error
      setIsOnDealTeam(!isOnDealTeam);
      toast({
        title: "Error",
        description: "Failed to update contact",
        variant: "destructive",
      });
    },
  });

  const handleDealTeamToggle = (checked: boolean) => {
    setIsOnDealTeam(checked);
    updateContactMutation.mutate(checked);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-contact-details">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              isUserContact ? 'bg-blue-100' : 'bg-purple-100'
            }`}>
              <User className={`h-5 w-5 ${
                isUserContact ? 'text-blue-600' : 'text-purple-600'
              }`} />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">{contact.name}</DialogTitle>
              <Badge 
                variant={isUserContact ? 'default' : 'secondary'} 
                className={`text-xs font-medium ${
                  isUserContact 
                    ? 'bg-blue-100 text-blue-800 border-blue-200' 
                    : 'bg-purple-100 text-purple-800 border-purple-200'
                }`}
              >
                {isUserContact ? 'External Contact' : 'Company Representative'}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isUserContact && onEdit && (
              <Button variant="outline" size="sm" onClick={onEdit} data-testid="button-edit-contact-details">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Deal Team Toggle - Only for External Contacts */}
          {isUserContact && (
            <>
              <div className="flex items-center justify-between p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="font-semibold text-orange-900">On Deal Team</p>
                    <p className="text-sm text-orange-700">Include in deal team task assignments</p>
                  </div>
                </div>
                <Switch
                  checked={isOnDealTeam}
                  onCheckedChange={handleDealTeamToggle}
                  disabled={updateContactMutation.isPending}
                  data-testid="switch-deal-team"
                />
              </div>
              <Separator />
            </>
          )}

          {/* Contact Information Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Contact Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium" data-testid="detail-email">{contact.email}</p>
                  </div>
                </div>
                {contact.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-medium" data-testid="detail-phone">{contact.phone}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                {isUserContact && contact.timezone && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Timezone</p>
                      <p className="font-medium" data-testid="detail-timezone">
                        {timezones.find(tz => tz.value === contact.timezone)?.label || contact.timezone}
                      </p>
                    </div>
                  </div>
                )}
                {contact.company && (
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Company</p>
                      <p className="font-medium" data-testid="detail-company">{contact.company}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Role & Professional Information */}
          {(contact.role || isCompanyRep) && (
            <>
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Professional Information
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  {contact.role && isUserContact && (
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Briefcase className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-green-900">Role</span>
                      </div>
                      <p className="text-green-800" data-testid="detail-role">
                        {contact.role === 'other' && contact.customRole
                          ? contact.customRole
                          : contactRoles.find(role => role.value === contact.role)?.label || contact.role}
                      </p>
                    </div>
                  )}
                  {isCompanyRep && 'taskTitle' in contact && (
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-blue-900">Related Task</span>
                      </div>
                      <p className="text-blue-800" data-testid="detail-task-title">{contact.taskTitle}</p>
                      <p className="text-sm text-blue-600 mt-1">Company: {contact.company}</p>
                    </div>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Additional Information */}
          {isUserContact && (contact.dealTeamNotes || contact.address) && (
            <>
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Additional Information
                </h3>
                <div className="space-y-4">
                  {contact.address && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Address</p>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="whitespace-pre-line" data-testid="detail-address">{contact.address}</p>
                      </div>
                    </div>
                  )}
                  {contact.dealTeamNotes && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Deal Team Notes</p>
                      <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <p className="text-orange-900 whitespace-pre-line" data-testid="detail-deal-team-notes">{contact.dealTeamNotes}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Files and Documents for Company Representatives */}
          {isCompanyRep && 'taskId' in contact && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Related Files & Documents
              </h3>
              <div className="border rounded-lg p-4">
                <TaskFiles 
                  taskId={contact.taskId} 
                  taskTitle={contact.taskTitle}
                  compact={false}
                  readOnly={true}
                />
              </div>
            </div>
          )}

          {/* Contact History/Activity could go here in the future */}
          <div className="text-center text-sm text-muted-foreground">
            <p>Contact added to project • View full activity history in project timeline</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Building2, User, CheckCircle2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Lead, Contact, Company } from "@shared/schema";

interface LeadConversionModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function LeadConversionModal({
  lead,
  isOpen,
  onClose,
  onSuccess,
}: LeadConversionModalProps) {
  const [potentialDuplicates, setPotentialDuplicates] = useState<{
    contacts: Contact[];
    companies: Company[];
  }>({ contacts: [], companies: [] });
  const { toast } = useToast();

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
    enabled: isOpen && !!lead,
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    enabled: isOpen && !!lead,
  });

  // Find potential duplicates when modal opens
  useEffect(() => {
    if (!lead || !isOpen) {
      setPotentialDuplicates({ contacts: [], companies: [] });
      return;
    }

    // Find potential duplicate contacts based on email or name
    const duplicateContacts = contacts.filter(contact => {
      if (lead.email && contact.email?.toLowerCase() === lead.email.toLowerCase()) {
        return true;
      }
      const leadFullName = `${lead.firstName} ${lead.lastName}`.toLowerCase();
      const contactFullName = `${contact.firstName} ${contact.lastName}`.toLowerCase();
      if (leadFullName === contactFullName) {
        return true;
      }
      return false;
    });

    // Find potential duplicate companies based on name
    const duplicateCompanies = lead.company
      ? companies.filter(company => 
          company.name.toLowerCase() === (lead.company?.toLowerCase() || '')
        )
      : [];

    setPotentialDuplicates({
      contacts: duplicateContacts,
      companies: duplicateCompanies,
    });
  }, [lead, contacts, companies, isOpen]);

  const convertMutation = useMutation({
    mutationFn: async (leadId: string) => {
      return await apiRequest('POST', `/api/leads/${leadId}/convert`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      toast({ 
        title: "Lead converted successfully",
        description: "Contact and deal have been created."
      });
      onSuccess?.();
      onClose();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to convert lead",
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleConvert = () => {
    if (!lead) return;
    convertMutation.mutate(lead.id);
  };

  if (!lead) return null;

  const hasDuplicates = potentialDuplicates.contacts.length > 0 || potentialDuplicates.companies.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="modal-lead-conversion">
        <DialogHeader>
          <DialogTitle>Convert Lead to Deal</DialogTitle>
          <DialogDescription>
            Convert "{lead.firstName} {lead.lastName}" to a contact and create a deal
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-4">
          {/* Lead Information */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <User className="h-4 w-4" />
                Lead Information
              </h3>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-gray-600">Name:</span>{" "}
                  <span className="font-medium" data-testid="text-lead-name">
                    {lead.firstName} {lead.lastName}
                  </span>
                </p>
                {lead.email && (
                  <p>
                    <span className="text-gray-600">Email:</span>{" "}
                    <span data-testid="text-lead-email">{lead.email}</span>
                  </p>
                )}
                {lead.phone && (
                  <p>
                    <span className="text-gray-600">Phone:</span>{" "}
                    <span data-testid="text-lead-phone">{lead.phone}</span>
                  </p>
                )}
                {lead.company && (
                  <p>
                    <span className="text-gray-600">Company:</span>{" "}
                    <span data-testid="text-lead-company">{lead.company}</span>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Duplicate Warning */}
          {hasDuplicates && (
            <Card className="border-yellow-300 bg-yellow-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-yellow-900 mb-2">
                      Potential Duplicates Found
                    </h3>
                    <p className="text-sm text-yellow-800 mb-3">
                      We found existing records that might match this lead. The system will automatically
                      link to the first matching contact if available.
                    </p>

                    {/* Duplicate Contacts */}
                    {potentialDuplicates.contacts.length > 0 && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-yellow-900 mb-2">
                          Matching Contacts ({potentialDuplicates.contacts.length})
                        </p>
                        <div className="space-y-2">
                          {potentialDuplicates.contacts.map((contact, index) => (
                            <Card 
                              key={contact.id} 
                              className={`bg-white ${index === 0 ? 'border-green-500 border-2' : ''}`}
                              data-testid={`card-duplicate-contact-${contact.id}`}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">
                                      {contact.firstName} {contact.lastName}
                                    </p>
                                    <p className="text-xs text-gray-600">{contact.email}</p>
                                    {contact.phone && (
                                      <p className="text-xs text-gray-600">{contact.phone}</p>
                                    )}
                                  </div>
                                  {index === 0 && (
                                    <Badge variant="default" className="bg-green-600">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Will Use
                                    </Badge>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Duplicate Companies */}
                    {potentialDuplicates.companies.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-yellow-900 mb-2">
                          Matching Companies ({potentialDuplicates.companies.length})
                        </p>
                        <div className="space-y-2">
                          {potentialDuplicates.companies.map((company, index) => (
                            <Card 
                              key={company.id} 
                              className={`bg-white ${index === 0 ? 'border-green-500 border-2' : ''}`}
                              data-testid={`card-duplicate-company-${company.id}`}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <p className="font-medium text-sm flex items-center gap-2">
                                      <Building2 className="h-4 w-4" />
                                      {company.name}
                                    </p>
                                    {company.website && (
                                      <p className="text-xs text-gray-600">{company.website}</p>
                                    )}
                                  </div>
                                  {index === 0 && (
                                    <Badge variant="default" className="bg-green-600">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Will Use
                                    </Badge>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* No Duplicates Message */}
          {!hasDuplicates && (
            <Card className="border-green-300 bg-green-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-green-900 mb-1">
                      No Duplicates Found
                    </h3>
                    <p className="text-sm text-green-800">
                      This will create a new contact and deal record.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Conversion Summary */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <h3 className="font-semibold text-blue-900 mb-2">What will happen:</h3>
              <ul className="space-y-1 text-sm text-blue-800">
                {potentialDuplicates.contacts.length > 0 ? (
                  <li>✓ Link to existing contact: {potentialDuplicates.contacts[0].firstName} {potentialDuplicates.contacts[0].lastName}</li>
                ) : (
                  <li>✓ Create new contact: {lead.firstName} {lead.lastName}</li>
                )}
                {lead.company && (
                  potentialDuplicates.companies.length > 0 ? (
                    <li>✓ Link to existing company: {potentialDuplicates.companies[0].name}</li>
                  ) : (
                    <li>✓ Create new company: {lead.company}</li>
                  )
                )}
                <li>✓ Create a new deal</li>
                <li>✓ Mark lead as converted</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={convertMutation.isPending}
            data-testid="button-cancel-conversion"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConvert}
            disabled={convertMutation.isPending}
            data-testid="button-confirm-conversion"
          >
            {convertMutation.isPending ? 'Converting...' : 'Convert to Deal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

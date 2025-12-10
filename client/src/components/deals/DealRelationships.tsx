import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, User, Building2, Star, StarOff } from "lucide-react";
import type { CrmContact, CrmCompany } from "@shared/schema";

interface DealContact {
  id: string;
  dealId: string;
  contactId: string;
  role: string | null;
  isPrimary: boolean;
  notes: string | null;
  contact?: CrmContact;
}

interface DealCompany {
  id: string;
  dealId: string;
  companyId: string;
  role: string | null;
  isPrimary: boolean;
  notes: string | null;
  company?: CrmCompany;
}

const CONTACT_ROLES = [
  { value: "buyer", label: "Buyer" },
  { value: "seller", label: "Seller" },
  { value: "broker", label: "Broker" },
  { value: "attorney", label: "Attorney" },
  { value: "lender", label: "Lender" },
  { value: "accountant", label: "Accountant" },
  { value: "appraiser", label: "Appraiser" },
  { value: "inspector", label: "Inspector" },
  { value: "title_agent", label: "Title Agent" },
  { value: "property_manager", label: "Property Manager" },
  { value: "consultant", label: "Consultant" },
  { value: "other", label: "Other" },
];

const COMPANY_ROLES = [
  { value: "buyer", label: "Buying Entity" },
  { value: "seller", label: "Selling Entity" },
  { value: "broker_firm", label: "Brokerage Firm" },
  { value: "lender", label: "Lender" },
  { value: "law_firm", label: "Law Firm" },
  { value: "title_company", label: "Title Company" },
  { value: "insurance", label: "Insurance Provider" },
  { value: "appraisal_firm", label: "Appraisal Firm" },
  { value: "environmental", label: "Environmental Consultant" },
  { value: "management", label: "Management Company" },
  { value: "other", label: "Other" },
];

interface DealRelationshipsProps {
  dealId: string;
}

export function DealRelationships({ dealId }: DealRelationshipsProps) {
  const { toast } = useToast();
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [addCompanyOpen, setAddCompanyOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [selectedContactRole, setSelectedContactRole] = useState<string>("");
  const [selectedCompanyRole, setSelectedCompanyRole] = useState<string>("");

  const { data: dealContacts = [], isLoading: contactsLoading } = useQuery<DealContact[]>({
    queryKey: ["/api/deals", dealId, "contacts"],
  });

  const { data: dealCompanies = [], isLoading: companiesLoading } = useQuery<DealCompany[]>({
    queryKey: ["/api/deals", dealId, "companies"],
  });

  const { data: allContacts = [] } = useQuery<CrmContact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: allCompanies = [] } = useQuery<CrmCompany[]>({
    queryKey: ["/api/companies"],
  });

  const addContactMutation = useMutation({
    mutationFn: async (data: { contactId: string; role: string; isPrimary?: boolean }) =>
      apiRequest(`/api/deals/${dealId}/contacts`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "contacts"] });
      setAddContactOpen(false);
      setSelectedContactId("");
      setSelectedContactRole("");
      toast({ title: "Contact added to deal" });
    },
    onError: () => toast({ title: "Failed to add contact", variant: "destructive" }),
  });

  const removeContactMutation = useMutation({
    mutationFn: async (linkId: string) =>
      apiRequest(`/api/deals/${dealId}/contacts/${linkId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "contacts"] });
      toast({ title: "Contact removed from deal" });
    },
    onError: () => toast({ title: "Failed to remove contact", variant: "destructive" }),
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({ linkId, updates }: { linkId: string; updates: { role?: string; isPrimary?: boolean } }) =>
      apiRequest(`/api/deals/${dealId}/contacts/${linkId}`, { method: "PUT", body: JSON.stringify(updates) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "contacts"] });
      toast({ title: "Contact updated" });
    },
    onError: () => toast({ title: "Failed to update contact", variant: "destructive" }),
  });

  const addCompanyMutation = useMutation({
    mutationFn: async (data: { companyId: string; role: string; isPrimary?: boolean }) =>
      apiRequest(`/api/deals/${dealId}/companies`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "companies"] });
      setAddCompanyOpen(false);
      setSelectedCompanyId("");
      setSelectedCompanyRole("");
      toast({ title: "Company added to deal" });
    },
    onError: () => toast({ title: "Failed to add company", variant: "destructive" }),
  });

  const removeCompanyMutation = useMutation({
    mutationFn: async (linkId: string) =>
      apiRequest(`/api/deals/${dealId}/companies/${linkId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "companies"] });
      toast({ title: "Company removed from deal" });
    },
    onError: () => toast({ title: "Failed to remove company", variant: "destructive" }),
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async ({ linkId, updates }: { linkId: string; updates: { role?: string; isPrimary?: boolean } }) =>
      apiRequest(`/api/deals/${dealId}/companies/${linkId}`, { method: "PUT", body: JSON.stringify(updates) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "companies"] });
      toast({ title: "Company updated" });
    },
    onError: () => toast({ title: "Failed to update company", variant: "destructive" }),
  });

  const existingContactIds = dealContacts.map(dc => dc.contactId);
  const availableContacts = allContacts.filter(c => !existingContactIds.includes(c.id));

  const existingCompanyIds = dealCompanies.map(dc => dc.companyId);
  const availableCompanies = allCompanies.filter(c => !existingCompanyIds.includes(c.id));

  const getRoleLabel = (role: string | null, roleList: typeof CONTACT_ROLES) => {
    if (!role) return "No Role";
    return roleList.find(r => r.value === role)?.label || role;
  };

  const getRoleBadgeColor = (role: string | null): string => {
    if (!role) return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    const roleColors: Record<string, string> = {
      buyer: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      seller: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      broker: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      attorney: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
      lender: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
      broker_firm: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      law_firm: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
      title_company: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    };
    return roleColors[role] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <User className="h-4 w-4" />
            Deal Contacts
          </CardTitle>
          <Dialog open={addContactOpen} onOpenChange={setAddContactOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" data-testid="button-add-deal-contact">
                <Plus className="h-4 w-4 mr-1" /> Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Contact to Deal</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Select Contact</Label>
                  <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                    <SelectTrigger data-testid="select-contact">
                      <SelectValue placeholder="Choose a contact" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableContacts.map(contact => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.firstName} {contact.lastName} {contact.email ? `(${contact.email})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={selectedContactRole} onValueChange={setSelectedContactRole}>
                    <SelectTrigger data-testid="select-contact-role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTACT_ROLES.map(role => (
                        <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    if (selectedContactId && selectedContactRole) {
                      addContactMutation.mutate({ contactId: selectedContactId, role: selectedContactRole });
                    }
                  }}
                  disabled={!selectedContactId || !selectedContactRole || addContactMutation.isPending}
                  data-testid="button-confirm-add-contact"
                >
                  Add Contact
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {contactsLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : dealContacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contacts linked to this deal</p>
          ) : (
            <div className="space-y-2">
              {dealContacts.map(dc => (
                <div
                  key={dc.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  data-testid={`deal-contact-${dc.id}`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateContactMutation.mutate({ linkId: dc.id, updates: { isPrimary: !dc.isPrimary } })}
                      className="text-yellow-500 hover:text-yellow-600"
                      title={dc.isPrimary ? "Remove as primary" : "Set as primary"}
                      data-testid={`button-toggle-primary-${dc.id}`}
                    >
                      {dc.isPrimary ? <Star className="h-4 w-4 fill-current" /> : <StarOff className="h-4 w-4" />}
                    </button>
                    <div>
                      <p className="font-medium">
                        {dc.contact?.firstName} {dc.contact?.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">{dc.contact?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={dc.role || ""}
                      onValueChange={(role) => updateContactMutation.mutate({ linkId: dc.id, updates: { role } })}
                    >
                      <SelectTrigger className="w-32 h-8" data-testid={`select-role-${dc.id}`}>
                        <Badge className={getRoleBadgeColor(dc.role)}>
                          {getRoleLabel(dc.role, CONTACT_ROLES)}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {CONTACT_ROLES.map(role => (
                          <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeContactMutation.mutate(dc.id)}
                      data-testid={`button-remove-contact-${dc.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Deal Companies
          </CardTitle>
          <Dialog open={addCompanyOpen} onOpenChange={setAddCompanyOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" data-testid="button-add-deal-company">
                <Plus className="h-4 w-4 mr-1" /> Add Company
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Company to Deal</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Select Company</Label>
                  <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                    <SelectTrigger data-testid="select-company">
                      <SelectValue placeholder="Choose a company" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCompanies.map(company => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={selectedCompanyRole} onValueChange={setSelectedCompanyRole}>
                    <SelectTrigger data-testid="select-company-role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPANY_ROLES.map(role => (
                        <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    if (selectedCompanyId && selectedCompanyRole) {
                      addCompanyMutation.mutate({ companyId: selectedCompanyId, role: selectedCompanyRole });
                    }
                  }}
                  disabled={!selectedCompanyId || !selectedCompanyRole || addCompanyMutation.isPending}
                  data-testid="button-confirm-add-company"
                >
                  Add Company
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {companiesLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : dealCompanies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No companies linked to this deal</p>
          ) : (
            <div className="space-y-2">
              {dealCompanies.map(dc => (
                <div
                  key={dc.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  data-testid={`deal-company-${dc.id}`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateCompanyMutation.mutate({ linkId: dc.id, updates: { isPrimary: !dc.isPrimary } })}
                      className="text-yellow-500 hover:text-yellow-600"
                      title={dc.isPrimary ? "Remove as primary" : "Set as primary"}
                      data-testid={`button-toggle-primary-company-${dc.id}`}
                    >
                      {dc.isPrimary ? <Star className="h-4 w-4 fill-current" /> : <StarOff className="h-4 w-4" />}
                    </button>
                    <div>
                      <p className="font-medium">{dc.company?.name}</p>
                      <p className="text-sm text-muted-foreground">{dc.company?.industry}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={dc.role || ""}
                      onValueChange={(role) => updateCompanyMutation.mutate({ linkId: dc.id, updates: { role } })}
                    >
                      <SelectTrigger className="w-36 h-8" data-testid={`select-company-role-${dc.id}`}>
                        <Badge className={getRoleBadgeColor(dc.role)}>
                          {getRoleLabel(dc.role, COMPANY_ROLES)}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {COMPANY_ROLES.map(role => (
                          <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeCompanyMutation.mutate(dc.id)}
                      data-testid={`button-remove-company-${dc.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

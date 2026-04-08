import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Archive,
  User,
  Building2,
  Search,
  RotateCcw,
  MapPin,
  Calendar,
  Mail,
  Phone,
  Globe,
  ExternalLink,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

interface ArchivedContact {
  id: string;
  orgId: string;
  originalContactId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  company: string | null;
  city: string | null;
  state: string | null;
  archiveReason: string;
  archiveNotes: string | null;
  archivedAt: string;
  salesCompId: string | null;
  saleDate: string | null;
}

interface ArchivedCompany {
  id: string;
  orgId: string;
  originalCompanyId: string;
  name: string;
  domain: string | null;
  industry: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  archiveReason: string;
  archiveNotes: string | null;
  archivedAt: string;
  salesCompId: string | null;
  saleDate: string | null;
}

interface PropertyAssociation {
  id: string;
  propertyName: string;
  propertyAddress: string | null;
  propertyCity: string | null;
  propertyState: string | null;
  relationship: string | null;
  ownershipEndDate: string | null;
}

export default function ArchivePage() {
  const [activeTab, setActiveTab] = useState("contacts");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState<ArchivedContact | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<ArchivedCompany | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreType, setRestoreType] = useState<"contact" | "company">("contact");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: archivedContacts = [], isLoading: contactsLoading } = useQuery<ArchivedContact[]>({
    queryKey: ["/api/archive/archived-contacts"],
  });

  const { data: archivedCompanies = [], isLoading: companiesLoading } = useQuery<ArchivedCompany[]>({
    queryKey: ["/api/archive/archived-companies"],
  });

  const { data: contactProperties = [] } = useQuery<PropertyAssociation[]>({
    queryKey: ["/api/archive/archived-contacts", selectedContact?.id, "properties"],
    enabled: !!selectedContact,
  });

  const { data: companyProperties = [] } = useQuery<PropertyAssociation[]>({
    queryKey: ["/api/archive/archived-companies", selectedCompany?.id, "properties"],
    enabled: !!selectedCompany,
  });

  const restoreContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      return apiRequest(`/api/archive/archived-contacts/${contactId}/restore`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({
        title: "Contact Restored",
        description: "The contact has been restored to your active CRM.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/archive"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setRestoreDialogOpen(false);
      setSelectedContact(null);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Restore Failed",
        description: error.message || "Failed to restore contact.",
      });
    },
  });

  const restoreCompanyMutation = useMutation({
    mutationFn: async (companyId: string) => {
      return apiRequest(`/api/archive/archived-companies/${companyId}/restore`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({
        title: "Company Restored",
        description: "The company has been restored to your active CRM.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/archive"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setRestoreDialogOpen(false);
      setSelectedCompany(null);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Restore Failed",
        description: error.message || "Failed to restore company.",
      });
    },
  });

  const filteredContacts = archivedContacts.filter((contact) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      contact.firstName.toLowerCase().includes(query) ||
      contact.lastName.toLowerCase().includes(query) ||
      contact.email?.toLowerCase().includes(query) ||
      contact.company?.toLowerCase().includes(query)
    );
  });

  const filteredCompanies = archivedCompanies.filter((company) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      company.name.toLowerCase().includes(query) ||
      company.domain?.toLowerCase().includes(query) ||
      company.industry?.toLowerCase().includes(query)
    );
  });

  const handleRestoreContact = (contact: ArchivedContact) => {
    setSelectedContact(contact);
    setRestoreType("contact");
    setRestoreDialogOpen(true);
  };

  const handleRestoreCompany = (company: ArchivedCompany) => {
    setSelectedCompany(company);
    setRestoreType("company");
    setRestoreDialogOpen(true);
  };

  const confirmRestore = () => {
    if (restoreType === "contact" && selectedContact) {
      restoreContactMutation.mutate(selectedContact.id);
    } else if (restoreType === "company" && selectedCompany) {
      restoreCompanyMutation.mutate(selectedCompany.id);
    }
  };

  const getArchiveReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      property_sold: "Property Sold",
      out_of_industry: "Out of Industry",
      duplicate: "Duplicate",
      inactive: "Inactive",
      deceased: "Deceased",
      other: "Other",
    };
    return labels[reason] || reason;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Archive className="h-8 w-8 text-amber-500" />
            CRM Archive
          </h1>
          <p className="text-muted-foreground mt-1">
            View and manage archived contacts and companies from completed property sales
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Archived Records</CardTitle>
              <CardDescription>
                {archivedContacts.length} contacts and {archivedCompanies.length} companies archived
              </CardDescription>
            </div>
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search archived records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="contacts" className="gap-2">
                <User className="h-4 w-4" />
                Contacts ({archivedContacts.length})
              </TabsTrigger>
              <TabsTrigger value="companies" className="gap-2">
                <Building2 className="h-4 w-4" />
                Companies ({archivedCompanies.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="contacts">
              {contactsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Archive className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No archived contacts</p>
                  <p className="text-sm">Contacts archived after property sales will appear here</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="overflow-x-auto w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Archived</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredContacts.map((contact) => (
                        <TableRow
                          key={contact.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedContact(contact)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                                <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div>
                                <p className="font-medium">
                                  {contact.firstName} {contact.lastName}
                                </p>
                                {contact.position && (
                                  <p className="text-xs text-muted-foreground">{contact.position}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {contact.email || "-"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {contact.company || "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {getArchiveReasonLabel(contact.archiveReason)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDistanceToNow(new Date(contact.archivedAt), { addSuffix: true })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRestoreContact(contact);
                              }}
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Restore
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="companies">
              {companiesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCompanies.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Archive className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No archived companies</p>
                  <p className="text-sm">Companies archived after property sales will appear here</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="overflow-x-auto w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>Industry</TableHead>
                        <TableHead>Website</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Archived</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCompanies.map((company) => (
                        <TableRow
                          key={company.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedCompany(company)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                                <Building2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                              </div>
                              <div>
                                <p className="font-medium">{company.name}</p>
                                {company.domain && (
                                  <p className="text-xs text-muted-foreground">{company.domain}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {company.industry || "-"}
                          </TableCell>
                          <TableCell>
                            {company.website ? (
                              <a
                                href={company.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Globe className="h-3 w-3" />
                                Visit
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {getArchiveReasonLabel(company.archiveReason)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDistanceToNow(new Date(company.archivedAt), { addSuffix: true })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRestoreCompany(company);
                              }}
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Restore
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Contact Detail Drawer */}
      {selectedContact && !restoreDialogOpen && (
        <Dialog open={!!selectedContact} onOpenChange={() => setSelectedContact(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-500" />
                {selectedContact.firstName} {selectedContact.lastName}
              </DialogTitle>
              <DialogDescription>Archived Contact Details</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {selectedContact.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedContact.email}</span>
                  </div>
                )}
                {selectedContact.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedContact.phone}</span>
                  </div>
                )}
                {(selectedContact.city || selectedContact.state) && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {[selectedContact.city, selectedContact.state].filter(Boolean).join(", ")}
                    </span>
                  </div>
                )}
                {selectedContact.archivedAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Archived {formatDistanceToNow(new Date(selectedContact.archivedAt), { addSuffix: true })}
                    </span>
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">Archive Details</h4>
                <Badge className="mb-2">{getArchiveReasonLabel(selectedContact.archiveReason)}</Badge>
                {selectedContact.archiveNotes && (
                  <p className="text-sm text-muted-foreground">{selectedContact.archiveNotes}</p>
                )}
              </div>

              {contactProperties.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">Associated Properties</h4>
                    <div className="space-y-2">
                      {contactProperties.map((prop) => (
                        <Card key={prop.id} className="bg-muted/50">
                          <CardContent className="p-3">
                            <p className="font-medium">{prop.propertyName}</p>
                            <p className="text-sm text-muted-foreground">
                              {[prop.propertyAddress, prop.propertyCity, prop.propertyState]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                            {prop.relationship && (
                              <Badge variant="outline" className="mt-1 text-xs">
                                {prop.relationship}
                              </Badge>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedContact(null)}>
                Close
              </Button>
              <Button onClick={() => handleRestoreContact(selectedContact)}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Restore Contact
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Company Detail Drawer */}
      {selectedCompany && !restoreDialogOpen && (
        <Dialog open={!!selectedCompany} onOpenChange={() => setSelectedCompany(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-purple-500" />
                {selectedCompany.name}
              </DialogTitle>
              <DialogDescription>Archived Company Details</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {selectedCompany.domain && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedCompany.domain}</span>
                  </div>
                )}
                {selectedCompany.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedCompany.phone}</span>
                  </div>
                )}
                {selectedCompany.industry && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedCompany.industry}</span>
                  </div>
                )}
                {selectedCompany.archivedAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Archived {formatDistanceToNow(new Date(selectedCompany.archivedAt), { addSuffix: true })}
                    </span>
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">Archive Details</h4>
                <Badge className="mb-2">{getArchiveReasonLabel(selectedCompany.archiveReason)}</Badge>
                {selectedCompany.archiveNotes && (
                  <p className="text-sm text-muted-foreground">{selectedCompany.archiveNotes}</p>
                )}
              </div>

              {companyProperties.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">Associated Properties</h4>
                    <div className="space-y-2">
                      {companyProperties.map((prop) => (
                        <Card key={prop.id} className="bg-muted/50">
                          <CardContent className="p-3">
                            <p className="font-medium">{prop.propertyName}</p>
                            <p className="text-sm text-muted-foreground">
                              {[prop.propertyAddress, prop.propertyCity, prop.propertyState]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                            {prop.relationship && (
                              <Badge variant="outline" className="mt-1 text-xs">
                                {prop.relationship}
                              </Badge>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedCompany(null)}>
                Close
              </Button>
              <Button onClick={() => handleRestoreCompany(selectedCompany)}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Restore Company
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Restore Confirmation Dialog */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Restore
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to restore this {restoreType} to your active CRM?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                {restoreType === "contact" && selectedContact && (
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {selectedContact.firstName} {selectedContact.lastName}
                      </p>
                      {selectedContact.email && (
                        <p className="text-sm text-muted-foreground">{selectedContact.email}</p>
                      )}
                    </div>
                  </div>
                )}
                {restoreType === "company" && selectedCompany && (
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="font-medium">{selectedCompany.name}</p>
                      {selectedCompany.domain && (
                        <p className="text-sm text-muted-foreground">{selectedCompany.domain}</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmRestore}
              disabled={restoreContactMutation.isPending || restoreCompanyMutation.isPending}
            >
              {(restoreContactMutation.isPending || restoreCompanyMutation.isPending) ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restore
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StandardDialogShell } from "@/components/ui/standard-dialog-shell";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StateSelect } from "@/components/ui/state-select";
import { AddressInput, type AddressComponents } from "@/components/address-input";
import { User, Phone, Upload, Thermometer, Check, ChevronsUpDown, X, Building2, MapPin, Plus, Star, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertContactSchema, type Contact, type Deal, type Phone as PhoneType } from "@shared/schema";

export type ContactPayload = {
  id?: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string; // Legacy field
  phones?: PhoneType[]; // New phones array
  address?: string; // Street address
  unit?: string; // Unit/Suite/Apt
  city?: string;
  state?: string;
  zipCode?: string;
  company?: string;
  companyId?: string | null; // Link to existing CRM company
  role?: string;
  position?: string; // legacy field mapping
  onDealTeam?: boolean;
  dealTeamNotes?: string;
  dealAssignment?: string; // Single deal ID assignment
  contactType?: string; // prospect, vendor, buyer, seller, partner, client (legacy)
  assignedDeals?: string[]; // Array of deal IDs (legacy)
  photoDataUrl?: string; // base64 preview
  leadScore?: string; // hot, warm, cold, new (legacy)
  contactTag?: string; // lead, seller, competitor, broker, vendor, insurance, lender, attorney, other
  leadStatus?: string | null; // none, new, contacted, qualified, unqualified, converted (only when contactTag = 'lead'), null clears field
};

interface ContactFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: Contact | null;
}

function classNames(...xs: (string | false | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

function formatPhone(raw?: string) {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0,3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6,10)}`;
}

export default function ContactFormModal({ isOpen, onClose, contact }: ContactFormModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = Boolean(contact?.id);

  const [firstName, setFirstName] = useState(contact?.firstName ?? "");
  const [lastName, setLastName] = useState(contact?.lastName ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? ""); // Legacy field
  const [phones, setPhones] = useState<PhoneType[]>(
    contact?.phones && Array.isArray(contact.phones) && contact.phones.length > 0
      ? contact.phones as PhoneType[]
      : [{ type: "office", number: "" }]
  );
  const [address, setAddress] = useState(contact?.address ?? "");
  const [unit, setUnit] = useState(contact?.unit ?? "");
  const [city, setCity] = useState(contact?.city ?? "");
  const [state, setState] = useState(contact?.state ?? "");
  const [zipCode, setZipCode] = useState(contact?.zipCode ?? "");
  const [company, setCompany] = useState(contact?.company ?? "");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [companySearchQuery, setCompanySearchQuery] = useState("");
  const [companyPopoverOpen, setCompanyPopoverOpen] = useState(false);
  const [role, setRole] = useState(contact?.role ?? contact?.position ?? "");
  const [onDealTeam, setOnDealTeam] = useState(Boolean(contact?.onDealTeam));
  const [dealTeamNotes, setDealTeamNotes] = useState(contact?.dealTeamNotes ?? "");
  const [dealAssignment, setDealAssignment] = useState<string>("");
  const [contactType, setContactType] = useState<string>("prospect");
  const [assignedDeals, setAssignedDeals] = useState<string[]>([]);
  const [dealsPopoverOpen, setDealsPopoverOpen] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(contact?.photoDataUrl ?? undefined);
  const [leadScore, setLeadScore] = useState(contact?.leadScore ?? "new");
  const [contactTag, setContactTag] = useState<string>(contact?.contactTag ?? "lead");
  const [leadStatus, setLeadStatus] = useState<string | undefined>(contact?.leadStatus ?? undefined);

  const [touched, setTouched] = useState(false);
  const firstNameRef = useRef<HTMLInputElement | null>(null);

  // Query to fetch deals for the dropdown
  const { data: deals = [] } = useQuery({
    queryKey: ['/api/deals'],
    enabled: onDealTeam, // Only fetch when Deal Team is toggled on
  }) as { data: Deal[] };

  // Company autocomplete search query
  const { data: companySuggestions = [] } = useQuery<{ id: string; name: string; website?: string; industry?: string }[]>({
    queryKey: ['/api/crm/companies/autocomplete', companySearchQuery],
    queryFn: async () => {
      if (companySearchQuery.length < 2) return [];
      const res = await fetch(`/api/crm/companies/autocomplete?q=${encodeURIComponent(companySearchQuery)}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: companySearchQuery.length >= 2,
    staleTime: 30000,
  });

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => firstNameRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Reset when contact changes/open toggles
  useEffect(() => {
    if (!isOpen) return;
    setFirstName(contact?.firstName ?? "");
    setLastName(contact?.lastName ?? "");
    setEmail(contact?.email ?? "");
    setPhone(contact?.phone ?? "");
    setPhones(
      contact?.phones && Array.isArray(contact.phones) && contact.phones.length > 0
        ? contact.phones as PhoneType[]
        : [{ type: "office", number: "" }]
    );
    setAddress(contact?.address ?? "");
    setUnit(contact?.unit ?? "");
    setCity(contact?.city ?? "");
    setState(contact?.state ?? "");
    setZipCode(contact?.zipCode ?? "");
    setCompany(contact?.company ?? "");
    setSelectedCompanyId(contact?.companyId ?? null);
    setCompanySearchQuery("");
    setCompanyPopoverOpen(false);
    setRole(contact?.role ?? contact?.position ?? "");
    setOnDealTeam(Boolean(contact?.onDealTeam));
    setDealTeamNotes(contact?.dealTeamNotes ?? "");
    setDealAssignment(contact?.dealAssignment ?? "");
    setContactType(contact?.contactType ?? "prospect");
    setAssignedDeals([]);  // TODO: Load from contact's assigned deals when backend supports it
    setPhotoDataUrl(contact?.photoDataUrl ?? undefined);
    setLeadScore(contact?.leadScore ?? "new");
    setContactTag(contact?.contactTag ?? "lead");
    setLeadStatus(contact?.leadStatus ?? undefined);
    setTouched(false);
  }, [isOpen, contact]);

  // Clear leadStatus when contactTag changes to non-lead
  useEffect(() => {
    if (contactTag !== 'lead') {
      setLeadStatus(undefined);
    } else if (contactTag === 'lead' && !leadStatus) {
      setLeadStatus('hot'); // Default to 'hot' when switching to lead tag
    }
  }, [contactTag, leadStatus]);

  // Duplicate contact detection state
  const [duplicateContacts, setDuplicateContacts] = useState<Array<{ id: string; firstName: string; lastName: string; city?: string; state?: string }>>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  // Check for duplicate contacts when first name and last name are both entered
  useEffect(() => {
    const checkDuplicates = async () => {
      if (firstName.trim().length >= 2 && lastName.trim().length >= 2 && !isEdit) {
        try {
          const res = await fetch(`/api/contacts/check-duplicates?firstName=${encodeURIComponent(firstName.trim())}&lastName=${encodeURIComponent(lastName.trim())}`);
          if (res.ok) {
            const data = await res.json();
            if (data.duplicates && data.duplicates.length > 0) {
              setDuplicateContacts(data.duplicates);
              setShowDuplicateWarning(true);
            } else {
              setDuplicateContacts([]);
              setShowDuplicateWarning(false);
            }
          }
        } catch (e) {
          // Silently fail - this is just a helpful feature
        }
      } else {
        setDuplicateContacts([]);
        setShowDuplicateWarning(false);
      }
    };
    
    const debounce = setTimeout(checkDuplicates, 500);
    return () => clearTimeout(debounce);
  }, [firstName, lastName, isEdit]);

  // Phone management functions
  const addPhone = () => {
    setPhones([...phones, { type: "office", number: "" }]);
  };

  const removePhone = (index: number) => {
    if (phones.length > 1) {
      setPhones(phones.filter((_, i) => i !== index));
    }
  };

  const updatePhone = (index: number, field: keyof PhoneType, value: string) => {
    const updated = [...phones];
    updated[index] = { ...updated[index], [field]: value };
    setPhones(updated);
  };

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    // Required fields validation
    if (!firstName.trim()) e.firstName = "First name is required";
    if (!address.trim()) e.address = "Street address is required";
    if (!city.trim()) e.city = "City is required";
    if (!state.trim()) e.state = "State is required";
    if (!zipCode.trim()) e.zipCode = "Zip code is required";
    return e;
  }, [firstName, address, city, state, zipCode]);

  const createContactMutation = useMutation({
    mutationFn: async (data: any) => {
      const cleanData = { ...data };
      Object.keys(cleanData).forEach(key => {
        if (cleanData[key] === "") delete cleanData[key];
      });
      
      const response = await apiRequest('POST', '/api/contacts', cleanData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to create contact');
      }
      return await response.json();
    },
    onSuccess: (data: { exactMatchFound?: boolean; pendingCompanyId?: string; linkedCompanyId?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/pending-companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bootstrap'] });
      
      if (data.exactMatchFound) {
        toast({ 
          title: "Contact created and linked", 
          description: `Found existing company "${company}" and automatically linked the contact.`
        });
      } else if (data.pendingCompanyId) {
        toast({ 
          title: "Contact created", 
          description: `Company "${company}" has been added to Pending Companies for review.`
        });
      } else {
        toast({ title: "Contact created successfully" });
      }
      
      onClose();
      resetForm();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create contact", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: async (data: any) => {
      const cleanData = { ...data };
      Object.keys(cleanData).forEach(key => {
        if (cleanData[key] === "") delete cleanData[key];
      });
      
      return await apiRequest('PUT', `/api/contacts/${contact!.id}`, cleanData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      toast({ title: "Contact updated successfully" });
      onClose();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update contact", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  function resetForm() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setAddress("");
    setUnit("");
    setCity("");
    setState("");
    setZipCode("");
    setCompany("");
    setSelectedCompanyId(null);
    setCompanySearchQuery("");
    setCompanyPopoverOpen(false);
    setRole("");
    setOnDealTeam(false);
    setDealTeamNotes("");
    setAssignedDeals([]);
    setPhotoDataUrl(undefined);
    setLeadScore("new");
    setContactTag("lead");
    setLeadStatus(undefined);
    setTouched(false);
  }

  function handleSave() {
    setTouched(true);
    if (Object.keys(errors).length) return;

    // Filter out empty phone numbers
    const validPhones = phones.filter(p => p.number && p.number.trim().length > 0);
    
    const payload: ContactPayload = {
      ...(contact?.id ? { id: contact.id } : {}),
      firstName: firstName.trim(),
      lastName: lastName.trim() || undefined,
      email: email.trim(),
      phone: validPhones.length > 0 ? validPhones[0].number : undefined, // Legacy field - use first phone
      phones: validPhones, // New phones array
      address: address.trim() || undefined,
      unit: unit.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      zipCode: zipCode.trim() || undefined,
      company: company.trim() || undefined,
      companyId: selectedCompanyId || undefined,
      role: role.trim() || undefined,
      position: role.trim() || undefined, // Map role to position for backward compatibility
      onDealTeam,
      dealTeamNotes: dealTeamNotes.trim() || undefined,
      dealAssignment: onDealTeam && dealAssignment ? dealAssignment : undefined,
      contactType: !onDealTeam ? contactType : undefined,
      assignedDeals: onDealTeam ? assignedDeals : [],
      photoDataUrl,
      leadScore, // Legacy field for backward compatibility
      contactTag,
      leadStatus: contactTag === 'lead' ? leadStatus : null, // Explicitly null to clear field when not lead
    };

    if (contact) {
      updateContactMutation.mutate(payload);
    } else {
      createContactMutation.mutate(payload);
    }
  }

  async function onPhotoSelected(file?: File) {
    if (!file) return;
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setPhotoDataUrl(url);
  }

  const isLoading = createContactMutation.isPending || updateContactMutation.isPending;

  return (
    <StandardDialogShell
      open={isOpen}
      onOpenChange={(v) => { if (!v) onClose(); }}
      title={isEdit ? "Edit Contact" : "Create Contact"}
      description="Business-ready contact card. Only the essentials."
      icon={User}
      size="lg"
      className="max-w-5xl max-h-[92vh] p-0 overflow-hidden"
      primaryAction={{
        label: isEdit ? "Save Changes" : "Add Contact",
        onClick: handleSave,
        disabled: isLoading,
        loading: isLoading,
      }}
      secondaryAction={{
        label: "Cancel",
        onClick: onClose,
        disabled: isLoading,
      }}
    >
        {/* Body */}
        <div className="px-8 py-6 overflow-y-auto max-h-[calc(92vh-200px)] space-y-6">
          {/* Photo + Basic Info Card */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-medium">Basic Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-8 items-start">
                {/* Photo Upload */}
                <div className="flex flex-col items-center gap-4">
                  <div className="relative h-32 w-32 rounded-2xl bg-gradient-to-br from-muted to-muted/50 overflow-hidden flex items-center justify-center border-2 border-dashed border-muted-foreground/20 hover:border-muted-foreground/40 transition-colors">
                    {photoDataUrl ? (
                      <img alt="Contact avatar" src={photoDataUrl} className="h-full w-full object-cover" data-testid="contact-photo" />
                    ) : (
                      <User className="h-12 w-12 text-muted-foreground/40" />
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 cursor-pointer font-medium transition-colors">
                    <Upload className="h-4 w-4" />
                    <span>Upload photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => onPhotoSelected(e.target.files?.[0])}
                      data-testid="input-photo-upload"
                    />
                  </label>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name *</Label>
                <Input
                  id="firstName"
                  ref={firstNameRef}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                  className={classNames(touched && errors.firstName && "border-destructive focus-visible:ring-destructive")}
                  data-testid="input-first-name"
                />
                {touched && errors.firstName && (
                  <p className="text-xs text-destructive">{errors.firstName}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name *</Label>
                <Input 
                  id="lastName" 
                  value={lastName} 
                  onChange={(e) => setLastName(e.target.value)} 
                  placeholder="Doe" 
                  className={classNames(touched && errors.lastName && "border-destructive focus-visible:ring-destructive")}
                  data-testid="input-last-name"
                />
                {touched && errors.lastName && (
                  <p className="text-xs text-destructive">{errors.lastName}</p>
                )}
              </div>
              
              {/* Duplicate Contact Warning */}
              {showDuplicateWarning && duplicateContacts.length > 0 && (
                <div className="col-span-2 p-3 bg-amber-50 border border-amber-200 rounded-lg" data-testid="duplicate-warning">
                  <p className="text-sm font-medium text-amber-800 mb-2">
                    Possible duplicate contact{duplicateContacts.length > 1 ? 's' : ''} found:
                  </p>
                  <ul className="space-y-1">
                    {duplicateContacts.map((dup) => (
                      <li key={dup.id} className="text-sm text-amber-700">
                        {dup.firstName} {dup.lastName}
                        {(dup.city || dup.state) && (
                          <span className="text-amber-600"> - {[dup.city, dup.state].filter(Boolean).join(', ')}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <button 
                    type="button"
                    onClick={() => setShowDuplicateWarning(false)}
                    className="text-xs text-amber-600 hover:text-amber-800 mt-2 underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input 
                  id="email" 
                  type="email"
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="jane.doe@example.com"
                  className={classNames(touched && errors.email && "border-destructive focus-visible:ring-destructive")}
                  data-testid="input-email"
                />
                {touched && errors.email && (
                  <p className="text-xs text-destructive">{errors.email}</p>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Phone className="h-4 w-4"/> Phone Numbers *
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPhone}
                    className="h-7 text-xs"
                    data-testid="button-add-phone"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Phone
                  </Button>
                </div>
                <div className="space-y-2">
                  {phones.map((phone, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <Select 
                        value={phone.type} 
                        onValueChange={(value) => updatePhone(index, 'type', value)}
                      >
                        <SelectTrigger className="w-28" data-testid={`select-phone-type-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="office">Office</SelectItem>
                          <SelectItem value="mobile">Mobile</SelectItem>
                          <SelectItem value="home">Home</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        inputMode="tel"
                        value={phone.number}
                        onChange={(e) => updatePhone(index, 'number', formatPhone(e.target.value))}
                        placeholder="(555) 555-1234"
                        className="flex-1"
                        data-testid={`input-phone-${index}`}
                      />
                      {phones.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removePhone(index)}
                          className="h-10 w-10 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          data-testid={`button-remove-phone-${index}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {touched && errors.phones && (
                  <p className="text-xs text-destructive">{errors.phones}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company *</Label>
                <Popover open={companyPopoverOpen} onOpenChange={setCompanyPopoverOpen}>
                  <PopoverTrigger asChild>
                    <div className="relative">
                      <Input 
                        id="company" 
                        value={company} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setCompany(val);
                          setCompanySearchQuery(val);
                          setSelectedCompanyId(null);
                          if (val.length >= 2) {
                            setCompanyPopoverOpen(true);
                          } else {
                            setCompanyPopoverOpen(false);
                          }
                        }}
                        onFocus={() => {
                          if (company.length >= 2) setCompanyPopoverOpen(true);
                        }}
                        placeholder="Search or enter company name..." 
                        className={classNames(touched && errors.company && "border-destructive focus-visible:ring-destructive")}
                        data-testid="input-company"
                        autoComplete="off"
                      />
                      {selectedCompanyId && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          <Badge variant="secondary" className="text-xs">Linked</Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0"
                            onClick={(e) => {
                              e.preventDefault();
                              setSelectedCompanyId(null);
                            }}
                            data-testid="button-clear-company-link"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <Command>
                      <CommandList>
                        {companySuggestions.length === 0 && companySearchQuery.length >= 2 && (
                          <CommandEmpty>
                            <div className="p-2 text-sm text-muted-foreground text-center">
                              No existing companies found.<br />
                              <span className="text-xs">New company will be created for review.</span>
                            </div>
                          </CommandEmpty>
                        )}
                        {companySuggestions.length > 0 && (
                          <CommandGroup heading="Existing Companies">
                            {companySuggestions.map((c) => (
                              <CommandItem
                                key={c.id}
                                value={c.id}
                                onSelect={() => {
                                  setCompany(c.name);
                                  setSelectedCompanyId(c.id);
                                  setCompanyPopoverOpen(false);
                                }}
                                data-testid={`company-suggestion-${c.id}`}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">{c.name}</span>
                                  {c.industry && (
                                    <span className="text-xs text-muted-foreground">{c.industry}</span>
                                  )}
                                </div>
                                {selectedCompanyId === c.id && (
                                  <Check className="ml-auto h-4 w-4" />
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {touched && errors.company && (
                  <p className="text-xs text-destructive">{errors.company}</p>
                )}
                {company.trim() && !selectedCompanyId && (
                  <p className="text-xs text-muted-foreground">
                    New company will be created and sent to Pending Companies for review.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role/Title *</Label>
                <Input 
                  id="role" 
                  value={role} 
                  onChange={(e) => setRole(e.target.value)} 
                  placeholder="VP of Acquisitions" 
                  className={classNames(touched && errors.role && "border-destructive focus-visible:ring-destructive")}
                  data-testid="input-role"
                />
                {touched && errors.role && (
                  <p className="text-xs text-destructive">{errors.role}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactTag">Contact Tag *</Label>
                <Select value={contactTag} onValueChange={setContactTag}>
                  <SelectTrigger 
                    data-testid="select-contact-tag"
                    className={classNames(touched && errors.contactTag && "border-destructive focus-visible:ring-destructive")}
                  >
                    <SelectValue placeholder="Select contact tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="seller">Seller</SelectItem>
                    <SelectItem value="competitor">Competitor</SelectItem>
                    <SelectItem value="broker">Broker</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="insurance">Insurance</SelectItem>
                    <SelectItem value="lender">Lender</SelectItem>
                    <SelectItem value="attorney">Attorney</SelectItem>
                    <SelectItem value="developer">Developer</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="analyst">Analyst</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {touched && errors.contactTag && (
                  <p className="text-xs text-destructive">{errors.contactTag}</p>
                )}
              </div>
              {contactTag === 'lead' && (
                <div className="space-y-2">
                  <Label htmlFor="leadStatus" className="flex items-center gap-2">
                    <Thermometer className="h-4 w-4"/> Lead Status *
                  </Label>
                  <Select value={leadStatus} onValueChange={setLeadStatus}>
                    <SelectTrigger 
                      data-testid="select-lead-status"
                      className={classNames(touched && errors.leadStatus && "border-destructive focus-visible:ring-destructive")}
                    >
                      <SelectValue placeholder="Select lead status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hot">Hot</SelectItem>
                      <SelectItem value="warm">Warm</SelectItem>
                      <SelectItem value="cold">Cold</SelectItem>
                      <SelectItem value="long-term">Long-Term</SelectItem>
                    </SelectContent>
                  </Select>
                  {touched && errors.leadStatus && (
                    <p className="text-xs text-destructive">{errors.leadStatus}</p>
                  )}
                </div>
              )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Address Card */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg font-medium">Address *</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
            <div className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <AddressInput
                    value={address}
                    onChange={(value) => setAddress(value)}
                    onAddressSelect={(components: AddressComponents) => {
                      if (components.source === 'google' && components.street) {
                        setAddress(components.street);
                      }
                      if (components.city) setCity(components.city);
                      if (components.state) setState(components.state);
                      if (components.zipCode) setZipCode(components.zipCode);
                    }}
                    label="Street Address *"
                    placeholder="123 Marina Way"
                    testId="input-address"
                  />
                  {touched && errors.address && (
                    <p className="text-xs text-destructive">{errors.address}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="unit" className="text-sm">Unit/Suite/Apt</Label>
                  <Input 
                    id="unit" 
                    value={unit} 
                    onChange={(e) => setUnit(e.target.value)} 
                    placeholder="Unit 5A" 
                    data-testid="input-unit"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-sm">City *</Label>
                    <Input 
                      id="city" 
                      value={city} 
                      onChange={(e) => setCity(e.target.value)} 
                      placeholder="Key West"
                      className={classNames(touched && errors.city && "border-destructive focus-visible:ring-destructive")}
                      data-testid="input-city"
                    />
                    {touched && errors.city && (
                      <p className="text-xs text-destructive">{errors.city}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state" className="text-sm">State *</Label>
                    <StateSelect
                      value={state}
                      onValueChange={setState}
                      placeholder="Select state"
                    />
                    {touched && errors.state && (
                      <p className="text-xs text-destructive">{errors.state}</p>
                    )}
                  </div>
                </div>
                <div className="w-full max-w-[200px] space-y-2">
                  <Label htmlFor="zipCode" className="text-sm">Zip Code *</Label>
                  <Input 
                    id="zipCode" 
                    value={zipCode} 
                    onChange={(e) => setZipCode(e.target.value)} 
                    placeholder="33040"
                    className={classNames(touched && errors.zipCode && "border-destructive focus-visible:ring-destructive")}
                    data-testid="input-zip-code"
                  />
                  {touched && errors.zipCode && (
                    <p className="text-xs text-destructive">{errors.zipCode}</p>
                  )}
                </div>
              </div>
            </div>
            </CardContent>
          </Card>

          {/* Deal Team Card */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg font-medium">Deal Team</CardTitle>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Switch 
                    checked={onDealTeam} 
                    onCheckedChange={setOnDealTeam} 
                    data-testid="switch-deal-team"
                  />
                  <span className="text-sm text-muted-foreground">On team</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              
              {onDealTeam ? (
                <div className="space-y-2">
                  <Label className="text-sm">Assign to Deal</Label>
                  <Select value={dealAssignment} onValueChange={setDealAssignment}>
                    <SelectTrigger data-testid="select-deal-assignment">
                      <SelectValue placeholder="Select a deal to assign" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">
                        <span className="text-muted-foreground">No deal assigned</span>
                      </SelectItem>
                      {deals.map((deal: Deal) => (
                        <SelectItem key={deal.id} value={deal.id}>
                          {deal.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-sm">Contact Type</Label>
                  <Select value={contactType} onValueChange={setContactType}>
                    <SelectTrigger data-testid="select-contact-type">
                      <SelectValue placeholder="Select contact type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prospect">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-blue-100 text-blue-800 text-xs">Prospect</Badge>
                          <span className="text-xs text-muted-foreground">Potential customer</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="vendor">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-orange-100 text-orange-800 text-xs">Vendor</Badge>
                          <span className="text-xs text-muted-foreground">Service provider</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="buyer">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-100 text-green-800 text-xs">Buyer</Badge>
                          <span className="text-xs text-muted-foreground">Purchasing contact</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="seller">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-purple-100 text-purple-800 text-xs">Seller</Badge>
                          <span className="text-xs text-muted-foreground">Selling contact</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="partner">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-indigo-100 text-indigo-800 text-xs">Partner</Badge>
                          <span className="text-xs text-muted-foreground">Business partner</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="client">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-100 text-emerald-800 text-xs">Client</Badge>
                          <span className="text-xs text-muted-foreground">Existing customer</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="space-y-2">
                <Label className="text-sm">Notes</Label>
                <Textarea 
                  id="dealTeam" 
                  rows={4} 
                  value={dealTeamNotes} 
                  onChange={(e) => setDealTeamNotes(e.target.value)} 
                  placeholder="Notes about this person's role on the deal team, responsibilities, coverage, etc." 
                  data-testid="textarea-deal-team-notes"
                  className="resize-none"
                />
              </div>
            </CardContent>
          </Card>
        </div>
    </StandardDialogShell>
  );
}
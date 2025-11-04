import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StateSelect } from "@/components/ui/state-select";
import { User, Phone, Upload, Thermometer, Check, ChevronsUpDown, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertContactSchema, type Contact, type Deal } from "@shared/schema";

export type ContactPayload = {
  id?: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string; // Street address
  unit?: string; // Unit/Suite/Apt
  city?: string;
  state?: string;
  zipCode?: string;
  company?: string;
  role?: string;
  position?: string; // legacy field mapping
  onDealTeam?: boolean;
  dealTeamNotes?: string;
  dealAssignment?: string; // Single deal ID assignment
  contactType?: string; // prospect, vendor, buyer, seller, partner, client
  assignedDeals?: string[]; // Array of deal IDs (legacy)
  photoDataUrl?: string; // base64 preview
  leadScore?: string; // hot, warm, cold, new
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
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [address, setAddress] = useState(contact?.address ?? "");
  const [unit, setUnit] = useState(contact?.unit ?? "");
  const [city, setCity] = useState(contact?.city ?? "");
  const [state, setState] = useState(contact?.state ?? "");
  const [zipCode, setZipCode] = useState(contact?.zipCode ?? "");
  const [company, setCompany] = useState(contact?.company ?? "");
  const [role, setRole] = useState(contact?.role ?? contact?.position ?? "");
  const [onDealTeam, setOnDealTeam] = useState(Boolean(contact?.onDealTeam));
  const [dealTeamNotes, setDealTeamNotes] = useState(contact?.dealTeamNotes ?? "");
  const [dealAssignment, setDealAssignment] = useState<string>("");
  const [contactType, setContactType] = useState<string>("prospect");
  const [assignedDeals, setAssignedDeals] = useState<string[]>([]);
  const [dealsPopoverOpen, setDealsPopoverOpen] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(contact?.photoDataUrl ?? undefined);
  const [leadScore, setLeadScore] = useState(contact?.leadScore ?? "new");

  const [touched, setTouched] = useState(false);
  const firstNameRef = useRef<HTMLInputElement | null>(null);

  // Query to fetch deals for the dropdown
  const { data: deals = [] } = useQuery({
    queryKey: ['/api/deals'],
    enabled: onDealTeam, // Only fetch when Deal Team is toggled on
  }) as { data: Deal[] };

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
    setAddress(contact?.address ?? "");
    setUnit(contact?.unit ?? "");
    setCity(contact?.city ?? "");
    setState(contact?.state ?? "");
    setZipCode(contact?.zipCode ?? "");
    setCompany(contact?.company ?? "");
    setRole(contact?.role ?? contact?.position ?? "");
    setOnDealTeam(Boolean(contact?.onDealTeam));
    setDealTeamNotes(contact?.dealTeamNotes ?? "");
    setDealAssignment(contact?.dealAssignment ?? "");
    setContactType(contact?.contactType ?? "prospect");
    setAssignedDeals([]);  // TODO: Load from contact's assigned deals when backend supports it
    setPhotoDataUrl(contact?.photoDataUrl ?? undefined);
    setLeadScore(contact?.leadScore ?? "new");
    setTouched(false);
  }, [isOpen, contact]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = "First name is required";
    if (!lastName.trim()) e.lastName = "Last name is required";
    if (!email.trim()) e.email = "Email is required";
    if (!phone.trim()) e.phone = "Phone is required";
    if (!company.trim()) e.company = "Company is required";
    if (!role.trim()) e.role = "Role/Title is required";
    if (!leadScore) e.leadScore = "Lead status is required";
    return e;
  }, [firstName, lastName, email, phone, company, role, leadScore]);

  const createContactMutation = useMutation({
    mutationFn: async (data: any) => {
      const cleanData = { ...data };
      Object.keys(cleanData).forEach(key => {
        if (cleanData[key] === "") delete cleanData[key];
      });
      
      return await apiRequest('POST', '/api/contacts', cleanData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      toast({ title: "Contact created successfully" });
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
    setRole("");
    setOnDealTeam(false);
    setDealTeamNotes("");
    setAssignedDeals([]);
    setPhotoDataUrl(undefined);
    setLeadScore("new");
    setTouched(false);
  }

  function handleSave() {
    setTouched(true);
    if (Object.keys(errors).length) return;

    const payload: ContactPayload = {
      ...(contact?.id ? { id: contact.id } : {}),
      firstName: firstName.trim(),
      lastName: lastName.trim() || undefined,
      email: email.trim(),
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      unit: unit.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      zipCode: zipCode.trim() || undefined,
      company: company.trim() || undefined,
      role: role.trim() || undefined,
      position: role.trim() || undefined, // Map role to position for backward compatibility
      onDealTeam,
      dealTeamNotes: dealTeamNotes.trim() || undefined,
      dealAssignment: onDealTeam && dealAssignment ? dealAssignment : undefined,
      contactType: !onDealTeam ? contactType : undefined,
      assignedDeals: onDealTeam ? assignedDeals : [],
      photoDataUrl,
      leadScore,
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
    <Dialog open={isOpen} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden" data-testid="contact-form-modal">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <User className="h-6 w-6" />
            {isEdit ? "Edit Contact" : "Add Contact"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Business-ready contact card. Only the essentials.
          </DialogDescription>
        </DialogHeader>

        {/* Body */}
        <div className="px-6 pb-2 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Photo + Name */}
          <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-6 items-start py-4">
            <div className="flex flex-col items-center gap-3">
              <div className="relative h-24 w-24 rounded-2xl bg-muted overflow-hidden flex items-center justify-center">
                {photoDataUrl ? (
                  <img alt="Contact avatar" src={photoDataUrl} className="h-full w-full object-cover" data-testid="contact-photo" />
                ) : (
                  <User className="h-10 w-10 opacity-60" />
                )}
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
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
                <Label htmlFor="phone" className="flex items-center gap-2"><Phone className="h-4 w-4"/> Phone *</Label>
                <Input
                  id="phone"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(555) 555-1234"
                  className={classNames(touched && errors.phone && "border-destructive focus-visible:ring-destructive")}
                  data-testid="input-phone"
                />
                {touched && errors.phone && (
                  <p className="text-xs text-destructive">{errors.phone}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company *</Label>
                <Input 
                  id="company" 
                  value={company} 
                  onChange={(e) => setCompany(e.target.value)} 
                  placeholder="Southern Marinas" 
                  className={classNames(touched && errors.company && "border-destructive focus-visible:ring-destructive")}
                  data-testid="input-company"
                />
                {touched && errors.company && (
                  <p className="text-xs text-destructive">{errors.company}</p>
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
                <Label htmlFor="leadScore" className="flex items-center gap-2">
                  <Thermometer className="h-4 w-4"/> Lead Status *
                </Label>
                <Select value={leadScore} onValueChange={setLeadScore}>
                  <SelectTrigger 
                    data-testid="select-lead-score"
                    className={classNames(touched && errors.leadScore && "border-destructive focus-visible:ring-destructive")}
                  >
                    <SelectValue placeholder="Select lead status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hot">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="text-xs">Hot</Badge>
                        <span className="text-xs text-muted-foreground">High priority</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="warm">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">Warm</Badge>
                        <span className="text-xs text-muted-foreground">Medium priority</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="cold">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">Cold</Badge>
                        <span className="text-xs text-muted-foreground">Low priority</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="new">
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="text-xs">New</Badge>
                        <span className="text-xs text-muted-foreground">Just added</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {touched && errors.leadScore && (
                  <p className="text-xs text-destructive">{errors.leadScore}</p>
                )}
              </div>
            </div>
          </div>

          {/* Address & Deal Team */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 items-start">
            <div className="space-y-4">
              <Label className="text-base font-medium">Address</Label>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="address" className="text-sm">Street Address</Label>
                  <Input 
                    id="address" 
                    value={address} 
                    onChange={(e) => setAddress(e.target.value)} 
                    placeholder="123 Marina Way" 
                    data-testid="input-address"
                  />
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
                  <div>
                    <Label htmlFor="city" className="text-sm">City</Label>
                    <Input 
                      id="city" 
                      value={city} 
                      onChange={(e) => setCity(e.target.value)} 
                      placeholder="Key West" 
                      data-testid="input-city"
                    />
                  </div>
                  <div>
                    <Label htmlFor="state" className="text-sm">State</Label>
                    <StateSelect
                      value={state}
                      onValueChange={setState}
                      placeholder="Select state"
                    />
                  </div>
                </div>
                <div className="w-full max-w-[200px]">
                  <Label htmlFor="zipCode" className="text-sm">Zip Code</Label>
                  <Input 
                    id="zipCode" 
                    value={zipCode} 
                    onChange={(e) => setZipCode(e.target.value)} 
                    placeholder="33040" 
                    data-testid="input-zip-code"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="dealTeam">Deal Team</Label>
                <div className="flex items-center gap-2 text-sm">
                  <Switch 
                    checked={onDealTeam} 
                    onCheckedChange={setOnDealTeam} 
                    data-testid="switch-deal-team"
                  />
                  <span className="text-muted-foreground">On team</span>
                </div>
              </div>
              
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
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 bg-muted/40 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Press <kbd className="px-1 py-0.5 border rounded">Esc</kbd> to close</p>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              onClick={onClose}
              disabled={isLoading}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              className="min-w-24"
              disabled={isLoading}
              data-testid="button-save-contact"
            >
              {isLoading ? "Saving..." : (isEdit ? "Save" : "Add")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
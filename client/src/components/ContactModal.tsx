import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Phone, Upload } from "lucide-react";
import { AddressInput, type AddressComponents } from "@/components/address-input";

/**
 * ContactModal — Add/Edit Contact (business-focused)
 *
 * Fields: first name, last name, phone, address, company, role, deal team (toggle + notes box), photo.
 *
 * Props:
 * - open: boolean
 * - onClose: () => void
 * - onSave: (payload: ContactPayload) => void
 * - initialData?: Partial<ContactPayload>
 *
 * Drop-in usage example:
 * const [open, setOpen] = useState(false)
 * const [editing, setEditing] = useState<ContactPayload | null>(null)
 * <ContactModal
 *   open={open}
 *   onClose={() => { setOpen(false); setEditing(null) }}
 *   initialData={editing ?? undefined}
 * />
 */

export type ContactPayload = {
  id?: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string; // multiline freeform
  company?: string;
  role?: string;
  customRole?: string; // Custom role when role is "other"
  timezone?: string;
  onDealTeam?: boolean;
  dealTeamNotes?: string;
  photoDataUrl?: string; // base64 preview
};

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

export default function ContactModal({ open, onClose, onSave, initialData }: {
  open: boolean;
  onClose: () => void;
  onSave: (payload: ContactPayload) => void;
  initialData?: Partial<ContactPayload>;
}) {
  const isEdit = Boolean(initialData?.id || initialData?.firstName);

  const [firstName, setFirstName] = useState(initialData?.firstName ?? "");
  const [lastName, setLastName] = useState(initialData?.lastName ?? "");
  const [email, setEmail] = useState(initialData?.email ?? "");
  const [phone, setPhone] = useState(initialData?.phone ?? "");
  const [address, setAddress] = useState(initialData?.address ?? "");
  const [company, setCompany] = useState(initialData?.company ?? "");
  const [role, setRole] = useState(initialData?.role ?? "");
  const [customRole, setCustomRole] = useState(initialData?.customRole ?? "");
  const [timezone, setTimezone] = useState(initialData?.timezone ?? "America/New_York");
  const [onDealTeam, setOnDealTeam] = useState(Boolean(initialData?.onDealTeam));
  const [dealTeamNotes, setDealTeamNotes] = useState(initialData?.dealTeamNotes ?? "");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(initialData?.photoDataUrl);

  const [touched, setTouched] = useState(false);
  const firstNameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => firstNameRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Reset when initialData changes/open toggles
  useEffect(() => {
    if (!open) return;
    setFirstName(initialData?.firstName ?? "");
    setLastName(initialData?.lastName ?? "");
    setEmail(initialData?.email ?? "");
    setPhone(initialData?.phone ?? "");
    setAddress(initialData?.address ?? "");
    setCompany(initialData?.company ?? "");
    setRole(initialData?.role ?? "");
    setCustomRole(initialData?.customRole ?? "");
    setTimezone(initialData?.timezone ?? "America/New_York");
    setOnDealTeam(Boolean(initialData?.onDealTeam));
    setDealTeamNotes(initialData?.dealTeamNotes ?? "");
    setPhotoDataUrl(initialData?.photoDataUrl);
    setTouched(false);
  }, [open, initialData]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = "First name is required";
    if (!email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "Please enter a valid email address";
    if (!phone.trim()) e.phone = "Phone is required";
    if (!timezone) e.timezone = "Timezone is required";
    return e;
  }, [firstName, email, phone, timezone]);

  function handleSave() {
    setTouched(true);
    if (Object.keys(errors).length) return;
    const payload: ContactPayload = {
      ...(initialData?.id ? { id: initialData.id } : {}),
      firstName: firstName.trim(),
      lastName: lastName.trim() || undefined,
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim() || undefined,
      company: company.trim() || undefined,
      role: role || undefined,
      customRole: (role === "other" && customRole.trim()) ? customRole.trim() : undefined,
      timezone,
      onDealTeam,
      dealTeamNotes: dealTeamNotes.trim() || undefined,
      photoDataUrl,
    };
    onSave(payload);
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

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" data-testid={isEdit ? "dialog-edit-contact" : "dialog-add-contact"}>
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <User className="h-6 w-6" />
            {isEdit ? "Edit Contact" : "Add Contact"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Business-ready contact card. Only the essentials.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-6">
            {/* Photo Upload Section */}
            <div className="flex items-center gap-4 pb-4 border-b">
              <div className="relative h-20 w-20 rounded-xl bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
                {photoDataUrl ? (
                  <img alt="Contact avatar" src={photoDataUrl} className="h-full w-full object-cover" />
                ) : (
                  <User className="h-8 w-8 opacity-60" />
                )}
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer text-primary hover:underline">
                <Upload className="h-4 w-4" />
                <span>Upload photo</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPhotoSelected(e.target.files?.[0])}
                />
              </label>
            </div>

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Basic Information</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First name *</Label>
                  <Input
                    id="firstName"
                    ref={firstNameRef}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Krissy"
                    className={classNames(touched && errors.firstName && "border-destructive focus-visible:ring-destructive")}
                    data-testid={isEdit ? "input-edit-name" : "input-contact-name"}
                  />
                  {touched && errors.firstName && (
                    <p className="text-xs text-destructive">{errors.firstName}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input 
                    id="lastName" 
                    value={lastName} 
                    onChange={(e) => setLastName(e.target.value)} 
                    placeholder="Gritz" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="krissy@marinamatch.com" 
                    className={classNames(touched && errors.email && "border-destructive focus-visible:ring-destructive")}
                    data-testid={isEdit ? "input-edit-email" : "input-contact-email"}
                  />
                  {touched && errors.email && (
                    <p className="text-xs text-destructive">{errors.email}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4"/> Phone *
                  </Label>
                  <Input
                    id="phone"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    placeholder="(727) 580-0196"
                    className={classNames(touched && errors.phone && "border-destructive focus-visible:ring-destructive")}
                    data-testid={isEdit ? "input-edit-phone" : "input-contact-phone"}
                  />
                  {touched && errors.phone && (
                    <p className="text-xs text-destructive">{errors.phone}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone *</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger 
                      className={classNames(touched && errors.timezone && "border-destructive focus-visible:ring-destructive")}
                      data-testid={isEdit ? "select-edit-timezone" : "select-contact-timezone"}
                    >
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {touched && errors.timezone && (
                    <p className="text-xs text-destructive">{errors.timezone}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input 
                    id="company" 
                    value={company} 
                    onChange={(e) => setCompany(e.target.value)} 
                    placeholder="Southern Marinas" 
                    data-testid={isEdit ? "input-edit-company" : "input-contact-company"}
                  />
                </div>
              </div>
            </div>

            {/* Professional Information */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Professional Information</h3>
              
              <div className="space-y-2">
                <Label htmlFor="role">Role/Title</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger data-testid={isEdit ? "select-edit-role" : "select-contact-role"}>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {contactRoles.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Role Input - Shows when "Other" is selected */}
              {role === "other" && (
                <div className="space-y-2">
                  <Label htmlFor="customRole">Position/Role</Label>
                  <Input
                    id="customRole"
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    placeholder="CFO"
                    data-testid={isEdit ? "input-edit-custom-role" : "input-custom-role"}
                  />
                  <p className="text-xs text-muted-foreground">Enter the specific position or role for this contact</p>
                </div>
              )}
            </div>

            {/* Location & Deal Team */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Additional Details</h3>
              
              <div className="space-y-2">
                <AddressInput
                  value={address}
                  onChange={(value) => setAddress(value)}
                  onAddressSelect={(components: AddressComponents) => {
                    setAddress(components.fullAddress || components.street || '');
                  }}
                  label="Address"
                  placeholder="Start typing an address..."
                  testId={isEdit ? "input-edit-address" : "input-address"}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="dealTeam">Deal Team</Label>
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={onDealTeam} 
                      onCheckedChange={setOnDealTeam}
                      id="dealTeamSwitch"
                    />
                    <span className="text-sm text-muted-foreground">
                      {onDealTeam ? "On team" : "Not on team"}
                    </span>
                  </div>
                </div>
                <Textarea 
                  id="dealTeam" 
                  rows={3} 
                  value={dealTeamNotes} 
                  onChange={(e) => setDealTeamNotes(e.target.value)} 
                  placeholder="Notes about this person's role on the deal team, responsibilities, coverage, etc." 
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/20 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 border rounded text-xs">Esc</kbd> to close
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} data-testid={isEdit ? "button-cancel-edit" : "button-cancel"}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="min-w-24" data-testid={isEdit ? "button-save-edit" : "button-save-contact"}>
              {isEdit ? "Save Changes" : "Add Contact"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

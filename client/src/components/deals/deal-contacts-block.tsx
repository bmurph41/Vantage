/**
 * DealContactsBlock
 * Structured contact management with team classification.
 * Add Seller / Buyer / Attorney / Broker / Lender / Other
 */

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  UserPlus, Trash2, Users, Scale, Briefcase, Landmark, MoreHorizontal,
  Phone, Mail, ChevronDown, ChevronUp, GripVertical, ShieldCheck, Building2, Link2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useQuery } from "@tanstack/react-query";
import type { Contact } from "@shared/schema";

export interface DealContactEntry {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  titleRole: string;
  phone: string;
  email: string;
  contactType: "seller" | "buyer" | "seller_counsel" | "buyer_counsel" | "title_company" | "attorney" | "broker" | "lender" | "other";
  teamType: "seller_team" | "buyer_team" | "mutual";
  linkedContactId?: string; // CRM contact ID if linked
}

interface DealContactsBlockProps {
  contacts: DealContactEntry[];
  onChange: (contacts: DealContactEntry[]) => void;
  className?: string;
  readOnly?: boolean;
}

const CONTACT_TYPES = [
  { value: "seller", label: "Seller", icon: Users, defaultTeam: "seller_team" as const, color: "bg-red-50 text-red-700 border-red-200" },
  { value: "buyer", label: "Buyer", icon: Users, defaultTeam: "buyer_team" as const, color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "seller_counsel", label: "Seller Counsel", icon: Scale, defaultTeam: "seller_team" as const, color: "bg-rose-50 text-rose-700 border-rose-200" },
  { value: "buyer_counsel", label: "Buyer Counsel", icon: Scale, defaultTeam: "buyer_team" as const, color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { value: "title_company", label: "Title Company", icon: ShieldCheck, defaultTeam: "mutual" as const, color: "bg-teal-50 text-teal-700 border-teal-200" },
  { value: "attorney", label: "Attorney", icon: Scale, defaultTeam: "mutual" as const, color: "bg-purple-50 text-purple-700 border-purple-200" },
  { value: "broker", label: "Broker", icon: Briefcase, defaultTeam: "mutual" as const, color: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "lender", label: "Lender", icon: Landmark, defaultTeam: "mutual" as const, color: "bg-green-50 text-green-700 border-green-200" },
  { value: "other", label: "Other", icon: MoreHorizontal, defaultTeam: "mutual" as const, color: "bg-gray-50 text-gray-700 border-gray-200" },
] as const;

const TEAM_TYPES = [
  { value: "seller_team", label: "Seller Team" },
  { value: "buyer_team", label: "Buyer Team" },
  { value: "mutual", label: "Mutual" },
] as const;

function getContactTypeConfig(type: string) {
  return CONTACT_TYPES.find((t) => t.value === type) || CONTACT_TYPES[5];
}

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function ContactCard({
  contact, index, onUpdate, onRemove, contacts: crmContacts,
}: {
  contact: DealContactEntry;
  index: number;
  onUpdate: (field: keyof DealContactEntry, value: string) => void;
  onRemove: () => void;
  contacts?: Contact[];
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showLinkCRM, setShowLinkCRM] = useState(false);
  const typeConfig = getContactTypeConfig(contact.contactType);
  const TypeIcon = typeConfig.icon;

  const contactOptions = (crmContacts || []).map((c) => ({
    value: c.id,
    label: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || 'Unnamed',
  }));

  const handleLinkContact = (contactId: string) => {
    const linked = (crmContacts || []).find((c) => c.id === contactId);
    if (linked) {
      onUpdate("linkedContactId", contactId);
      if (linked.firstName) onUpdate("firstName", linked.firstName);
      if (linked.lastName) onUpdate("lastName", linked.lastName || '');
      if (linked.email) onUpdate("email", linked.email);
      if (linked.phone) onUpdate("phone", linked.phone);
      if (linked.company) onUpdate("company", linked.company);
      if (linked.title) onUpdate("titleRole", linked.title);
      setShowLinkCRM(false);
    }
  };

  return (
    <div className={cn("rounded-lg border p-3 space-y-3 transition-all", typeConfig.color)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GripVertical className="w-3.5 h-3.5 text-gray-400 cursor-grab" />
          <TypeIcon className="w-4 h-4" />
          <Badge variant="outline" className="text-[10px] h-5 font-semibold">
            {typeConfig.label}
          </Badge>
          {contact.firstName || contact.lastName ? (
            <span className="text-xs font-medium">{contact.firstName} {contact.lastName}</span>
          ) : (
            <span className="text-xs text-muted-foreground italic">New Contact</span>
          )}
          {contact.linkedContactId && (
            <Badge variant="secondary" className="text-[9px] h-4 gap-0.5">
              <Link2 className="w-2.5 h-2.5" /> CRM Linked
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6"
            onClick={() => setShowLinkCRM(!showLinkCRM)} title="Link to CRM Contact">
            <Link2 className="w-3.5 h-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6"
            onClick={() => setIsCollapsed(!isCollapsed)}>
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </Button>
          <Button type="button" variant="ghost" size="icon"
            className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-100"
            onClick={onRemove}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {showLinkCRM && (
        <div className="rounded-md border bg-white p-2">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Link to CRM Contact</Label>
          <SearchableSelect
            options={contactOptions}
            value={contact.linkedContactId || ''}
            onValueChange={handleLinkContact}
            placeholder="Search CRM contacts..."
            searchPlaceholder="Type to search..."
            emptyText="No contacts found"
          />
        </div>
      )}

      {!isCollapsed && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">First Name</Label>
              <Input placeholder="First Name" value={contact.firstName}
                onChange={(e) => onUpdate("firstName", e.target.value)} className="h-8 text-xs bg-white" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Last Name</Label>
              <Input placeholder="Last Name" value={contact.lastName}
                onChange={(e) => onUpdate("lastName", e.target.value)} className="h-8 text-xs bg-white" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Company</Label>
              <Input placeholder="Company" value={contact.company}
                onChange={(e) => onUpdate("company", e.target.value)} className="h-8 text-xs bg-white" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Title / Role</Label>
              <Input placeholder="Title/Role" value={contact.titleRole}
                onChange={(e) => onUpdate("titleRole", e.target.value)} className="h-8 text-xs bg-white" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <Phone className="w-3 h-3 inline mr-0.5" /> Phone
              </Label>
              <Input placeholder="(XXX) XXX-XXXX" value={contact.phone}
                onChange={(e) => onUpdate("phone", formatPhoneInput(e.target.value))}
                className="h-8 text-xs bg-white" maxLength={14} />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <Mail className="w-3 h-3 inline mr-0.5" /> Email
              </Label>
              <Input type="email" placeholder="email@company.com" value={contact.email}
                onChange={(e) => onUpdate("email", e.target.value)} className="h-8 text-xs bg-white" />
            </div>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Team</Label>
            <RadioGroup value={contact.teamType}
              onValueChange={(value) => onUpdate("teamType", value)} className="flex gap-3">
              {TEAM_TYPES.map((team) => (
                <div key={team.value} className="flex items-center space-x-1.5">
                  <RadioGroupItem value={team.value} id={`team-${contact.id}-${team.value}`} className="h-3.5 w-3.5" />
                  <Label htmlFor={`team-${contact.id}-${team.value}`} className="text-xs cursor-pointer">
                    {team.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </>
      )}
    </div>
  );
}

function KeyContactList({ contacts }: { contacts: DealContactEntry[] }) {
  const sellerTeam = contacts.filter((c) => c.teamType === "seller_team");
  const buyerTeam = contacts.filter((c) => c.teamType === "buyer_team");
  const mutual = contacts.filter((c) => c.teamType === "mutual");

  const renderTeamSection = (title: string, members: DealContactEntry[], color: string) => {
    if (members.length === 0) return null;
    return (
      <div className="space-y-2">
        <h5 className={cn("text-xs font-semibold uppercase tracking-wider", color)}>{title}</h5>
        <div className="space-y-1.5">
          {members.map((c) => (
            <div key={c.id} className="flex items-center gap-3 text-xs py-1 border-b border-gray-100 last:border-0">
              <span className="font-medium min-w-[120px]">{c.firstName} {c.lastName}</span>
              <Badge variant="outline" className="text-[9px] h-4 px-1">
                {getContactTypeConfig(c.contactType).label}
              </Badge>
              <span className="text-muted-foreground">{c.company}</span>
              {c.phone && <span className="text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
              {c.email && <span className="text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 print:space-y-3">
      {renderTeamSection("Seller Team", sellerTeam, "text-red-600")}
      {renderTeamSection("Buyer Team", buyerTeam, "text-blue-600")}
      {renderTeamSection("Mutual", mutual, "text-gray-600")}
      {contacts.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">No deal contacts added</p>
      )}
    </div>
  );
}

export function DealContactsBlock({ contacts, onChange, className, readOnly = false }: DealContactsBlockProps) {
  const { data: crmContacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
    enabled: !readOnly,
  });

  const addContact = (type: DealContactEntry["contactType"]) => {
    const typeConfig = CONTACT_TYPES.find((t) => t.value === type)!;
    const newContact: DealContactEntry = {
      id: `dc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      firstName: "", lastName: "", company: "", titleRole: "", phone: "", email: "",
      contactType: type,
      teamType: typeConfig.defaultTeam,
    };
    onChange([...contacts, newContact]);
  };

  const updateContact = (index: number, field: keyof DealContactEntry, value: string) => {
    const updated = [...contacts];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeContact = (index: number) => {
    onChange(contacts.filter((_, i) => i !== index));
  };

  if (readOnly) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4" /> Key Contact List
          </CardTitle>
        </CardHeader>
        <CardContent><KeyContactList contacts={contacts} /></CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <Label className="text-sm font-semibold mb-2 block">Deal Contacts</Label>
        <div className="flex flex-wrap gap-1.5">
          {CONTACT_TYPES.map(({ value, label, icon: Icon, color }) => (
            <Button key={value} type="button" variant="outline" size="sm"
              className={cn("h-7 text-xs gap-1", color)}
              onClick={() => addContact(value as DealContactEntry["contactType"])}>
              <UserPlus className="w-3 h-3" /> Add {label}
            </Button>
          ))}
        </div>
      </div>

      {contacts.length > 0 ? (
        <div className="space-y-2">
          {contacts.map((contact, index) => (
            <ContactCard key={contact.id} contact={contact} index={index}
              onUpdate={(field, value) => updateContact(index, field, value)}
              onRemove={() => removeContact(index)}
              contacts={crmContacts} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
          No deal contacts added. Use the buttons above to add contacts.
        </p>
      )}

      {contacts.length > 0 && (
        <details className="group">
          <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
            <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
            Preview Key Contact List
          </summary>
          <div className="mt-2 rounded-lg border p-3 bg-gray-50/50">
            <KeyContactList contacts={contacts} />
          </div>
        </details>
      )}
    </div>
  );
}

export default DealContactsBlock;

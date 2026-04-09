/**
 * ContactConsentPanel
 *
 * Manages GDPR and communication consent preferences for a CRM contact.
 * Patches consent flags via the /api/crm/contacts/:id/consent endpoint.
 */

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Shield, Save } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────

interface ConsentValues {
  doNotContact: boolean;
  gdprConsent: boolean;
  emailOptOut: boolean;
  smsOptOut: boolean;
  mailOptOut: boolean;
  consentNotes: string;
  gdprConsentSource: string;
  gdprConsentDate?: string | null;
}

interface ContactConsentPanelProps {
  contactId: string;
  doNotContact?: boolean;
  gdprConsent?: boolean;
  emailOptOut?: boolean;
  smsOptOut?: boolean;
  mailOptOut?: boolean;
  consentNotes?: string;
  gdprConsentSource?: string;
  gdprConsentDate?: string | null;
}

// ─── Component ────────────────────────────────────────────────────

export function ContactConsentPanel({
  contactId,
  doNotContact = false,
  gdprConsent = false,
  emailOptOut = false,
  smsOptOut = false,
  mailOptOut = false,
  consentNotes = "",
  gdprConsentSource = "",
  gdprConsentDate = null,
}: ContactConsentPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<ConsentValues>({
    doNotContact,
    gdprConsent,
    emailOptOut,
    smsOptOut,
    mailOptOut,
    consentNotes,
    gdprConsentSource,
  });

  // Sync from props when they change (e.g. after refetch)
  useEffect(() => {
    setForm({
      doNotContact,
      gdprConsent,
      emailOptOut,
      smsOptOut,
      mailOptOut,
      consentNotes,
      gdprConsentSource,
    });
  }, [doNotContact, gdprConsent, emailOptOut, smsOptOut, mailOptOut, consentNotes, gdprConsentSource]);

  const mutation = useMutation({
    mutationFn: async (values: ConsentValues) => {
      const res = await apiRequest("PATCH", `/api/crm/contacts/${contactId}/consent`, values);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm", "contacts", contactId] });
      queryClient.invalidateQueries({ queryKey: ["crm", "contacts"] });
      toast({ title: "Consent updated", description: "Contact consent preferences saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update consent preferences.", variant: "destructive" });
    },
  });

  const handleSave = () => {
    mutation.mutate(form);
  };

  const toggle = (field: keyof ConsentValues) => {
    setForm((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const hasChanges =
    form.doNotContact !== doNotContact ||
    form.gdprConsent !== gdprConsent ||
    form.emailOptOut !== emailOptOut ||
    form.smsOptOut !== smsOptOut ||
    form.mailOptOut !== mailOptOut ||
    form.consentNotes !== consentNotes ||
    form.gdprConsentSource !== gdprConsentSource;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Consent &amp; Privacy
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* ── Do Not Contact Warning ── */}
        {form.doNotContact && (
          <div className="flex items-start gap-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Do Not Contact is enabled</p>
              <p className="mt-0.5 text-xs">
                All outbound communications to this contact are suppressed.
                Remove this flag before sending any emails, calls, or mail.
              </p>
            </div>
          </div>
        )}

        {/* ── Toggle Switches ── */}
        <div className="space-y-4">
          <ConsentToggle
            id="doNotContact"
            label="Do Not Contact"
            description="Block all outbound communications"
            checked={form.doNotContact}
            onCheckedChange={() => toggle("doNotContact")}
            destructive
          />
          <ConsentToggle
            id="gdprConsent"
            label="GDPR Consent"
            description="Contact has given explicit data-processing consent"
            checked={form.gdprConsent}
            onCheckedChange={() => toggle("gdprConsent")}
          />
          <ConsentToggle
            id="emailOptOut"
            label="Email Opt Out"
            description="Exclude from email campaigns and sequences"
            checked={form.emailOptOut}
            onCheckedChange={() => toggle("emailOptOut")}
          />
          <ConsentToggle
            id="smsOptOut"
            label="SMS Opt Out"
            description="Exclude from text message communications"
            checked={form.smsOptOut}
            onCheckedChange={() => toggle("smsOptOut")}
          />
          <ConsentToggle
            id="mailOptOut"
            label="Mail Opt Out"
            description="Exclude from physical mail and printed materials"
            checked={form.mailOptOut}
            onCheckedChange={() => toggle("mailOptOut")}
          />
        </div>

        {/* ── GDPR Consent Date ── */}
        {form.gdprConsent && gdprConsentDate && (
          <div className="text-xs text-muted-foreground">
            Consent granted on{" "}
            <span className="font-mono">
              {new Date(gdprConsentDate).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
        )}

        {/* ── GDPR Consent Source ── */}
        {form.gdprConsent && (
          <div className="space-y-1.5">
            <Label htmlFor="gdprConsentSource" className="text-xs">
              Consent Source
            </Label>
            <input
              id="gdprConsentSource"
              type="text"
              placeholder="e.g. Web form, verbal, signed agreement"
              value={form.gdprConsentSource}
              onChange={(e) => setForm((prev) => ({ ...prev, gdprConsentSource: e.target.value }))}
              className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        )}

        {/* ── Notes ── */}
        <div className="space-y-1.5">
          <Label htmlFor="consentNotes" className="text-xs">
            Consent Notes
          </Label>
          <Textarea
            id="consentNotes"
            placeholder="Additional context about consent status..."
            rows={3}
            value={form.consentNotes}
            onChange={(e) => setForm((prev) => ({ ...prev, consentNotes: e.target.value }))}
          />
        </div>

        {/* ── Save Button ── */}
        <Button
          onClick={handleSave}
          disabled={mutation.isPending || !hasChanges}
          className="w-full"
          size="sm"
        >
          <Save className="h-3.5 w-3.5 mr-1.5" />
          {mutation.isPending ? "Saving..." : "Save Consent Preferences"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Sub-components ───────────────────────────────────────────────

function ConsentToggle({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  destructive,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: () => void;
  destructive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label
          htmlFor={id}
          className={`text-sm font-medium ${destructive && checked ? "text-red-600 dark:text-red-400" : ""}`}
        >
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

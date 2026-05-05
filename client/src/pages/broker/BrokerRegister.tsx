import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Pencil, X } from "lucide-react";
import { BrokerCredentialBadge } from "@/components/broker/BrokerCredentialBadge";

interface Registration {
  id: string;
  status: string;
  legalFirstName: string | null;
  legalLastName: string | null;
  legalName: string;
  companyName: string;
  email: string;
  phone: string | null;
  licenseNumber: string | null;
  licenseState: string | null;
  licenseExpiresAt: string | null;
  licenseDocumentUrl: string | null;
  yearsExperience: number | null;
  specialties: string[] | null;
  bio: string | null;
  website: string | null;
  linkedinUrl: string | null;
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  updatedAt: string | null;
}

interface FormState {
  legalFirstName: string;
  legalLastName: string;
  legalName: string;
  companyName: string;
  email: string;
  phone: string;
  licenseNumber: string;
  licenseState: string;
  licenseExpiresAt: string;
  licenseDocumentUrl: string;
  yearsExperience: string;
  specialties: string;
  bio: string;
  website: string;
  linkedinUrl: string;
}

interface CredentialFormState {
  legalFirstName: string;
  legalLastName: string;
  companyName: string;
  licenseNumber: string;
  licenseState: string;
  licenseExpiresAt: string;
  licenseDocumentUrl: string;
}

const EMPTY_FORM: FormState = {
  legalFirstName: "",
  legalLastName: "",
  legalName: "",
  companyName: "",
  email: "",
  phone: "",
  licenseNumber: "",
  licenseState: "",
  licenseExpiresAt: "",
  licenseDocumentUrl: "",
  yearsExperience: "",
  specialties: "",
  bio: "",
  website: "",
  linkedinUrl: "",
};

function credentialFormFromReg(reg: Registration): CredentialFormState {
  return {
    legalFirstName: reg.legalFirstName || "",
    legalLastName: reg.legalLastName || "",
    companyName: reg.companyName || "",
    licenseNumber: reg.licenseNumber || "",
    licenseState: reg.licenseState || "",
    licenseExpiresAt: reg.licenseExpiresAt
      ? reg.licenseExpiresAt.slice(0, 10)
      : "",
    licenseDocumentUrl: reg.licenseDocumentUrl || "",
  };
}

export default function BrokerRegister() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingCredentials, setEditingCredentials] = useState(false);
  const [credForm, setCredForm] = useState<CredentialFormState>({
    legalFirstName: "",
    legalLastName: "",
    companyName: "",
    licenseNumber: "",
    licenseState: "",
    licenseExpiresAt: "",
    licenseDocumentUrl: "",
  });
  const [credFormOriginal, setCredFormOriginal] = useState<CredentialFormState | null>(null);

  const { data: meData } = useQuery<{ id: string } & Record<string, any>>({
    queryKey: ["/api/auth/me"],
  });

  const { data, isLoading } = useQuery<{ registration: Registration | null }>({
    queryKey: ["/api/broker-registration/me"],
    queryFn: async () => {
      const res = await fetch("/api/broker-registration/me", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  useEffect(() => {
    const r = data?.registration;
    if (r && (r.status === "pending" || r.status === "rejected")) {
      setForm({
        legalFirstName: r.legalFirstName || "",
        legalLastName: r.legalLastName || "",
        legalName: r.legalName || "",
        companyName: r.companyName || "",
        email: r.email || "",
        phone: r.phone || "",
        licenseNumber: r.licenseNumber || "",
        licenseState: r.licenseState || "",
        licenseExpiresAt: r.licenseExpiresAt ? r.licenseExpiresAt.slice(0, 10) : "",
        licenseDocumentUrl: r.licenseDocumentUrl || "",
        yearsExperience: r.yearsExperience != null ? String(r.yearsExperience) : "",
        specialties: Array.isArray(r.specialties) ? r.specialties.join(", ") : "",
        bio: r.bio || "",
        website: r.website || "",
        linkedinUrl: r.linkedinUrl || "",
      });
    }
  }, [data?.registration?.id]);

  const submitMut = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/broker-registration", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Registration submitted", description: "Pending admin review." });
      qc.invalidateQueries({ queryKey: ["/api/broker-registration/me"] });
    },
    onError: (e: any) => {
      toast({ title: "Submit failed", description: e?.message || "", variant: "destructive" });
    },
  });

  const updateCredMut = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("PATCH", "/api/broker-registration/me", payload);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `Error ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Credentials updated", description: "Your license information has been saved." });
      setEditingCredentials(false);
      qc.invalidateQueries({ queryKey: ["/api/broker-registration/me"] });
    },
    onError: (e: any) => {
      toast({ title: "Update failed", description: e?.message || "", variant: "destructive" });
    },
  });

  const update = (key: keyof FormState) => (e: any) =>
    setForm((prev) => ({ ...prev, [key]: e?.target?.value ?? e }));

  const updateCred = (key: keyof CredentialFormState) => (e: any) =>
    setCredForm((prev) => ({ ...prev, [key]: e?.target?.value ?? e }));

  const payloadFromForm = () => ({
    legalFirstName: form.legalFirstName.trim() || undefined,
    legalLastName: form.legalLastName.trim() || undefined,
    legalName: form.legalName.trim(),
    companyName: form.companyName.trim(),
    email: form.email.trim(),
    phone: form.phone.trim() || null,
    licenseNumber: form.licenseNumber.trim() || null,
    licenseState: form.licenseState.trim().toUpperCase() || null,
    licenseExpiresAt: form.licenseExpiresAt || null,
    licenseDocumentUrl: form.licenseDocumentUrl.trim() || null,
    yearsExperience: form.yearsExperience ? parseInt(form.yearsExperience, 10) : null,
    specialties: form.specialties
      ? form.specialties.split(",").map((s) => s.trim()).filter(Boolean)
      : null,
    bio: form.bio.trim() || null,
    website: form.website.trim() || null,
    linkedinUrl: form.linkedinUrl.trim() || null,
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nameValue = form.legalName.trim() || `${form.legalFirstName.trim()} ${form.legalLastName.trim()}`.trim();
    if (!nameValue || !form.companyName || !form.email) {
      toast({ title: "Missing required fields", variant: "destructive" });
      return;
    }
    submitMut.mutate(payloadFromForm());
  };

  const onCredSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!credForm.companyName.trim()) {
      toast({ title: "Company name is required", variant: "destructive" });
      return;
    }

    // Only include fields that changed relative to when the form was opened
    const orig = credFormOriginal;
    const payload: Record<string, any> = {};

    const addIfChanged = (key: keyof CredentialFormState, value: string | null) => {
      const originalVal = orig ? orig[key] : undefined;
      if (value !== originalVal) payload[key] = value;
    };

    addIfChanged("legalFirstName", credForm.legalFirstName.trim() || null);
    addIfChanged("legalLastName", credForm.legalLastName.trim() || null);
    addIfChanged("companyName", credForm.companyName.trim());
    addIfChanged("licenseNumber", credForm.licenseNumber.trim() || null);
    addIfChanged("licenseState", credForm.licenseState.trim().toUpperCase() || null);
    addIfChanged("licenseExpiresAt", credForm.licenseExpiresAt || null);
    addIfChanged("licenseDocumentUrl", credForm.licenseDocumentUrl.trim() || null);

    if (Object.keys(payload).length === 0) {
      toast({ title: "No changes to save" });
      setEditingCredentials(false);
      return;
    }

    updateCredMut.mutate(payload);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const reg = data?.registration;

  // Approved or suspended: show status card with optional inline credential editor
  if (reg && (reg.status === "approved" || reg.status === "suspended")) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Broker Registration Status</CardTitle>
                <CardDescription>
                  Submitted {new Date(reg.submittedAt).toLocaleDateString()}
                </CardDescription>
              </div>
              {!editingCredentials && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const initial = credentialFormFromReg(reg);
                    setCredForm(initial);
                    setCredFormOriginal(initial);
                    setEditingCredentials(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Update Credentials
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              <Badge
                variant={
                  reg.status === "approved"
                    ? "default"
                    : "destructive"
                }
              >
                {reg.status}
              </Badge>
            </div>
            {reg.status === "approved" && !editingCredentials && (
              <p className="text-sm text-muted-foreground">
                Your registration is approved. Subscribe to a broker plan to start publishing listings.
              </p>
            )}
            {reg.status === "suspended" && reg.rejectionReason && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Reason</div>
                <div className="text-sm border rounded p-2 bg-destructive/10">
                  {reg.rejectionReason}
                </div>
              </div>
            )}

            {meData?.id && !editingCredentials && (
              <div className="mt-2">
                <BrokerCredentialBadge userId={meData.id} />
              </div>
            )}

            {editingCredentials ? (
              <form onSubmit={onCredSubmit} className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold">Update License Credentials</h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingCredentials(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>First Name</Label>
                    <Input
                      value={credForm.legalFirstName}
                      onChange={updateCred("legalFirstName")}
                      placeholder="First name"
                    />
                  </div>
                  <div>
                    <Label>Last Name</Label>
                    <Input
                      value={credForm.legalLastName}
                      onChange={updateCred("legalLastName")}
                      placeholder="Last name"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Company Name</Label>
                    <Input
                      value={credForm.companyName}
                      onChange={updateCred("companyName")}
                      required
                    />
                  </div>
                  <div>
                    <Label>License Number</Label>
                    <Input
                      value={credForm.licenseNumber}
                      onChange={updateCred("licenseNumber")}
                    />
                  </div>
                  <div>
                    <Label>License State (2-letter)</Label>
                    <Input
                      maxLength={2}
                      value={credForm.licenseState}
                      onChange={updateCred("licenseState")}
                    />
                  </div>
                  <div>
                    <Label>License Expires</Label>
                    <Input
                      type="date"
                      value={credForm.licenseExpiresAt}
                      onChange={updateCred("licenseExpiresAt")}
                    />
                  </div>
                  <div>
                    <Label>License Document URL</Label>
                    <Input
                      value={credForm.licenseDocumentUrl}
                      onChange={updateCred("licenseDocumentUrl")}
                      placeholder="https://..."
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingCredentials(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateCredMut.isPending}>
                    {updateCredMut.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="border-t pt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Legal Name</div>
                  <div className="font-medium">{reg.legalName || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Company</div>
                  <div className="font-medium">{reg.companyName || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Email</div>
                  <div className="font-medium">{reg.email || "—"}</div>
                </div>
                {reg.phone && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Phone</div>
                    <div className="font-medium">{reg.phone}</div>
                  </div>
                )}
                {reg.licenseNumber && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">License Number</div>
                    <div className="font-medium">{reg.licenseNumber}</div>
                  </div>
                )}
                {reg.licenseState && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">License State</div>
                    <div className="font-medium">{reg.licenseState}</div>
                  </div>
                )}
                {reg.licenseExpiresAt && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">License Expires</div>
                    <div className="font-medium">{new Date(reg.licenseExpiresAt).toLocaleDateString()}</div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pending: show read-only status card (no editing mid-review)
  if (reg && reg.status === "pending") {
    const isRereview = !!reg.reviewedAt;
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Broker Registration Status</CardTitle>
            <CardDescription>
              Submitted {new Date(reg.submittedAt).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              <Badge variant="secondary">pending</Badge>
            </div>
            {isRereview ? (
              <div className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950/30 p-3 text-sm">
                <svg className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <div>
                  <div className="font-medium text-yellow-800 dark:text-yellow-300">Your credentials are under re-review.</div>
                  <div className="text-yellow-700 dark:text-yellow-400 mt-0.5">
                    An admin has flagged your updated license information for re-verification. Your profile is temporarily unpublished until the review is complete.
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Your registration is under review. You will be notified when an admin reviews it.
              </p>
            )}

            {meData?.id && (
              <div className="mt-2">
                <BrokerCredentialBadge userId={meData.id} />
              </div>
            )}

            <div className="border-t pt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Legal Name</div>
                <div className="font-medium">{reg.legalName || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Company</div>
                <div className="font-medium">{reg.companyName || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Email</div>
                <div className="font-medium">{reg.email || "—"}</div>
              </div>
              {reg.phone && (
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Phone</div>
                  <div className="font-medium">{reg.phone}</div>
                </div>
              )}
              {reg.licenseNumber && (
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">License Number</div>
                  <div className="font-medium">{reg.licenseNumber}</div>
                </div>
              )}
              {reg.licenseState && (
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">License State</div>
                  <div className="font-medium">{reg.licenseState}</div>
                </div>
              )}
              {reg.licenseExpiresAt && (
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">License Expires</div>
                  <div className="font-medium">{new Date(reg.licenseExpiresAt).toLocaleDateString()}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Rejected or no registration → show submission form
  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Register as a Broker</CardTitle>
          <CardDescription>
            Submit your credentials for admin review. Once approved you can subscribe to a broker
            plan and publish listings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reg?.status === "rejected" && reg.rejectionReason && (
            <div className="mb-4 text-sm border rounded p-3 bg-destructive/10">
              <div className="font-semibold mb-1">Prior submission was rejected</div>
              <div>{reg.rejectionReason}</div>
            </div>
          )}
          <form onSubmit={onSubmit} className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Personal</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>First Name</Label>
                  <Input value={form.legalFirstName} onChange={update("legalFirstName")} />
                </div>
                <div>
                  <Label>Last Name</Label>
                  <Input value={form.legalLastName} onChange={update("legalLastName")} />
                </div>
                <div>
                  <Label>Legal Name *</Label>
                  <Input value={form.legalName} onChange={update("legalName")} required />
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={update("email")}
                    required
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={update("phone")} />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Company</h3>
              <div>
                <Label>Company Name *</Label>
                <Input value={form.companyName} onChange={update("companyName")} required />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">License</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>License Number</Label>
                  <Input value={form.licenseNumber} onChange={update("licenseNumber")} />
                </div>
                <div>
                  <Label>License State (2-letter)</Label>
                  <Input
                    maxLength={2}
                    value={form.licenseState}
                    onChange={update("licenseState")}
                  />
                </div>
                <div>
                  <Label>Expires</Label>
                  <Input
                    type="date"
                    value={form.licenseExpiresAt}
                    onChange={update("licenseExpiresAt")}
                  />
                </div>
                <div>
                  <Label>License Document URL</Label>
                  <Input
                    value={form.licenseDocumentUrl}
                    onChange={update("licenseDocumentUrl")}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Experience</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Years Experience</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.yearsExperience}
                    onChange={update("yearsExperience")}
                  />
                </div>
                <div>
                  <Label>Specialties (comma-separated)</Label>
                  <Input
                    value={form.specialties}
                    onChange={update("specialties")}
                    placeholder="Retail, Office, Industrial"
                  />
                </div>
              </div>
              <div>
                <Label>Bio</Label>
                <Textarea value={form.bio} onChange={update("bio")} rows={4} />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Links</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Website</Label>
                  <Input value={form.website} onChange={update("website")} />
                </div>
                <div>
                  <Label>LinkedIn URL</Label>
                  <Input value={form.linkedinUrl} onChange={update("linkedinUrl")} />
                </div>
              </div>
            </section>

            <div className="flex justify-end">
              <Button type="submit" disabled={submitMut.isPending}>
                {submitMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Submit for Review"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

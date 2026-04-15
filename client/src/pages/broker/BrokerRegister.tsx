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
import { Loader2 } from "lucide-react";

interface Registration {
  id: string;
  status: string;
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
}

interface FormState {
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

const EMPTY_FORM: FormState = {
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

export default function BrokerRegister() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

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
    if (r && r.status === "pending") {
      setForm({
        legalName: r.legalName || "",
        companyName: r.companyName || "",
        email: r.email || "",
        phone: r.phone || "",
        licenseNumber: r.licenseNumber || "",
        licenseState: r.licenseState || "",
        licenseExpiresAt: r.licenseExpiresAt || "",
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

  const update = (key: keyof FormState) => (e: any) =>
    setForm((prev) => ({ ...prev, [key]: e?.target?.value ?? e }));

  const payloadFromForm = () => ({
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
    if (!form.legalName || !form.companyName || !form.email) {
      toast({ title: "Missing required fields", variant: "destructive" });
      return;
    }
    submitMut.mutate(payloadFromForm());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const reg = data?.registration;

  // If an existing non-rejected registration is on file, show status card
  if (reg && (reg.status === "pending" || reg.status === "approved" || reg.status === "suspended")) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Broker Registration Status</CardTitle>
            <CardDescription>
              Submitted {new Date(reg.submittedAt).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              <Badge
                variant={
                  reg.status === "approved"
                    ? "default"
                    : reg.status === "suspended"
                    ? "destructive"
                    : "secondary"
                }
              >
                {reg.status}
              </Badge>
            </div>
            {reg.status === "pending" && (
              <p className="text-sm text-muted-foreground">
                Your registration is under review. You will be notified when an admin reviews it.
              </p>
            )}
            {reg.status === "approved" && (
              <p className="text-sm text-muted-foreground">
                Your registration is approved. Subscribe to a broker plan to start publishing
                listings.
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
          </CardContent>
        </Card>
      </div>
    );
  }

  // Rejected → show reason and allow resubmit
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

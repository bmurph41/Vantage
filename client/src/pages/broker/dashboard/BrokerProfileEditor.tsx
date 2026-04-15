import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import BrokerDashboardLayout from "./BrokerDashboardLayout";
import {
  useMyBrokerProfile,
  useUpdateMyProfile,
  usePublishMyProfile,
  useUnpublishMyProfile,
} from "@/hooks/use-broker-dashboard";
import BrokerCriteriaEditor from "@/components/broker/BrokerCriteriaEditor";
import type { BrokerCriteria } from "@shared/broker/criteria";

export default function BrokerProfileEditor() {
  const { toast } = useToast();
  const { data } = useMyBrokerProfile();
  const updateMut = useUpdateMyProfile();
  const publishMut = usePublishMyProfile();
  const unpublishMut = useUnpublishMyProfile();

  const [form, setForm] = useState({
    displayName: "",
    companyName: "",
    headshotUrl: "",
    coverImageUrl: "",
    bio: "",
    contactEmail: "",
    contactPhone: "",
    website: "",
    linkedinUrl: "",
  });
  const [criteria, setCriteria] = useState<BrokerCriteria | null>(null);

  useEffect(() => {
    if (data?.profile) {
      setForm({
        displayName: data.profile.displayName || "",
        companyName: data.profile.companyName || "",
        headshotUrl: data.profile.headshotUrl || "",
        coverImageUrl: data.profile.coverImageUrl || "",
        bio: data.profile.bio || "",
        contactEmail: data.profile.contactEmail || "",
        contactPhone: data.profile.contactPhone || "",
        website: data.profile.website || "",
        linkedinUrl: data.profile.linkedinUrl || "",
      });
      setCriteria((data.profile as any).criteria || null);
    }
  }, [data?.profile?.id]);

  const handleSave = async () => {
    try {
      await updateMut.mutateAsync({ ...form, criteria: criteria || undefined } as any);
      toast({ title: "Profile saved" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "", variant: "destructive" });
    }
  };

  const handlePublishToggle = async () => {
    try {
      if (data?.profile.isPublishable) {
        await unpublishMut.mutateAsync();
        toast({ title: "Profile unpublished" });
      } else {
        const res = await publishMut.mutateAsync();
        toast({
          title: "Profile published",
          description: `Auto-claimed ${res?.backfill?.claimed || 0} matching listings.`,
        });
      }
    } catch (e: any) {
      toast({ title: "Action failed", description: e?.message || "", variant: "destructive" });
    }
  };

  const setField = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <BrokerDashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Profile</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePublishToggle}>
              {publishMut.isPending || unpublishMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : data?.profile.isPublishable ? (
                "Unpublish"
              ) : (
                "Publish"
              )}
            </Button>
            <Button onClick={handleSave} disabled={updateMut.isPending}>
              {updateMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Display Name</Label>
              <Input value={form.displayName} onChange={setField("displayName")} />
            </div>
            <div>
              <Label>Company Name</Label>
              <Input value={form.companyName} onChange={setField("companyName")} />
            </div>
            <div>
              <Label>Headshot URL</Label>
              <Input
                value={form.headshotUrl}
                onChange={setField("headshotUrl")}
                placeholder="https://..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Direct file upload coming soon. Paste a public image URL for now.
              </p>
            </div>
            <div>
              <Label>Cover Image URL</Label>
              <Input value={form.coverImageUrl} onChange={setField("coverImageUrl")} />
            </div>
            <div>
              <Label>Bio</Label>
              <Textarea rows={6} value={form.bio} onChange={setField("bio")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Contact Email</Label>
              <Input value={form.contactEmail} onChange={setField("contactEmail")} />
            </div>
            <div>
              <Label>Contact Phone</Label>
              <Input value={form.contactPhone} onChange={setField("contactPhone")} />
            </div>
            <div>
              <Label>Website</Label>
              <Input value={form.website} onChange={setField("website")} />
            </div>
            <div>
              <Label>LinkedIn URL</Label>
              <Input value={form.linkedinUrl} onChange={setField("linkedinUrl")} />
            </div>
          </CardContent>
        </Card>

        <BrokerCriteriaEditor value={criteria} onChange={setCriteria} />
      </div>
    </BrokerDashboardLayout>
  );
}

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Users, Palette, Shield, UserPlus, Pencil, Trash2, Layers, Save } from "lucide-react";
import { AssetClassPicker, ASSET_CLASS_LIST } from "@/components/AssetClassPicker";

export default function OrganizationSettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", name: "", role: "editor" });
  const [editingOrg, setEditingOrg] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [localAssetClasses, setLocalAssetClasses] = useState<string[]>([]);
  const [assetClassesDirty, setAssetClassesDirty] = useState(false);

  const { data: org, isLoading } = useQuery<any>({
    queryKey: ["/api/org-settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/org-settings");
      return res.json();
    },
  });

  useEffect(() => {
    if (org?.assetClasses) {
      setLocalAssetClasses(org.assetClasses);
    }
  }, [org?.assetClasses]);

  const { data: team = [] } = useQuery<any[]>({
    queryKey: ["/api/org-settings/team"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/org-settings/team");
      return res.json();
    },
  });

  const updateOrg = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", "/api/org-settings", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/org-settings"] });
      setEditingOrg(false);
      setAssetClassesDirty(false);
      toast({ title: "Organization updated" });
    },
    onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const inviteMember = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/org-settings/team/invite", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/org-settings/team"] });
      setShowInvite(false);
      setInviteForm({ email: "", name: "", role: "editor" });
      toast({ title: "Invite sent" });
    },
  });

  const updateMember = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await apiRequest("PATCH", `/api/org-settings/team/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/org-settings/team"] });
      toast({ title: "Member updated" });
    },
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/org-settings/team/${id}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/org-settings/team"] });
      toast({ title: "Member removed" });
    },
  });

  if (isLoading) return <div className="p-6 space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;

  const handleAssetClassChange = (keys: string[]) => {
    setLocalAssetClasses(keys);
    setAssetClassesDirty(true);
  };

  const saveAssetClasses = () => {
    updateOrg.mutate({ assetClasses: localAssetClasses });
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Organization Settings</h1>
        <p className="text-muted-foreground">Manage your organization profile, team, and branding</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="profile"><Building2 className="h-4 w-4 mr-1" />Profile</TabsTrigger>
          <TabsTrigger value="asset-focus"><Layers className="h-4 w-4 mr-1" />Asset Focus</TabsTrigger>
          <TabsTrigger value="team"><Users className="h-4 w-4 mr-1" />Team ({team.length})</TabsTrigger>
          <TabsTrigger value="branding"><Palette className="h-4 w-4 mr-1" />Branding</TabsTrigger>
          <TabsTrigger value="security"><Shield className="h-4 w-4 mr-1" />Security</TabsTrigger>
        </TabsList>

        {/* Profile */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Organization Profile</CardTitle>
                <Button variant="outline" size="sm" onClick={() => { setEditingOrg(true); setOrgName(org?.name || ""); }}>
                  <Pencil className="h-4 w-4 mr-1" />Edit
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div><Label className="text-muted-foreground">Name</Label><p className="font-medium">{org?.name || "—"}</p></div>
              <div><Label className="text-muted-foreground">Members</Label><p>{org?.memberCount || 0}</p></div>
              <div>
                <Label className="text-muted-foreground">Asset Focus</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(org?.assetClasses || []).length === 0
                    ? <span className="text-sm text-muted-foreground">Not configured — visit the Asset Focus tab</span>
                    : (org?.assetClasses || []).map((key: string) => {
                        const entry = ASSET_CLASS_LIST.find((a) => a.key === key);
                        return (
                          <Badge key={key} variant="secondary" style={{ borderLeft: `3px solid ${entry?.color || "#94a3b8"}` }}>
                            {entry?.icon} {entry?.label || key}
                          </Badge>
                        );
                      })}
                </div>
              </div>
              <div><Label className="text-muted-foreground">Active Packs</Label>
                <div className="flex gap-1 mt-1">{(org?.activePacks || []).map((p: any) => <Badge key={p.packType} variant="secondary">{p.packType}</Badge>)}</div>
              </div>
              <div><Label className="text-muted-foreground">SSO</Label><Badge variant={org?.ssoEnabled ? "default" : "outline"}>{org?.ssoEnabled ? "Enabled" : "Disabled"}</Badge></div>
              <div><Label className="text-muted-foreground">MFA Required</Label><Badge variant={org?.mfaRequired ? "default" : "outline"}>{org?.mfaRequired ? "Yes" : "No"}</Badge></div>
            </CardContent>
          </Card>
          {editingOrg && (
            <Dialog open onOpenChange={() => setEditingOrg(false)}>
              <DialogContent>
                <DialogHeader><DialogTitle>Edit Organization</DialogTitle></DialogHeader>
                <div><Label>Name</Label><Input value={orgName} onChange={(e) => setOrgName(e.target.value)} /></div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditingOrg(false)}>Cancel</Button>
                  <Button onClick={() => updateOrg.mutate({ name: orgName })} disabled={updateOrg.isPending}>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>

        {/* Asset Focus */}
        <TabsContent value="asset-focus">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5" />Asset Class Focus</CardTitle>
                  <CardDescription className="mt-1">
                    Select the asset classes your organization focuses on. This tailors your platform experience,
                    data views, benchmarks, and default settings to your investment strategy.
                  </CardDescription>
                </div>
                {assetClassesDirty && (
                  <Button onClick={saveAssetClasses} disabled={updateOrg.isPending} size="sm">
                    <Save className="h-4 w-4 mr-1" />
                    {updateOrg.isPending ? "Saving…" : "Save Changes"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {localAssetClasses.length === 0 && (
                <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                  No asset classes selected. Choose the types of assets your organization invests in below.
                </div>
              )}
              <AssetClassPicker
                selected={localAssetClasses}
                onChange={handleAssetClassChange}
              />
              <div className="flex items-center justify-between pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  {localAssetClasses.length} asset {localAssetClasses.length === 1 ? "class" : "classes"} selected
                </p>
                <div className="flex gap-2">
                  {assetClassesDirty && (
                    <Button variant="outline" size="sm" onClick={() => {
                      setLocalAssetClasses(org?.assetClasses || []);
                      setAssetClassesDirty(false);
                    }}>
                      Discard
                    </Button>
                  )}
                  <Button
                    onClick={saveAssetClasses}
                    disabled={updateOrg.isPending || !assetClassesDirty}
                    size="sm"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    {updateOrg.isPending ? "Saving…" : "Save Changes"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team */}
        <TabsContent value="team">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Team Members</CardTitle>
                <Button size="sm" onClick={() => setShowInvite(true)}><UserPlus className="h-4 w-4 mr-1" />Invite</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {team.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell>{m.email}</TableCell>
                      <TableCell>
                        <Select defaultValue={m.role} onValueChange={(v) => updateMember.mutate({ id: m.id, role: v })}>
                          <SelectTrigger className="w-24 h-7"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="owner">Owner</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant={m.isActive ? "default" : "destructive"}>{m.isActive ? "Active" : "Disabled"}</Badge>
                        {m.mfaEnabled && <Badge variant="outline" className="ml-1 text-[10px]">MFA</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleDateString() : "Never"}</TableCell>
                      <TableCell>
                        {m.role !== "owner" && (
                          <Button size="sm" variant="ghost" onClick={() => removeMember.mutate(m.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
          <Dialog open={showInvite} onOpenChange={setShowInvite}>
            <DialogContent>
              <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Email</Label><Input value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} placeholder="team@example.com" /></div>
                <div><Label>Name</Label><Input value={inviteForm.name} onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })} placeholder="Jane Smith" /></div>
                <div><Label>Role</Label>
                  <Select value={inviteForm.role} onValueChange={(v) => setInviteForm({ ...inviteForm, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
                <Button onClick={() => inviteMember.mutate(inviteForm)} disabled={!inviteForm.email}>Send Invite</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Branding */}
        <TabsContent value="branding">
          <Card>
            <CardHeader><CardTitle>Branding</CardTitle><CardDescription>Customize your organization's appearance</CardDescription></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label>Firm Name</Label><p className="font-medium">{org?.branding?.firmName || org?.name || "—"}</p></div>
                <div><Label>Primary Color</Label><div className="flex items-center gap-2"><div className="w-6 h-6 rounded" style={{ backgroundColor: org?.branding?.primaryColor || "#2563eb" }} /><span>{org?.branding?.primaryColor || "#2563eb"}</span></div></div>
                <div><Label>Support Email</Label><p>{org?.branding?.supportEmail || "—"}</p></div>
                <div><Label>Custom Domain</Label><p>{org?.branding?.customDomain || "—"}</p></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security">
          <Card>
            <CardHeader><CardTitle>Security Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between"><div><p className="font-medium">Require MFA</p><p className="text-sm text-muted-foreground">All members must enable multi-factor authentication</p></div><Button variant="outline" size="sm" onClick={() => updateOrg.mutate({ mfaRequired: !org?.mfaRequired })}>{org?.mfaRequired ? "Disable" : "Enable"}</Button></div>
              <div className="flex items-center justify-between"><div><p className="font-medium">Session Timeout</p><p className="text-sm text-muted-foreground">Auto-logout after inactivity ({org?.sessionTimeoutMinutes || 480} min)</p></div><Badge variant="outline">{org?.sessionTimeoutMinutes || 480} min</Badge></div>
              <div className="flex items-center justify-between"><div><p className="font-medium">SSO</p><p className="text-sm text-muted-foreground">Single sign-on via SAML/OIDC</p></div><Badge variant={org?.ssoEnabled ? "default" : "outline"}>{org?.ssoEnabled ? "Configured" : "Not configured"}</Badge></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

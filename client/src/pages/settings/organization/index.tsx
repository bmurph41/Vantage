import { useState } from "react";
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
import { Building2, Users, Palette, Shield, UserPlus, Pencil, Trash2, ArrowRightLeft } from "lucide-react";

export default function OrganizationSettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", name: "", role: "editor" });
  const [editingOrg, setEditingOrg] = useState(false);
  const [orgName, setOrgName] = useState("");

  const { data: org, isLoading } = useQuery<any>({
    queryKey: ["/api/org-settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/org-settings");
      return res.json();
    },
  });

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
      toast({ title: "Organization updated" });
    },
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

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Organization Settings</h1>
        <p className="text-muted-foreground">Manage your organization profile, team, and branding</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile"><Building2 className="h-4 w-4 mr-1" />Profile</TabsTrigger>
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
                  <Button onClick={() => updateOrg.mutate({ name: orgName })}>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
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
              <div className="grid grid-cols-2 gap-4">
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

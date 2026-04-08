import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, Plus, FileWarning, CheckCircle, XCircle, DollarSign } from "lucide-react";

interface Props { workspaceId: string; dealId?: string; }

export default function DdFindingsPanel({ workspaceId, dealId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", category: "financial", severity: "minor",
    estimatedFinancialImpact: "", impactType: "", recommendation: "", recommendedAction: "", source: "",
  });

  const { data: findings = [] } = useQuery<any[]>({
    queryKey: ["/api/dd-enhanced/findings", workspaceId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/dd-enhanced/findings?workspaceId=${workspaceId}`);
      return res.json();
    },
  });

  const { data: summary } = useQuery<any>({
    queryKey: ["/api/dd-enhanced/findings/summary", workspaceId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/dd-enhanced/findings/summary/${workspaceId}`);
      return res.json();
    },
  });

  const createFinding = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/dd-enhanced/findings", { ...data, workspaceId, dealId });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/dd-enhanced/findings"] });
      setShowAdd(false);
      setForm({ title: "", description: "", category: "financial", severity: "minor", estimatedFinancialImpact: "", impactType: "", recommendation: "", recommendedAction: "", source: "" });
      toast({ title: "Finding recorded" });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/dd-enhanced/findings/${id}`, { status });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/dd-enhanced/findings"] }),
  });

  const stats = summary?.stats || {};
  const riskScore = summary?.riskScore || { score: 0, label: "No Data", color: "gray" };

  const severityColor = (s: string) => {
    switch (s) {
      case "critical": return "destructive";
      case "major": return "default";
      case "minor": return "secondary";
      case "observation": return "outline";
      case "positive": return "default";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <FileWarning className="h-5 w-5" />DD Findings
        </h3>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" />Add Finding</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-2">
        <div className="text-center p-2 bg-red-50 rounded"><p className="text-lg font-bold text-red-600">{stats.critical || 0}</p><p className="text-[10px] text-muted-foreground">Critical</p></div>
        <div className="text-center p-2 bg-orange-50 rounded"><p className="text-lg font-bold text-orange-600">{stats.major || 0}</p><p className="text-[10px] text-muted-foreground">Major</p></div>
        <div className="text-center p-2 bg-yellow-50 rounded"><p className="text-lg font-bold text-yellow-600">{stats.minor || 0}</p><p className="text-[10px] text-muted-foreground">Minor</p></div>
        <div className="text-center p-2 bg-gray-50 rounded"><p className="text-lg font-bold">{stats.open || 0}</p><p className="text-[10px] text-muted-foreground">Open</p></div>
        <div className={`text-center p-2 rounded`} style={{ backgroundColor: riskScore.color === "red" ? "#fef2f2" : riskScore.color === "orange" ? "#fff7ed" : riskScore.color === "green" ? "#f0fdf4" : "#f9fafb" }}>
          <p className="text-lg font-bold">{riskScore.score}</p>
          <p className="text-[10px] text-muted-foreground">{riskScore.label}</p>
        </div>
      </div>

      {stats.totalFinancialImpact && parseFloat(stats.totalFinancialImpact) > 0 && (
        <div className="flex items-center gap-2 p-2 bg-amber-50 rounded text-sm">
          <DollarSign className="h-4 w-4 text-amber-600" />
          <span>Total financial exposure: <strong>${Number(stats.totalFinancialImpact).toLocaleString()}</strong></span>
          {stats.unresolvedImpact && parseFloat(stats.unresolvedImpact) > 0 && (
            <span className="text-muted-foreground">(${Number(stats.unresolvedImpact).toLocaleString()} unresolved)</span>
          )}
        </div>
      )}

      {/* Findings list */}
      <div className="space-y-2">
        {findings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No findings yet. Record findings as you review due diligence items.</p>
        ) : (
          findings.map((f: any) => (
            <div key={f.id} className="flex items-start gap-3 p-3 border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={severityColor(f.severity) as any}>{f.severity}</Badge>
                  <Badge variant="outline">{f.category}</Badge>
                  <Badge variant={f.status === "open" ? "outline" : "secondary"}>{f.status}</Badge>
                </div>
                <p className="font-medium text-sm">{f.title}</p>
                {f.description && <p className="text-xs text-muted-foreground mt-1">{f.description}</p>}
                {f.recommendation && <p className="text-xs mt-1"><span className="font-medium">Recommendation:</span> {f.recommendation}</p>}
                {f.estimatedFinancialImpact && (
                  <p className="text-xs text-amber-600 mt-1">Impact: ${Number(f.estimatedFinancialImpact).toLocaleString()} ({f.impactType})</p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {f.status === "open" && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate({ id: f.id, status: "resolved" })}>
                      <CheckCircle className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate({ id: f.id, status: "escalated" })}>
                      <AlertTriangle className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Finding Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record DD Finding</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Environmental Phase I flagged RECs" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["title","survey","esa","appraisal","inspection","permits","zoning","financial","legal","insurance","operational","other"].map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Severity</Label>
                <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="major">Major</SelectItem>
                    <SelectItem value="minor">Minor</SelectItem>
                    <SelectItem value="observation">Observation</SelectItem>
                    <SelectItem value="positive">Positive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Financial Impact ($)</Label><Input type="number" value={form.estimatedFinancialImpact} onChange={(e) => setForm({ ...form, estimatedFinancialImpact: e.target.value })} placeholder="0" /></div>
              <div>
                <Label>Recommended Action</Label>
                <Select value={form.recommendedAction} onValueChange={(v) => setForm({ ...form, recommendedAction: v })}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="proceed">Proceed</SelectItem>
                    <SelectItem value="renegotiate">Renegotiate</SelectItem>
                    <SelectItem value="further_investigation">Further Investigation</SelectItem>
                    <SelectItem value="accept_risk">Accept Risk</SelectItem>
                    <SelectItem value="remediate">Remediate</SelectItem>
                    <SelectItem value="walk_away">Walk Away</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Recommendation</Label><Textarea value={form.recommendation} onChange={(e) => setForm({ ...form, recommendation: e.target.value })} rows={2} placeholder="Suggest remediation or negotiation approach..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={() => createFinding.mutate(form)} disabled={!form.title || createFinding.isPending}>Save Finding</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

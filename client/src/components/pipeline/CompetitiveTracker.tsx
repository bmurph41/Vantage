import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Swords, Plus, Pencil, Trash2, Loader2, Users, TrendingDown, TrendingUp, DollarSign,
} from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

interface CompetitiveTrackerProps {
  dealId: string;
  ourBid?: number;
}

interface Competitor {
  id: string;
  competitorName: string;
  estimatedBid: string | null;
  strengths: string | null;
  weaknesses: string | null;
  intelSource: string | null;
  notes: string | null;
  updatedAt: string;
}

interface CompetitiveData {
  competitors: Competitor[];
  summary: {
    count: number;
    avgBid: number;
    maxBid: number;
    minBid: number;
  };
}

export default function CompetitiveTracker({ dealId, ourBid }: CompetitiveTrackerProps) {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Competitor | null>(null);
  const [form, setForm] = useState({
    competitorName: "",
    estimatedBid: "",
    strengths: "",
    weaknesses: "",
    intelSource: "",
    notes: "",
  });

  const { data, isLoading } = useQuery<CompetitiveData>({
    queryKey: [`/api/pipeline/competitive/deals/${dealId}/competitors`],
  });

  const createMutation = useMutation({
    mutationFn: async (formData: any) => {
      const res = await apiRequest("POST", `/api/pipeline/competitive/deals/${dealId}/competitors`, formData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pipeline/competitive/deals/${dealId}/competitors`] });
      toast({ title: "Competitor added" });
      closeDialog();
    },
    onError: () => toast({ title: "Failed to add competitor", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...formData }: any) => {
      const res = await apiRequest("PUT", `/api/pipeline/competitive/deals/${dealId}/competitors/${id}`, formData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pipeline/competitive/deals/${dealId}/competitors`] });
      toast({ title: "Competitor updated" });
      closeDialog();
    },
    onError: () => toast({ title: "Failed to update competitor", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/pipeline/competitive/deals/${dealId}/competitors/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pipeline/competitive/deals/${dealId}/competitors`] });
      toast({ title: "Competitor removed" });
    },
    onError: () => toast({ title: "Failed to remove competitor", variant: "destructive" }),
  });

  function closeDialog() {
    setShowDialog(false);
    setEditing(null);
    setForm({ competitorName: "", estimatedBid: "", strengths: "", weaknesses: "", intelSource: "", notes: "" });
  }

  function openEdit(comp: Competitor) {
    setEditing(comp);
    setForm({
      competitorName: comp.competitorName,
      estimatedBid: comp.estimatedBid || "",
      strengths: comp.strengths || "",
      weaknesses: comp.weaknesses || "",
      intelSource: comp.intelSource || "",
      notes: comp.notes || "",
    });
    setShowDialog(true);
  }

  function handleSave() {
    if (!form.competitorName.trim()) {
      toast({ title: "Competitor name is required", variant: "destructive" });
      return;
    }
    const payload = {
      ...form,
      estimatedBid: form.estimatedBid ? Number(form.estimatedBid) : null,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const competitors = data?.competitors || [];
  const summary = data?.summary || { count: 0, avgBid: 0, maxBid: 0, minBid: 0 };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Swords className="h-4 w-4 text-red-500" />
              Competitive Tracking
            </CardTitle>
            <Button size="sm" onClick={() => { setEditing(null); setShowDialog(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Competitor
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Competitive position summary */}
          {summary.count > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <Users className="h-4 w-4 mx-auto mb-1 text-gray-500" />
                <p className="text-lg font-bold">{summary.count}</p>
                <p className="text-[10px] text-gray-500 uppercase">Competitors</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <DollarSign className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                <p className="text-sm font-bold">{summary.avgBid > 0 ? formatCurrency(summary.avgBid) : "--"}</p>
                <p className="text-[10px] text-gray-500 uppercase">Avg Bid</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <TrendingUp className="h-4 w-4 mx-auto mb-1 text-green-500" />
                <p className="text-sm font-bold">{summary.maxBid > 0 ? formatCurrency(summary.maxBid) : "--"}</p>
                <p className="text-[10px] text-gray-500 uppercase">High Bid</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <TrendingDown className="h-4 w-4 mx-auto mb-1 text-orange-500" />
                <p className="text-sm font-bold">{summary.minBid > 0 ? formatCurrency(summary.minBid) : "--"}</p>
                <p className="text-[10px] text-gray-500 uppercase">Low Bid</p>
              </div>
            </div>
          )}

          {/* Our bid vs competition */}
          {ourBid && ourBid > 0 && summary.avgBid > 0 && (
            <div className={`mb-4 p-3 rounded-lg border ${
              ourBid > summary.avgBid ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Our bid: {formatCurrency(ourBid)}
                </span>
                <Badge variant={ourBid > summary.avgBid ? "default" : "secondary"}>
                  {ourBid > summary.avgBid
                    ? `${((ourBid / summary.avgBid - 1) * 100).toFixed(0)}% above avg`
                    : `${((1 - ourBid / summary.avgBid) * 100).toFixed(0)}% below avg`
                  }
                </Badge>
              </div>
            </div>
          )}

          {competitors.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Swords className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No competitors tracked yet</p>
              <p className="text-xs text-gray-400 mt-1">Add known buyers or bidders for this deal</p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competitor</TableHead>
                  <TableHead>Est. Bid</TableHead>
                  <TableHead>Strengths</TableHead>
                  <TableHead>Weaknesses</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {competitors.map((comp) => (
                  <TableRow key={comp.id}>
                    <TableCell className="font-medium">{comp.competitorName}</TableCell>
                    <TableCell>
                      {comp.estimatedBid && Number(comp.estimatedBid) > 0
                        ? formatCurrency(Number(comp.estimatedBid))
                        : <span className="text-gray-400">--</span>
                      }
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 max-w-[200px] truncate">
                      {comp.strengths || <span className="text-gray-400">--</span>}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 max-w-[200px] truncate">
                      {comp.weaknesses || <span className="text-gray-400">--</span>}
                    </TableCell>
                    <TableCell>
                      {comp.intelSource ? (
                        <Badge variant="outline" className="text-xs">{comp.intelSource}</Badge>
                      ) : <span className="text-gray-400">--</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(comp)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(comp.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) closeDialog(); else setShowDialog(true); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Competitor" : "Add Competitor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Competitor Name *</Label>
                <Input
                  value={form.competitorName}
                  onChange={(e) => setForm({ ...form, competitorName: e.target.value })}
                  placeholder="Company or individual name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">Estimated Bid</Label>
                <Input
                  type="number"
                  value={form.estimatedBid}
                  onChange={(e) => setForm({ ...form, estimatedBid: e.target.value })}
                  placeholder="$0"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm">Strengths</Label>
              <Textarea
                value={form.strengths}
                onChange={(e) => setForm({ ...form, strengths: e.target.value })}
                placeholder="What advantages do they have?"
                className="mt-1"
                rows={2}
              />
            </div>
            <div>
              <Label className="text-sm">Weaknesses</Label>
              <Textarea
                value={form.weaknesses}
                onChange={(e) => setForm({ ...form, weaknesses: e.target.value })}
                placeholder="Where are they weak?"
                className="mt-1"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Intel Source</Label>
                <Input
                  value={form.intelSource}
                  onChange={(e) => setForm({ ...form, intelSource: e.target.value })}
                  placeholder="e.g., Broker, News, Market"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">Notes</Label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Additional notes"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              {editing ? "Update" : "Add Competitor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

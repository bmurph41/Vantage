import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Mic, Brain, Users, CheckSquare, Upload, Link2 } from "lucide-react";

export default function MeetingTranscriptionPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<any>(null);
  const [form, setForm] = useState({ title: "", platform: "upload", transcriptText: "" });

  const { data: meetings = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/meetings"],
  });

  const uploadMeeting = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/meetings", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/meetings"] });
      setShowUpload(false);
      setForm({ title: "", platform: "upload", transcriptText: "" });
      toast({ title: "Meeting uploaded" });
    },
  });

  const analyzeMeeting = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/meetings/${id}/analyze`);
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/meetings"] });
      setSelectedMeeting((prev: any) => prev ? { ...prev, ...data } : null);
      toast({ title: "Analysis complete", description: `${(data.analysis?.action_items || []).length} action items extracted` });
    },
  });

  const syncCRM = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/meetings/${id}/sync-crm`);
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/meetings"] });
      toast({ title: "CRM synced", description: `${data.tasksCreated} tasks created, ${data.activitiesLogged} activities logged` });
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meeting Transcription</h1>
          <p className="text-muted-foreground">Upload meeting transcripts, AI extracts action items, and syncs to CRM</p>
        </div>
        <Button onClick={() => setShowUpload(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Transcript
        </Button>
      </div>

      {/* Meetings list */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : meetings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Mic className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No meetings yet. Upload a transcript to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Analysis</TableHead>
                  <TableHead>Action Items</TableHead>
                  <TableHead>CRM Sync</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meetings.map((m: any) => (
                  <TableRow key={m.id} className="cursor-pointer" onClick={() => setSelectedMeeting(m)}>
                    <TableCell className="font-medium">{m.title}</TableCell>
                    <TableCell><Badge variant="outline">{m.platform}</Badge></TableCell>
                    <TableCell>{m.startTime ? new Date(m.startTime).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={m.analysisStatus === "complete" ? "default" : m.analysisStatus === "processing" ? "secondary" : "outline"}>
                        {m.analysisStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>{(m.actionItems as any[] || []).length || "—"}</TableCell>
                    <TableCell>
                      {m.tasksCreatedCount > 0 ? (
                        <Badge variant="default">{m.tasksCreatedCount} tasks</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">Not synced</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        {m.analysisStatus !== "complete" && (
                          <Button size="sm" variant="outline" onClick={() => analyzeMeeting.mutate(m.id)} disabled={analyzeMeeting.isPending}>
                            <Brain className="h-3 w-3 mr-1" />Analyze
                          </Button>
                        )}
                        {m.analysisStatus === "complete" && !m.tasksCreatedAt && (
                          <Button size="sm" variant="outline" onClick={() => syncCRM.mutate(m.id)} disabled={syncCRM.isPending}>
                            <Link2 className="h-3 w-3 mr-1" />Sync CRM
                          </Button>
                        )}
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

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Meeting Transcript</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input placeholder="Q1 Portfolio Review" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Platform</Label>
              <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="upload">Manual Upload</SelectItem>
                  <SelectItem value="zoom">Zoom</SelectItem>
                  <SelectItem value="teams">Microsoft Teams</SelectItem>
                  <SelectItem value="google_meet">Google Meet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Transcript Text</Label>
              <Textarea placeholder="Paste the meeting transcript here..." rows={10} value={form.transcriptText} onChange={(e) => setForm({ ...form, transcriptText: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button>
            <Button onClick={() => uploadMeeting.mutate(form)} disabled={!form.title || !form.transcriptText || uploadMeeting.isPending}>
              Upload & Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meeting Detail Sheet */}
      {selectedMeeting && (
        <Dialog open={!!selectedMeeting} onOpenChange={() => setSelectedMeeting(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedMeeting.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedMeeting.summary && (
                <div>
                  <h4 className="font-semibold mb-1">Summary</h4>
                  <p className="text-sm">{selectedMeeting.summary}</p>
                </div>
              )}
              {selectedMeeting.keyDecisions && (selectedMeeting.keyDecisions as string[]).length > 0 && (
                <div>
                  <h4 className="font-semibold mb-1">Key Decisions</h4>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {(selectedMeeting.keyDecisions as string[]).map((d: string, i: number) => <li key={i}>{d}</li>)}
                  </ul>
                </div>
              )}
              {selectedMeeting.actionItems && (selectedMeeting.actionItems as any[]).length > 0 && (
                <div>
                  <h4 className="font-semibold mb-1 flex items-center gap-2"><CheckSquare className="h-4 w-4" />Action Items</h4>
                  <div className="space-y-2">
                    {(selectedMeeting.actionItems as any[]).map((item: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 p-2 bg-muted rounded text-sm">
                        <CheckSquare className="h-4 w-4 mt-0.5 text-blue-600 shrink-0" />
                        <div>
                          <p>{item.task}</p>
                          <div className="flex gap-2 mt-1">
                            {item.assignee && <Badge variant="outline" className="text-xs"><Users className="h-3 w-3 mr-1" />{item.assignee}</Badge>}
                            {item.due_date && <Badge variant="secondary" className="text-xs">{item.due_date}</Badge>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedMeeting.nextSteps && (
                <div>
                  <h4 className="font-semibold mb-1">Next Steps</h4>
                  <p className="text-sm">{selectedMeeting.nextSteps}</p>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                {selectedMeeting.analysisStatus !== "complete" && (
                  <Button onClick={() => analyzeMeeting.mutate(selectedMeeting.id)} disabled={analyzeMeeting.isPending}>
                    <Brain className="h-4 w-4 mr-2" />Run AI Analysis
                  </Button>
                )}
                {selectedMeeting.analysisStatus === "complete" && !selectedMeeting.tasksCreatedAt && (
                  <Button onClick={() => syncCRM.mutate(selectedMeeting.id)} disabled={syncCRM.isPending}>
                    <Link2 className="h-4 w-4 mr-2" />Sync to CRM
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

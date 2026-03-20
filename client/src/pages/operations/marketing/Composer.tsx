import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Send, Clock, Eye, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Composer() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audienceType, setAudienceType] = useState("all");
  const [showPreview, setShowPreview] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");

  const sendNowMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/marketing/campaigns/schedule", {
        name: name || subject,
        subject,
        body,
        audienceType,
        status: "draft",
      });
      const campaign = await res.json();
      // Immediately send
      await apiRequest("POST", `/api/marketing/campaigns/${campaign.id}/send-now`);
      return campaign;
    },
    onSuccess: () => {
      toast({ title: "Campaign sent successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/campaigns/scheduled"] });
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Failed to send campaign", description: err.message, variant: "destructive" });
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
      const res = await apiRequest("POST", "/api/marketing/campaigns/schedule", {
        name: name || subject,
        subject,
        body,
        audienceType,
        scheduledAt,
        status: "scheduled",
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Campaign scheduled successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/campaigns/scheduled"] });
      setShowSchedule(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Failed to schedule campaign", description: err.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setName("");
    setSubject("");
    setBody("");
    setAudienceType("all");
    setScheduleDate("");
    setScheduleTime("");
  };

  const isFormValid = subject.trim() && body.trim();

  const audienceLabels: Record<string, string> = {
    all: "All Contacts",
    segment: "By Segment",
    list: "By List",
    manual: "Manual Selection",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Composer Form */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compose Email</CardTitle>
              <CardDescription>Create and send an email campaign to your contacts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="campaign-name">Campaign Name</Label>
                <Input
                  id="campaign-name"
                  placeholder="e.g., Spring Newsletter 2026"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject Line *</Label>
                <Input
                  id="subject"
                  placeholder="Enter email subject line"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="audience">Audience</Label>
                <Select value={audienceType} onValueChange={setAudienceType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Contacts</SelectItem>
                    <SelectItem value="segment">By Segment</SelectItem>
                    <SelectItem value="list">By List</SelectItem>
                    <SelectItem value="manual">Manual Selection</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="body">Email Body *</Label>
                <Textarea
                  id="body"
                  placeholder="Write your email content here..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => sendNowMutation.mutate()}
                  disabled={!isFormValid || sendNowMutation.isPending}
                >
                  {sendNowMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send Now
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowSchedule(true)}
                  disabled={!isFormValid}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Schedule
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowPreview(true)}
                  disabled={!subject && !body}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview Panel */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Live Preview</CardTitle>
            </CardHeader>
            <CardContent>
              {!subject && !body ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Start composing to see a preview
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-muted-foreground">To:</span>
                    <Badge variant="secondary" className="ml-2">
                      {audienceLabels[audienceType]}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Subject:</span>
                    <p className="font-medium text-sm mt-1">{subject || "(no subject)"}</p>
                  </div>
                  <hr />
                  <div className="prose prose-sm max-w-none">
                    <div className="whitespace-pre-wrap text-sm">{body || "(no content)"}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">To:</span>
              <Badge variant="secondary">{audienceLabels[audienceType]}</Badge>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Subject:</span>
              <p className="font-semibold mt-1">{subject}</p>
            </div>
            <hr />
            <div className="border rounded-lg p-6 bg-white">
              <div className="whitespace-pre-wrap">{body}</div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={showSchedule} onOpenChange={setShowSchedule}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd")}
              />
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
              />
            </div>
            {scheduleDate && scheduleTime && (
              <p className="text-sm text-muted-foreground">
                Will be sent on{" "}
                {format(new Date(`${scheduleDate}T${scheduleTime}`), "MMM d, yyyy 'at' h:mm a")}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSchedule(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => scheduleMutation.mutate()}
              disabled={!scheduleDate || !scheduleTime || scheduleMutation.isPending}
            >
              {scheduleMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Clock className="h-4 w-4 mr-2" />
              )}
              Schedule Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

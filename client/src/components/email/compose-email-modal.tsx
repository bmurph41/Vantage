import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ComposeEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTo?: string;
  defaultSubject?: string;
  dealId?: string;
  contactId?: string;
  contactName?: string;
  dealName?: string;
}

export function ComposeEmailModal({
  open,
  onOpenChange,
  defaultTo = "",
  defaultSubject = "",
  dealId,
  contactId,
  contactName,
  dealName,
}: ComposeEmailModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState("");

  // Reset form when modal opens with new defaults
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setTo(defaultTo);
      setSubject(defaultSubject);
      setBody("");
    }
    onOpenChange(isOpen);
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/workflow-email/compose-send", {
        to,
        subject,
        body,
        dealId,
        contactId,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Email sent",
          description: `Sent to ${to}`,
        });
        // Invalidate activity feeds
        queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
        if (dealId) {
          queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}`] });
        }
        onOpenChange(false);
        setTo("");
        setSubject("");
        setBody("");
      } else {
        toast({
          title: "Send failed",
          description: "Email could not be delivered. Check provider configuration.",
          variant: "destructive",
        });
      }
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Failed to send email",
        variant: "destructive",
      });
    },
  });

  const canSend = to.trim() && subject.trim() && body.trim() && !sendMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Compose Email
          </DialogTitle>
          {(dealName || contactName) && (
            <div className="flex gap-2 mt-1">
              {dealName && <Badge variant="outline" className="text-xs">{dealName}</Badge>}
              {contactName && <Badge variant="secondary" className="text-xs">{contactName}</Badge>}
            </div>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="email-to" className="text-xs font-medium text-gray-500">To</Label>
            <Input
              id="email-to"
              type="email"
              placeholder="recipient@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email-subject" className="text-xs font-medium text-gray-500">Subject</Label>
            <Input
              id="email-subject"
              placeholder="Email subject..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email-body" className="text-xs font-medium text-gray-500">Message</Label>
            <Textarea
              id="email-body"
              placeholder="Write your message..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="resize-y"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={!canSend}
            className="bg-[#1B365D] hover:bg-[#152a4a]"
          >
            {sendMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

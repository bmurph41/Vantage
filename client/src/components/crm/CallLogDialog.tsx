import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Phone, PhoneIncoming, PhoneOutgoing, Clock, Calendar } from 'lucide-react';

interface CallLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: 'contact' | 'deal';
  entityId: string;
  entityName?: string;
}

export function CallLogDialog({ open, onOpenChange, entityType, entityId, entityName }: CallLogDialogProps) {
  const { toast } = useToast();
  const [direction, setDirection] = useState<'inbound' | 'outbound'>('outbound');
  const [outcome, setOutcome] = useState<string>('connected');
  const [duration, setDuration] = useState<string>('');
  const [occurredAt, setOccurredAt] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [followUpDate, setFollowUpDate] = useState<string>('');
  const [followUpTask, setFollowUpTask] = useState<string>('');

  // Set default datetime to now when dialog opens
  useEffect(() => {
    if (open) {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      setOccurredAt(now.toISOString().slice(0, 16));
    }
  }, [open]);

  const logCallMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/crm/activities', {
        type: 'call',
        entityType,
        entityId,
        direction,
        outcome: outcome.toLowerCase().replace(' ', '_'),
        duration: duration ? parseInt(duration, 10) : 0,
        occurredAt: new Date(occurredAt).toISOString(),
        notes,
        followUpDate: followUpDate ? new Date(followUpDate).toISOString() : null,
        followUpTask: followUpTask || null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Call logged',
        description: `Call activity recorded for ${entityName || entityType}`,
      });
      // Invalidate both the activities list and the specific entity
      queryClient.invalidateQueries({ queryKey: ['/api/crm/activities'] });
      if (entityType === 'contact') {
        queryClient.invalidateQueries({ queryKey: ['/api/crm/contacts', entityId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['/api/crm/deals', entityId] });
      }
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to log call',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = () => {
    if (!occurredAt || !duration) {
      toast({
        title: 'Missing required fields',
        description: 'Please fill in Date/Time and Duration',
        variant: 'destructive',
      });
      return;
    }
    logCallMutation.mutate();
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form when closing
      setDirection('outbound');
      setOutcome('connected');
      setDuration('');
      setNotes('');
      setFollowUpDate('');
      setFollowUpTask('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Log Call
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Call Direction */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Call Direction</Label>
            <RadioGroup value={direction} onValueChange={(val) => setDirection(val as 'inbound' | 'outbound')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="inbound" id="inbound" />
                <Label htmlFor="inbound" className="flex items-center gap-2 cursor-pointer font-normal">
                  <PhoneIncoming className="h-4 w-4" />
                  Inbound
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="outbound" id="outbound" />
                <Label htmlFor="outbound" className="flex items-center gap-2 cursor-pointer font-normal">
                  <PhoneOutgoing className="h-4 w-4" />
                  Outbound
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Call Outcome */}
          <div className="space-y-2">
            <Label htmlFor="outcome">Call Outcome</Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger id="outcome">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="connected">Connected</SelectItem>
                <SelectItem value="voicemail">Voicemail</SelectItem>
                <SelectItem value="no_answer">No Answer</SelectItem>
                <SelectItem value="busy">Busy</SelectItem>
                <SelectItem value="wrong_number">Wrong Number</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="duration" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Duration (minutes)
            </Label>
            <Input
              id="duration"
              type="number"
              min="0"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="5"
            />
          </div>

          {/* Date/Time */}
          <div className="space-y-2">
            <Label htmlFor="occurredAt" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Date & Time
            </Label>
            <Input
              id="occurredAt"
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Call summary and key discussion points"
              rows={4}
            />
          </div>

          {/* Follow-up Date */}
          <div className="space-y-2">
            <Label htmlFor="followUpDate">Follow-up Date (optional)</Label>
            <Input
              id="followUpDate"
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
            />
          </div>

          {/* Follow-up Task */}
          <div className="space-y-2">
            <Label htmlFor="followUpTask">Follow-up Task (optional)</Label>
            <Input
              id="followUpTask"
              value={followUpTask}
              onChange={(e) => setFollowUpTask(e.target.value)}
              placeholder="e.g., Send proposal, Schedule next meeting"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={logCallMutation.isPending}>
            {logCallMutation.isPending ? 'Logging...' : 'Log Call'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

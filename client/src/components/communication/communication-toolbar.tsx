import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Phone, Mail, MessageSquare, Calendar, 
  FileText, Plus, ChevronDown, Clock,
  PhoneCall, Send
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { InsertActivity } from "@shared/schema";

interface CommunicationToolbarProps {
  entityType: 'contact' | 'deal' | 'property' | 'company';
  entityId: string;
  contactPhone?: string;
  contactEmail?: string;
  compact?: boolean;
}

const activitySchema = z.object({
  type: z.enum(['call', 'email', 'sms', 'meeting', 'showing', 'note', 'document']),
  subject: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  direction: z.enum(['inbound', 'outbound']).optional(),
  duration: z.number().optional(),
  outcome: z.string().optional(),
  scheduledAt: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

type ActivityFormData = z.infer<typeof activitySchema>;

export default function CommunicationToolbar({ 
  entityType, 
  entityId, 
  contactPhone,
  contactEmail,
  compact = false 
}: CommunicationToolbarProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedActivityType, setSelectedActivityType] = useState<string>('');
  const queryClient = useQueryClient();

  const form = useForm<ActivityFormData>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      description: '',
    },
  });

  const createActivityMutation = useMutation({
    mutationFn: async (data: InsertActivity) => {
      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create activity');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/${entityType}/${entityId}/activities`] 
      });
      setIsDialogOpen(false);
      form.reset();
    },
  });

  const quickActions = [
    { 
      type: 'call', 
      label: 'Call', 
      icon: Phone, 
      action: () => handleQuickCall(),
      disabled: !contactPhone,
      tooltip: contactPhone ? `Call ${contactPhone}` : 'No phone number available'
    },
    { 
      type: 'email', 
      label: 'Email', 
      icon: Mail, 
      action: () => handleQuickEmail(),
      disabled: !contactEmail,
      tooltip: contactEmail ? `Email ${contactEmail}` : 'No email address available'
    },
    { 
      type: 'sms', 
      label: 'Text', 
      icon: MessageSquare, 
      action: () => openActivityDialog('sms'),
      disabled: !contactPhone,
      tooltip: contactPhone ? `Text ${contactPhone}` : 'No phone number available'
    },
    { 
      type: 'meeting', 
      label: 'Meeting', 
      icon: Calendar, 
      action: () => openActivityDialog('meeting'),
    },
  ];

  const handleQuickCall = () => {
    if (contactPhone) {
      // In a real app, this would integrate with VoIP service
      window.open(`tel:${contactPhone}`);
      // Auto-open call logging dialog
      openActivityDialog('call', { 
        direction: 'outgoing',
        metadata: { phoneNumber: contactPhone }
      });
    }
  };

  const handleQuickEmail = () => {
    if (contactEmail) {
      // In a real app, this would open email composer
      window.open(`mailto:${contactEmail}`);
      // Auto-open email logging dialog
      openActivityDialog('email', { 
        direction: 'outgoing',
        metadata: { emailAddress: contactEmail }
      });
    }
  };

  const openActivityDialog = (type: string, defaultValues?: Partial<ActivityFormData>) => {
    setSelectedActivityType(type);
    if (defaultValues) {
      form.reset({ ...form.getValues(), ...defaultValues } as ActivityFormData);
    } else {
      form.reset({ type: type as any, description: '' });
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: ActivityFormData) => {
    createActivityMutation.mutate({
      ...data,
      entityType,
      entityId,
      userId: 'current-user-id', // Would come from auth context
    } as InsertActivity);
  };

  const getActivityTypeLabel = (type: string) => {
    switch (type) {
      case 'call': return 'Log Call';
      case 'email': return 'Log Email';
      case 'sms': return 'Log Text Message';
      case 'meeting': return 'Schedule Meeting';
      case 'showing': return 'Schedule Showing';
      case 'note': return 'Add Note';
      case 'document': return 'Share Document';
      default: return 'Log Activity';
    }
  };

  if (compact) {
    return (
      <>
        <div className="flex items-center gap-1">
          {quickActions.slice(0, 2).map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.type}
                variant="outline"
                size="sm"
                onClick={action.action}
                disabled={action.disabled}
                title={action.tooltip}
                className="flex items-center gap-1"
              >
                <Icon className="w-4 h-4" />
              </Button>
            );
          })}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4" />
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {quickActions.slice(2).map((action) => {
                const Icon = action.icon;
                return (
                  <DropdownMenuItem 
                    key={action.type} 
                    onClick={action.action}
                    disabled={action.disabled}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {action.label}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => openActivityDialog('note')}>
                <FileText className="w-4 h-4 mr-2" />
                Add Note
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <ActivityDialog 
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          activityType={selectedActivityType}
          form={form}
          onSubmit={onSubmit}
          isLoading={createActivityMutation.isPending}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.type}
              variant="outline"
              size="sm"
              onClick={action.action}
              disabled={action.disabled}
              title={action.tooltip}
              className="flex items-center gap-2"
            >
              <Icon className="w-4 h-4" />
              {action.label}
            </Button>
          );
        })}
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              More
              <ChevronDown className="w-4 h-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => openActivityDialog('showing')}>
              <Calendar className="w-4 h-4 mr-2" />
              Schedule Showing
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openActivityDialog('note')}>
              <FileText className="w-4 h-4 mr-2" />
              Add Note
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openActivityDialog('document')}>
              <FileText className="w-4 h-4 mr-2" />
              Share Document
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ActivityDialog 
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        activityType={selectedActivityType}
        form={form}
        onSubmit={onSubmit}
        isLoading={createActivityMutation.isPending}
      />
    </>
  );
}

interface ActivityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  activityType: string;
  form: any;
  onSubmit: (data: ActivityFormData) => void;
  isLoading: boolean;
}

function ActivityDialog({ 
  isOpen, 
  onClose, 
  activityType, 
  form, 
  onSubmit, 
  isLoading 
}: ActivityDialogProps) {
  const getDialogTitle = () => {
    switch (activityType) {
      case 'call': return 'Log Phone Call';
      case 'email': return 'Log Email';
      case 'sms': return 'Log Text Message';
      case 'meeting': return 'Schedule Meeting';
      case 'showing': return 'Schedule Property Showing';
      case 'note': return 'Add Note';
      case 'document': return 'Share Document';
      default: return 'Log Activity';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
          <DialogDescription>
            Record this interaction for future reference and follow-up.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {activityType === 'call' && (
            <>
              <div className="space-y-2">
                <Label>Call Direction</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={form.watch('direction') === 'outgoing' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => form.setValue('direction', 'outgoing')}
                  >
                    Outgoing
                  </Button>
                  <Button
                    type="button"
                    variant={form.watch('direction') === 'incoming' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => form.setValue('direction', 'incoming')}
                  >
                    Incoming
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  placeholder="5"
                  {...form.register('duration', { valueAsNumber: true })}
                />
              </div>
            </>
          )}

          {(activityType === 'meeting' || activityType === 'showing') && (
            <div className="space-y-2">
              <Label>Scheduled Date & Time</Label>
              <Input
                type="datetime-local"
                {...form.register('scheduledAt')}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              placeholder={`${activityType === 'call' ? 'Call about...' : 'Subject'}`}
              {...form.register('subject')}
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="What was discussed? Any follow-up needed?"
              rows={3}
              {...form.register('description')}
            />
          </div>

          {activityType === 'call' && (
            <div className="space-y-2">
              <Label>Outcome</Label>
              <div className="flex gap-2">
                {['successful', 'no_answer', 'voicemail', 'busy'].map((outcome) => (
                  <Button
                    key={outcome}
                    type="button"
                    variant={form.watch('outcome') === outcome ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => form.setValue('outcome', outcome)}
                    className="capitalize"
                  >
                    {outcome.replace('_', ' ')}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Clock className="w-4 h-4 mr-2 animate-spin" />}
              Save Activity
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

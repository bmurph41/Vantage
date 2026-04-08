import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FileText, Calendar as CalendarIcon, Phone, Mail, Upload, CheckSquare, Bell, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { FileUploader } from './file-uploader';
import { FileList } from './file-list';

interface CrmActionComposerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: {
    entityType: string;
    entityId: string;
    entityName: string;
  };
  defaultTab?: 'note' | 'activity' | 'call' | 'email' | 'reminder' | 'meeting' | 'files';
}

const activityTypes = [
  { value: 'call', label: 'Call', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'follow_up', label: 'Follow Up', icon: CheckSquare },
  { value: 'task', label: 'Task', icon: CheckSquare },
  { value: 'reminder', label: 'Reminder', icon: Bell },
  { value: 'meeting', label: 'Meeting', icon: CalendarIcon },
  { value: 'site_visit', label: 'Site Visit', icon: CalendarIcon },
];

export function CrmActionComposerModal({
  open,
  onOpenChange,
  context,
  defaultTab = 'activity',
}: CrmActionComposerModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [noteContent, setNoteContent] = useState('');
  const [notePinned, setNotePinned] = useState(false);
  const [activityType, setActivityType] = useState('task');
  const [activitySubject, setActivitySubject] = useState('');
  const [activityDescription, setActivityDescription] = useState('');
  const [activityDate, setActivityDate] = useState<Date | undefined>(new Date());
  const [activityTime, setActivityTime] = useState('09:00');

  const createNoteMutation = useMutation({
    mutationFn: async (data: { content: string; isPinned: boolean; entityType: string; entityId: string }) => {
      return apiRequest('/api/crm/notes', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crmNotes'] });
      queryClient.invalidateQueries({ queryKey: ['crmTimeline'] });
      queryClient.invalidateQueries({ queryKey: ['crmTimelineFocus'] });
      toast({ title: 'Note created successfully' });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create note', description: error.message, variant: 'destructive' });
    },
  });

  const createActivityMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/crm/activities', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crmActivities'] });
      queryClient.invalidateQueries({ queryKey: ['crmTimeline'] });
      queryClient.invalidateQueries({ queryKey: ['crmTimelineFocus'] });
      toast({ title: 'Activity created successfully' });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create activity', description: error.message, variant: 'destructive' });
    },
  });

  // Create task mutation (for reminders and meetings that also create tasks)
  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/crm/tasks', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crmTasks'] });
      queryClient.invalidateQueries({ queryKey: ['crmTimeline'] });
    },
    onError: (error: Error) => {
      console.error('Failed to create task:', error);
    },
  });

  const resetForm = () => {
    setNoteContent('');
    setNotePinned(false);
    setActivityType('task');
    setActivitySubject('');
    setActivityDescription('');
    setActivityDate(new Date());
    setActivityTime('09:00');
  };

  const handleSubmitNote = () => {
    if (!noteContent.trim()) return;

    createNoteMutation.mutate({
      content: noteContent,
      isPinned: notePinned,
      entityType: context.entityType,
      entityId: context.entityId,
    });
  };

  const handleSubmitActivity = (type?: string, createTask: boolean = false) => {
    const finalType = type || activityType;
    if (!activityDescription.trim()) return;

    let scheduledAt: string | undefined;
    if (activityDate) {
      const [hours, minutes] = activityTime.split(':');
      const dateTime = new Date(activityDate);
      dateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      scheduledAt = dateTime.toISOString();
    }

    // Create the activity
    createActivityMutation.mutate({
      type: finalType,
      subject: activitySubject || activityDescription.substring(0, 50),
      description: activityDescription,
      scheduledAt,
      entityType: context.entityType,
      entityId: context.entityId,
    });

    // For reminders and meetings, also create a task
    const shouldCreateTask = createTask || finalType === 'reminder' || finalType === 'meeting';
    if (shouldCreateTask && scheduledAt) {
      const taskData: any = {
        title: activitySubject || `${finalType.charAt(0).toUpperCase() + finalType.slice(1)}: ${activityDescription.substring(0, 50)}`,
        description: activityDescription,
        type: finalType,
        priority: 'medium',
        status: 'pending',
        dueDate: scheduledAt,
      };

      // Link to the appropriate entity
      if (context.entityType === 'contact') {
        taskData.contactId = context.entityId;
      } else if (context.entityType === 'company') {
        taskData.companyId = context.entityId;
      } else if (context.entityType === 'property') {
        taskData.propertyId = context.entityId;
      } else if (context.entityType === 'deal') {
        taskData.dealId = context.entityId;
      }

      createTaskMutation.mutate(taskData);
    }
  };

  const isPending = createNoteMutation.isPending || createActivityMutation.isPending || createTaskMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Add to {context.entityName}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="flex w-full overflow-x-auto scrollbar-hide sm:grid sm:grid-cols-7 h-auto">
            <TabsTrigger value="note" className="gap-1 flex-col py-2 text-xs">
              <StickyNote className="h-3.5 w-3.5" />
              Note
            </TabsTrigger>
            <TabsTrigger value="call" className="gap-1 flex-col py-2 text-xs">
              <Phone className="h-3.5 w-3.5" />
              Call
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-1 flex-col py-2 text-xs">
              <Mail className="h-3.5 w-3.5" />
              Email
            </TabsTrigger>
            <TabsTrigger value="reminder" className="gap-1 flex-col py-2 text-xs">
              <Bell className="h-3.5 w-3.5" />
              Reminder
            </TabsTrigger>
            <TabsTrigger value="meeting" className="gap-1 flex-col py-2 text-xs">
              <CalendarIcon className="h-3.5 w-3.5" />
              Meeting
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1 flex-col py-2 text-xs">
              <CheckSquare className="h-3.5 w-3.5" />
              Task
            </TabsTrigger>
            <TabsTrigger value="files" className="gap-1 flex-col py-2 text-xs">
              <Upload className="h-3.5 w-3.5" />
              Files
            </TabsTrigger>
          </TabsList>

          <TabsContent value="note" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Textarea
                placeholder="Write your note here..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="min-h-[150px]"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="pin-note"
                  checked={notePinned}
                  onCheckedChange={setNotePinned}
                />
                <Label htmlFor="pin-note">Pin this note</Label>
              </div>
              <Button 
                onClick={handleSubmitNote} 
                disabled={!noteContent.trim() || isPending}
              >
                {isPending ? 'Saving...' : 'Save Note'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4 pt-4">
            <div className="space-y-3">
              <div>
                <Label>Activity Type</Label>
                <Select value={activityType} onValueChange={setActivityType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activityTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <span className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Subject</Label>
                <Input
                  placeholder="Activity subject"
                  value={activitySubject}
                  onChange={(e) => setActivitySubject(e.target.value)}
                />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  placeholder="Activity details..."
                  value={activityDescription}
                  onChange={(e) => setActivityDescription(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Due Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !activityDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {activityDate ? format(activityDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={activityDate}
                        onSelect={setActivityDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={activityTime}
                    onChange={(e) => setActivityTime(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button 
                onClick={() => handleSubmitActivity()} 
                disabled={!activityDescription.trim() || isPending}
              >
                {isPending ? 'Creating...' : 'Create Activity'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="call" className="space-y-4 pt-4">
            <div className="space-y-3">
              <div>
                <Label>Subject</Label>
                <Input
                  placeholder="Call subject"
                  value={activitySubject}
                  onChange={(e) => setActivitySubject(e.target.value)}
                />
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  placeholder="Call notes..."
                  value={activityDescription}
                  onChange={(e) => setActivityDescription(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Schedule for</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !activityDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {activityDate ? format(activityDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={activityDate}
                        onSelect={setActivityDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={activityTime}
                    onChange={(e) => setActivityTime(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button 
                onClick={() => handleSubmitActivity('call')} 
                disabled={!activityDescription.trim() || isPending}
              >
                {isPending ? 'Scheduling...' : 'Schedule Call'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="email" className="space-y-4 pt-4">
            <div className="space-y-3">
              <div>
                <Label>Subject</Label>
                <Input
                  placeholder="Email subject"
                  value={activitySubject}
                  onChange={(e) => setActivitySubject(e.target.value)}
                />
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  placeholder="Email notes or follow-up reminder..."
                  value={activityDescription}
                  onChange={(e) => setActivityDescription(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Follow up on</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !activityDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {activityDate ? format(activityDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={activityDate}
                        onSelect={setActivityDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={activityTime}
                    onChange={(e) => setActivityTime(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button 
                onClick={() => handleSubmitActivity('email')} 
                disabled={!activityDescription.trim() || isPending}
              >
                {isPending ? 'Logging...' : 'Log Email'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="files" className="space-y-4 pt-4">
            <FileUploader 
              entityType={context.entityType}
              entityId={context.entityId}
              onUploadComplete={() => {
                queryClient.invalidateQueries({ queryKey: ['/api/crm/files', context.entityType, context.entityId] });
              }}
            />
            <div className="mt-4">
              <Label className="text-sm font-medium mb-2 block">Attached Files</Label>
              <FileList 
                entityType={context.entityType}
                entityId={context.entityId}
              />
            </div>
          </TabsContent>

          {/* Reminder Tab */}
          <TabsContent value="reminder" className="space-y-4 pt-4">
            <div className="space-y-3">
              <div>
                <Label>Reminder Title</Label>
                <Input
                  placeholder="What do you want to be reminded about?"
                  value={activitySubject}
                  onChange={(e) => setActivitySubject(e.target.value)}
                />
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  placeholder="Additional details..."
                  value={activityDescription}
                  onChange={(e) => setActivityDescription(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Remind on *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !activityDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {activityDate ? format(activityDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={activityDate}
                        onSelect={setActivityDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label>Time *</Label>
                  <Input
                    type="time"
                    value={activityTime}
                    onChange={(e) => setActivityTime(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button 
                onClick={() => handleSubmitActivity('reminder', true)} 
                disabled={!activityDate || isPending}
              >
                {isPending ? 'Creating...' : 'Set Reminder'}
              </Button>
            </div>
          </TabsContent>

          {/* Meeting Tab */}
          <TabsContent value="meeting" className="space-y-4 pt-4">
            <div className="space-y-3">
              <div>
                <Label>Meeting Title</Label>
                <Input
                  placeholder="Meeting with..."
                  value={activitySubject}
                  onChange={(e) => setActivitySubject(e.target.value)}
                />
              </div>

              <div>
                <Label>Agenda / Notes</Label>
                <Textarea
                  placeholder="Meeting agenda and notes..."
                  value={activityDescription}
                  onChange={(e) => setActivityDescription(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !activityDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {activityDate ? format(activityDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={activityDate}
                        onSelect={setActivityDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label>Time *</Label>
                  <Input
                    type="time"
                    value={activityTime}
                    onChange={(e) => setActivityTime(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button 
                onClick={() => handleSubmitActivity('meeting', true)} 
                disabled={!activityDate || isPending}
              >
                {isPending ? 'Scheduling...' : 'Schedule Meeting'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
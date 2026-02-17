import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Checkbox } from '@/components/ui/checkbox';

interface BulkEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedContactIds: string[];
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  createdAt: string;
}

interface PreviewResult {
  total: number;
  validEmails: number;
  missingEmails: number;
  notFound: number;
}

export function BulkEmailDialog({ open, onOpenChange, selectedContactIds }: BulkEmailDialogProps) {
  const { toast } = useToast();
  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const { data: templates = [] } = useQuery<EmailTemplate[]>({
    queryKey: ['/api/crm/email-templates'],
    enabled: open,
  });

  const { data: preview } = useQuery<PreviewResult>({
    queryKey: ['/api/crm/bulk-email/preview', selectedContactIds],
    queryFn: async () => {
      const res = await apiRequest('POST', '/api/crm/bulk-email/preview', {
        contactIds: selectedContactIds,
      });
      return res.json();
    },
    enabled: open && selectedContactIds.length > 0,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/crm/bulk-email/send', {
        contactIds: selectedContactIds,
        templateId: selectedTemplateId || undefined,
        subject,
        htmlBody,
      });
      return res.json();
    },
    onSuccess: (data: { sent: number; failed: number; errors: any[] }) => {
      toast({
        title: 'Emails sent',
        description: `${data.sent} sent, ${data.failed} failed`,
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to send emails',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/crm/email-templates', {
        name: templateName,
        subject,
        body: htmlBody,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/email-templates'] });
      toast({ title: 'Template saved' });
    },
  });

  const handleSend = async () => {
    if (saveAsTemplate && templateName) {
      await saveTemplateMutation.mutateAsync();
    }
    sendMutation.mutate();
  };

  useEffect(() => {
    if (selectedTemplateId && templates.length) {
      const tpl = templates.find((t) => t.id === selectedTemplateId);
      if (tpl) {
        setSubject(tpl.subject);
        setHtmlBody(tpl.body);
      }
    }
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    if (!open) {
      setSubject('');
      setHtmlBody('');
      setSelectedTemplateId('');
      setSaveAsTemplate(false);
      setTemplateName('');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Bulk Email</DialogTitle>
          <DialogDescription>
            Send an email to {selectedContactIds.length} selected contact{selectedContactIds.length !== 1 ? 's' : ''}.
            {preview && (
              <span className="block mt-1 text-sm">
                {preview.validEmails} valid email{preview.validEmails !== 1 ? 's' : ''}
                {preview.missingEmails > 0 && `, ${preview.missingEmails} missing email`}
                {preview.notFound > 0 && `, ${preview.notFound} not found`}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="template">Template</Label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template (optional)" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject line"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Body</Label>
            <Textarea
              id="body"
              value={htmlBody}
              onChange={(e) => setHtmlBody(e.target.value)}
              placeholder="Email body (HTML supported)"
              rows={8}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="saveTemplate"
              checked={saveAsTemplate}
              onCheckedChange={(checked) => setSaveAsTemplate(checked === true)}
            />
            <Label htmlFor="saveTemplate">Save as template</Label>
          </div>

          {saveAsTemplate && (
            <div className="space-y-2">
              <Label htmlFor="templateName">Template name</Label>
              <Input
                id="templateName"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="My email template"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!subject || !htmlBody || sendMutation.isPending}
          >
            {sendMutation.isPending ? 'Sending...' : 'Send Email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

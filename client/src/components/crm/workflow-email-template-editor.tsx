import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Send, Eye, Code, ChevronDown } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Props {
  templateId?: string;
  onSave: () => void;
  onClose: () => void;
}

interface TokenInfo {
  key: string;
  label: string;
  example: string;
}

export default function WorkflowEmailTemplateEditor({ templateId, onSave, onClose }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [category, setCategory] = useState("workflow");
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [showTestInput, setShowTestInput] = useState(false);
  const [tokenTarget, setTokenTarget] = useState<'subject' | 'body'>('body');
  const [showTokenMenu, setShowTokenMenu] = useState(false);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Fetch available tokens
  const { data: tokenData } = useQuery<{ tokens: TokenInfo[] }>({
    queryKey: ['/api/workflow-email/available-tokens'],
    queryFn: async () => {
      const res = await fetch('/api/workflow-email/available-tokens');
      return res.json();
    },
  });

  // Fetch existing template if editing
  const { data: templateData } = useQuery({
    queryKey: ['/api/workflow-email/templates', templateId],
    queryFn: async () => {
      if (!templateId) return null;
      const res = await fetch(`/api/workflow-email/templates/${templateId}`);
      return res.json();
    },
    enabled: !!templateId,
  });

  useEffect(() => {
    if (templateData?.template) {
      const t = templateData.template;
      setName(t.name);
      setSubject(t.subject);
      setBodyHtml(t.bodyHtml);
      setBodyText(t.bodyText || "");
      setCategory(t.category);
    }
  }, [templateData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { name, subject, bodyHtml, bodyText: bodyText || null, category };
      if (templateId) {
        await apiRequest('PATCH', `/api/workflow-email/templates/${templateId}`, payload);
      } else {
        await apiRequest('POST', `/api/workflow-email/templates`, payload);
      }
    },
    onSuccess: () => {
      toast({ title: templateId ? 'Template updated' : 'Template created' });
      onSave();
    },
    onError: (err: any) => {
      toast({ title: 'Failed to save template', description: err.message, variant: 'destructive' });
    },
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!templateId) {
        // For new templates, do client-side preview with example data
        let rendered = bodyHtml;
        let renderedSubject = subject;
        for (const t of (tokenData?.tokens || [])) {
          const re = new RegExp(`\\{\\{${t.key.replace('.', '\\.')}\\}\\}`, 'g');
          rendered = rendered.replace(re, t.example);
          renderedSubject = renderedSubject.replace(re, t.example);
        }
        return { bodyHtml: rendered, subject: renderedSubject };
      }
      const res = await apiRequest('POST', `/api/workflow-email/templates/${templateId}/preview`, {});
      return res.json();
    },
    onSuccess: (data: any) => {
      setPreviewHtml(data.bodyHtml);
      setPreviewSubject(data.subject);
      setShowPreview(true);
    },
  });

  const sendTestMutation = useMutation({
    mutationFn: async () => {
      if (!templateId) throw new Error('Save the template first before sending a test');
      const res = await apiRequest('POST', '/api/workflow-email/send-test', {
        templateId,
        recipientEmail: testEmail,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: data.success ? 'Test email sent!' : 'Failed to send test email' });
      setShowTestInput(false);
    },
    onError: (err: any) => {
      toast({ title: 'Failed to send test', description: err.message, variant: 'destructive' });
    },
  });

  const insertToken = (tokenKey: string) => {
    const tokenStr = `{{${tokenKey}}}`;
    if (tokenTarget === 'subject' && subjectRef.current) {
      const el = subjectRef.current;
      const start = el.selectionStart || subject.length;
      setSubject(subject.slice(0, start) + tokenStr + subject.slice(start));
    } else if (bodyRef.current) {
      const el = bodyRef.current;
      const start = el.selectionStart || bodyHtml.length;
      setBodyHtml(bodyHtml.slice(0, start) + tokenStr + bodyHtml.slice(start));
    }
    setShowTokenMenu(false);
  };

  const tokens = tokenData?.tokens || [];
  const canSave = name.trim() && subject.trim() && bodyHtml.trim();

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{templateId ? 'Edit Email Template' : 'New Email Template'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Deal Stage Update"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="workflow">Workflow</SelectItem>
                  <SelectItem value="notification">Notification</SelectItem>
                  <SelectItem value="follow_up">Follow-Up</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Token insertion dropdown */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowTokenMenu(!showTokenMenu)}
              >
                <Code className="w-4 h-4 mr-1" />
                Insert Token
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
              {showTokenMenu && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-white border rounded-lg shadow-lg w-80 max-h-64 overflow-auto">
                  <div className="p-2 border-b flex gap-1">
                    <Button
                      size="sm"
                      variant={tokenTarget === 'subject' ? 'default' : 'ghost'}
                      onClick={() => setTokenTarget('subject')}
                      className="text-xs"
                    >
                      Subject
                    </Button>
                    <Button
                      size="sm"
                      variant={tokenTarget === 'body' ? 'default' : 'ghost'}
                      onClick={() => setTokenTarget('body')}
                      className="text-xs"
                    >
                      Body
                    </Button>
                  </div>
                  {tokens.map((t) => (
                    <button
                      key={t.key}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm flex justify-between items-center"
                      onClick={() => insertToken(t.key)}
                    >
                      <span>
                        <span className="font-medium">{t.label}</span>
                        <span className="text-gray-400 ml-2 font-mono text-xs">{`{{${t.key}}}`}</span>
                      </span>
                      <span className="text-gray-400 text-xs">{t.example}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="text-xs text-gray-500">Click a token to insert it at cursor position</span>
          </div>

          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              ref={subjectRef}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. {{deal.propertyName}} moved to {{deal.stage}}"
              onFocus={() => setTokenTarget('subject')}
            />
          </div>

          <div className="space-y-2">
            <Label>Body (HTML)</Label>
            <Textarea
              ref={bodyRef}
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              placeholder="<h2>Deal Update</h2><p>Your deal {{deal.propertyName}} has been updated...</p>"
              rows={10}
              className="font-mono text-sm"
              onFocus={() => setTokenTarget('body')}
            />
          </div>

          <div className="space-y-2">
            <Label>Plain Text Fallback (optional)</Label>
            <Textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Auto-generated from HTML if left blank"
              rows={3}
              className="text-sm"
            />
          </div>

          {/* Tokens used display */}
          {bodyHtml && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs text-gray-500 mr-1">Tokens used:</span>
              {Array.from(new Set([...subject.matchAll(/\{\{([\w.]+)\}\}/g), ...bodyHtml.matchAll(/\{\{([\w.]+)\}\}/g)].map(m => m[1]))).map(t => (
                <Badge key={t} variant="secondary" className="text-xs font-mono">{`{{${t}}}`}</Badge>
              ))}
            </div>
          )}

          {/* Preview panel */}
          {showPreview && previewHtml && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-3 py-2 border-b flex justify-between items-center">
                <span className="text-sm font-medium">Preview — Subject: {previewSubject}</span>
                <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>Close</Button>
              </div>
              <div className="p-4 max-h-64 overflow-auto" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          )}

          {/* Send test email */}
          {showTestInput && (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <Input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={() => sendTestMutation.mutate()}
                disabled={!testEmail || sendTestMutation.isPending}
              >
                {sendTestMutation.isPending ? 'Sending...' : 'Send'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowTestInput(false)}>Cancel</Button>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => previewMutation.mutate()}>
                <Eye className="w-4 h-4 mr-1" />
                Preview
              </Button>
              {templateId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTestInput(true)}
                >
                  <Send className="w-4 h-4 mr-1" />
                  Send Test
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!canSave || saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Saving...' : templateId ? 'Update Template' : 'Create Template'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

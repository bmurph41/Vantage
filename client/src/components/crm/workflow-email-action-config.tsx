import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface SendEmailActionConfig {
  to: string;
  recipientType: 'deal_owner' | 'contact' | 'team_member' | 'custom';
  templateId?: string;
  subject?: string;
  body?: string;
}

interface Props {
  config: SendEmailActionConfig;
  onChange: (config: SendEmailActionConfig) => void;
}

interface TemplateOption {
  id: string;
  name: string;
  subject: string;
  category: string;
}

export default function WorkflowEmailActionConfig({ config, onChange }: Props) {
  const [contentMode, setContentMode] = useState<'template' | 'custom'>(
    config.templateId ? 'template' : 'custom'
  );

  const { data: templatesData } = useQuery<{ templates: TemplateOption[] }>({
    queryKey: ['/api/workflow-email/templates', 'active'],
    queryFn: async () => {
      const res = await fetch('/api/workflow-email/templates?isActive=true');
      return res.json();
    },
  });

  const templates = templatesData?.templates || [];

  const handleRecipientTypeChange = (type: string) => {
    const recipientType = type as SendEmailActionConfig['recipientType'];
    let to = '';
    if (recipientType === 'deal_owner') to = 'deal_owner';
    else if (recipientType === 'contact') to = 'primary_contact';
    onChange({ ...config, recipientType, to });
  };

  const handleContentModeChange = (mode: string) => {
    setContentMode(mode as 'template' | 'custom');
    if (mode === 'template') {
      onChange({ ...config, subject: undefined, body: undefined });
    } else {
      onChange({ ...config, templateId: undefined });
    }
  };

  return (
    <div className="space-y-4 pl-2 border-l-2 border-blue-200">
      {/* Recipient selection */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Recipient</Label>
        <RadioGroup
          value={config.recipientType || 'deal_owner'}
          onValueChange={handleRecipientTypeChange}
          className="flex flex-wrap gap-3"
        >
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="deal_owner" id="r-owner" />
            <Label htmlFor="r-owner" className="text-xs cursor-pointer">Deal Owner</Label>
          </div>
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="contact" id="r-contact" />
            <Label htmlFor="r-contact" className="text-xs cursor-pointer">Primary Contact</Label>
          </div>
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="custom" id="r-custom" />
            <Label htmlFor="r-custom" className="text-xs cursor-pointer">Custom Email</Label>
          </div>
        </RadioGroup>
        {config.recipientType === 'custom' && (
          <Input
            value={config.to || ''}
            onChange={(e) => onChange({ ...config, to: e.target.value })}
            placeholder="email@example.com or {{contact.email}}"
            className="text-sm"
          />
        )}
      </div>

      {/* Content mode */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Email Content</Label>
        <RadioGroup
          value={contentMode}
          onValueChange={handleContentModeChange}
          className="flex gap-3"
        >
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="template" id="c-template" />
            <Label htmlFor="c-template" className="text-xs cursor-pointer">Use Template</Label>
          </div>
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="custom" id="c-custom" />
            <Label htmlFor="c-custom" className="text-xs cursor-pointer">Custom Content</Label>
          </div>
        </RadioGroup>
      </div>

      {contentMode === 'template' ? (
        <div className="space-y-2">
          <Label className="text-xs">Select Template</Label>
          <Select
            value={config.templateId || ''}
            onValueChange={(val) => onChange({ ...config, templateId: val })}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Choose a template..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <span>{t.name}</span>
                  <span className="text-gray-400 text-xs ml-2">({t.category})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Subject</Label>
            <Input
              value={config.subject || ''}
              onChange={(e) => onChange({ ...config, subject: e.target.value })}
              placeholder="e.g. {{deal.propertyName}} — Action Needed"
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Body (HTML)</Label>
            <Textarea
              value={config.body || ''}
              onChange={(e) => onChange({ ...config, body: e.target.value })}
              placeholder="<p>Hello {{contact.firstName}},</p><p>Your deal needs attention...</p>"
              rows={4}
              className="text-sm font-mono"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export type { SendEmailActionConfig };

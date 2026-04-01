/**
 * IC Deck Section Toggle — checkbox list for enabling/disabling optional sections
 */

import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Lock } from 'lucide-react';

interface SectionInfo {
  key: string;
  title: string;
  required: boolean;
  enabled: boolean;
  disableReason?: string;
}

interface ICDeckSectionToggleProps {
  sections: SectionInfo[];
  onToggle: (key: string, enabled: boolean) => void;
}

export default function ICDeckSectionToggle({ sections, onToggle }: ICDeckSectionToggleProps) {
  return (
    <div className="space-y-2">
      {sections.map((section) => (
        <label
          key={section.key}
          className={`flex items-center gap-2 text-sm py-1 ${
            section.disableReason ? 'opacity-50' : ''
          }`}
        >
          {section.required ? (
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <Checkbox
              checked={section.enabled}
              disabled={!!section.disableReason}
              onCheckedChange={(checked) => onToggle(section.key, !!checked)}
            />
          )}
          <span className={section.required ? 'font-medium' : ''}>
            {section.title}
          </span>
          {section.required && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              Required
            </Badge>
          )}
          {section.disableReason && (
            <span className="text-xs text-muted-foreground italic">
              ({section.disableReason})
            </span>
          )}
        </label>
      ))}
    </div>
  );
}

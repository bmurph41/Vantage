import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAppInfo } from '@/hooks/use-settings';
import {
  HelpCircle,
  Mail,
  Book,
  MessageCircle,
  Keyboard,
  FileText,
  ExternalLink,
  Code,
  Loader2,
  Bug,
  Lightbulb,
  HeadphonesIcon,
} from 'lucide-react';
import type { UserSettings, UserProfile, Organization } from '@/types/settings';
import { SupportContactModal } from '@/components/support/SupportContactModal';

interface HelpAboutSettingsProps {
  settings: UserSettings;
  profile: UserProfile;
  organization: Organization | null;
  onChange: (updates: Partial<UserSettings>) => void;
}

const KEYBOARD_SHORTCUTS = [
  { keys: ['⌘', 'K'], description: 'Open command palette' },
  { keys: ['⌘', '/'], description: 'Toggle sidebar' },
  { keys: ['⌘', 'S'], description: 'Save changes' },
  { keys: ['⌘', 'N'], description: 'New item' },
  { keys: ['⌘', 'F'], description: 'Search' },
  { keys: ['Esc'], description: 'Close modal / Cancel' },
  { keys: ['⌘', '⇧', 'P'], description: 'Open settings' },
  { keys: ['?'], description: 'Show keyboard shortcuts' },
];

export function HelpAboutSettings({
  settings,
  profile,
  organization,
}: HelpAboutSettingsProps) {
  const { data: appInfo, isLoading } = useAppInfo();
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportCategory, setSupportCategory] = useState<'bug' | 'feature' | 'quickbooks' | 'billing' | 'general'>('general');
  const [supportSubject, setSupportSubject] = useState('');

  function openSupport(category: typeof supportCategory, subject = '') {
    setSupportCategory(category);
    setSupportSubject(subject);
    setSupportOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Quick Help */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Get Help
          </CardTitle>
          <CardDescription>Resources to help you get the most out of Vantage</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <a
            href={appInfo?.docsUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors"
          >
            <Book className="h-5 w-5 text-primary" />
            <div>
              <h4 className="font-medium text-sm">Documentation</h4>
              <p className="text-xs text-muted-foreground">Guides and tutorials</p>
            </div>
            <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
          </a>

          <button
            onClick={() => openSupport('general')}
            className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors text-left w-full"
          >
            <Mail className="h-5 w-5 text-primary" />
            <div>
              <h4 className="font-medium text-sm">Email Support</h4>
              <p className="text-xs text-muted-foreground">{appInfo?.supportEmail || 'support@vantage.com'}</p>
            </div>
            <HeadphonesIcon className="h-4 w-4 ml-auto text-muted-foreground" />
          </button>

          <button
            onClick={() => openSupport('general', 'Live Chat Request')}
            className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors text-left w-full"
          >
            <MessageCircle className="h-5 w-5 text-primary" />
            <div>
              <h4 className="font-medium text-sm">Contact Support</h4>
              <p className="text-xs text-muted-foreground">Send a message to our team</p>
            </div>
            <HeadphonesIcon className="h-4 w-4 ml-auto text-muted-foreground" />
          </button>

          <a
            href={appInfo?.changelogUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors"
          >
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <h4 className="font-medium text-sm">Changelog</h4>
              <p className="text-xs text-muted-foreground">Latest updates</p>
            </div>
            <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
          </a>
        </CardContent>
      </Card>

      {/* Feedback */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Feedback
          </CardTitle>
          <CardDescription>Help us improve Vantage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              <div>
                <h4 className="font-medium text-sm">Feature Request</h4>
                <p className="text-sm text-muted-foreground">
                  Suggest a new feature or improvement
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => openSupport('feature', 'Feature Request')}>
              Submit Idea
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <Bug className="h-5 w-5 text-red-500" />
              <div>
                <h4 className="font-medium text-sm">Report a Bug</h4>
                <p className="text-sm text-muted-foreground">
                  Found something that's not working right?
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => openSupport('bug', 'Bug Report')}>
              Report Bug
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Keyboard Shortcuts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </CardTitle>
          <CardDescription>Navigate faster with keyboard shortcuts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {KEYBOARD_SHORTCUTS.map((shortcut, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted"
              >
                <span className="text-sm text-muted-foreground">
                  {shortcut.description}
                </span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key, i) => (
                    <kbd
                      key={i}
                      className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted border rounded"
                    >
                      {key}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            About Vantage
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 text-sm">
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-muted-foreground">Version</span>
                  <span className="font-mono">{appInfo?.version || '1.0.0'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-muted-foreground">Build</span>
                  <span className="font-mono text-xs">
                    {appInfo?.buildHash?.substring(0, 8) || 'dev'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-muted-foreground">Environment</span>
                  <Badge variant="outline" className="capitalize">
                    {appInfo?.environment || 'development'}
                  </Badge>
                </div>
              </div>

              <Separator />

              <div className="text-center text-sm text-muted-foreground">
                <p>© {new Date().getFullYear()} Vantage. All rights reserved.</p>
                <p className="mt-1">
                  Built with ❤️ for the marina industry
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <SupportContactModal
        open={supportOpen}
        onOpenChange={setSupportOpen}
        defaultCategory={supportCategory}
        defaultSubject={supportSubject}
        userName={profile?.name || ''}
        userEmail={profile?.email || ''}
      />
    </div>
  );
}

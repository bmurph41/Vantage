import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Bell,
  Mail,
  Smartphone,
  MessageSquare,
  Clock,
  Moon,
  Briefcase,
  Calculator,
  Users,
  Shield,
  TrendingUp,
} from 'lucide-react';
import type { UserSettings, UserProfile, Organization, NotificationPreferences } from '@/types/settings';

interface NotificationSettingsProps {
  settings: UserSettings;
  profile: UserProfile;
  organization: Organization | null;
  onChange: (updates: Partial<UserSettings>) => void;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export function NotificationSettings({
  settings,
  onChange,
}: NotificationSettingsProps) {
  const prefs = settings.notificationPreferences;

  const updatePrefs = (updates: Partial<NotificationPreferences>) => {
    onChange({
      notificationPreferences: {
        ...prefs,
        ...updates,
      },
    });
  };

  const updateChannels = (channel: keyof NotificationPreferences['channels'], value: boolean) => {
    updatePrefs({
      channels: {
        ...prefs.channels,
        [channel]: value,
      },
    });
  };

  const updateDigests = (updates: Partial<NotificationPreferences['digests']>) => {
    updatePrefs({
      digests: {
        ...prefs.digests,
        ...updates,
      },
    });
  };

  const updateQuietHours = (updates: Partial<NotificationPreferences['quietHours']>) => {
    updatePrefs({
      quietHours: {
        ...prefs.quietHours,
        ...updates,
      },
    });
  };

  const updateModule = <T extends keyof NotificationPreferences['modules']>(
    module: T,
    updates: Partial<NotificationPreferences['modules'][T]>
  ) => {
    updatePrefs({
      modules: {
        ...prefs.modules,
        [module]: {
          ...prefs.modules[module],
          ...updates,
        },
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Channels
          </CardTitle>
          <CardDescription>Choose how you want to receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label>In-App Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Notifications within the application
                </p>
              </div>
            </div>
            <Switch
              checked={prefs.channels.inApp}
              onCheckedChange={(checked) => updateChannels('inApp', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Important updates sent to your email
                </p>
              </div>
            </div>
            <Switch
              checked={prefs.channels.email}
              onCheckedChange={(checked) => updateChannels('email', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label>SMS Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Critical alerts via text message
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Coming Soon</Badge>
              <Switch
                checked={prefs.channels.sms}
                onCheckedChange={(checked) => updateChannels('sms', checked)}
                disabled
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Digest Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Email Digest
          </CardTitle>
          <CardDescription>Receive a summary of activity instead of instant emails</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Email Digest</Label>
              <p className="text-sm text-muted-foreground">
                Bundle notifications into a periodic summary
              </p>
            </div>
            <Switch
              checked={prefs.digests.enabled}
              onCheckedChange={(checked) => updateDigests({ enabled: checked })}
            />
          </div>

          {prefs.digests.enabled && (
            <>
              <Separator />
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select
                    value={prefs.digests.cadence}
                    onValueChange={(value: 'daily' | 'weekly') =>
                      updateDigests({ cadence: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={prefs.digests.time}
                    onChange={(e) => updateDigests({ time: e.target.value })}
                  />
                </div>

                {prefs.digests.cadence === 'weekly' && (
                  <div className="space-y-2">
                    <Label>Day</Label>
                    <Select
                      value={String(prefs.digests.dayOfWeek || 1)}
                      onValueChange={(value) =>
                        updateDigests({ dayOfWeek: parseInt(value) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS_OF_WEEK.map((day) => (
                          <SelectItem key={day.value} value={String(day.value)}>
                            {day.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5" />
            Quiet Hours
          </CardTitle>
          <CardDescription>Pause notifications during specific hours</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Quiet Hours</Label>
              <p className="text-sm text-muted-foreground">
                No notifications during this time window
              </p>
            </div>
            <Switch
              checked={prefs.quietHours.enabled}
              onCheckedChange={(checked) => updateQuietHours({ enabled: checked })}
            />
          </div>

          {prefs.quietHours.enabled && (
            <>
              <Separator />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={prefs.quietHours.start}
                    onChange={(e) => updateQuietHours({ start: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={prefs.quietHours.end}
                    onChange={(e) => updateQuietHours({ end: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Notification Scope */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Scope</CardTitle>
          <CardDescription>Choose which activity you want to be notified about</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={prefs.scope}
            onValueChange={(value: 'mine' | 'all') => updatePrefs({ scope: value })}
          >
            <SelectTrigger className="w-full md:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mine">Only my projects and deals</SelectItem>
              <SelectItem value="all">All activity I have access to</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Module-specific notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Deal Room Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: 'ndaSigned', label: 'NDA Signed', desc: 'When a party signs an NDA' },
            { key: 'fileUploaded', label: 'File Uploaded', desc: 'New files in data room' },
            { key: 'comment', label: 'Comments', desc: 'New comments on documents' },
            { key: 'taskAssigned', label: 'Task Assigned', desc: 'When you\'re assigned a task' },
            { key: 'qaResponse', label: 'Q&A Response', desc: 'Answers to questions' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <Label>{item.label}</Label>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
              <Switch
                checked={prefs.modules.dealRoom[item.key as keyof typeof prefs.modules.dealRoom]}
                onCheckedChange={(checked) =>
                  updateModule('dealRoom', { [item.key]: checked })
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Financial Model Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: 'parseComplete', label: 'Parsing Complete', desc: 'When document parsing finishes' },
            { key: 'reviewRequired', label: 'Review Required', desc: 'Items needing your review' },
            { key: 'modelReady', label: 'Model Ready', desc: 'Financial model is ready' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <Label>{item.label}</Label>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
              <Switch
                checked={prefs.modules.valuator[item.key as keyof typeof prefs.modules.valuator]}
                onCheckedChange={(checked) =>
                  updateModule('valuator', { [item.key]: checked })
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            CRM Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: 'leadAssigned', label: 'Lead Assigned', desc: 'New lead assigned to you' },
            { key: 'taskDue', label: 'Task Due', desc: 'Upcoming task deadlines' },
            { key: 'pipelineMoved', label: 'Pipeline Changed', desc: 'Deals moving in pipeline' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <Label>{item.label}</Label>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
              <Switch
                checked={prefs.modules.crm[item.key as keyof typeof prefs.modules.crm]}
                onCheckedChange={(checked) =>
                  updateModule('crm', { [item.key]: checked })
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: 'newLogin', label: 'New Login', desc: 'Sign-in from new device' },
            { key: 'passwordChanged', label: 'Password Changed', desc: 'Password was updated' },
            { key: 'tokenCreated', label: 'Token Created', desc: 'New API token created' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <Label>{item.label}</Label>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
              <Switch
                checked={prefs.modules.security[item.key as keyof typeof prefs.modules.security]}
                onCheckedChange={(checked) =>
                  updateModule('security', { [item.key]: checked })
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Comps & Market Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: 'newCompsParsed', label: 'New Comps', desc: 'New comparable sales parsed' },
            { key: 'anomalies', label: 'Anomalies Detected', desc: 'Unusual data flagged' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <Label>{item.label}</Label>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
              <Switch
                checked={prefs.modules.comps[item.key as keyof typeof prefs.modules.comps]}
                onCheckedChange={(checked) =>
                  updateModule('comps', { [item.key]: checked })
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
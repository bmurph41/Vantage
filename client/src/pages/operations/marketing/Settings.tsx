import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon, Key, Webhook, Database } from "lucide-react";

export default function Settings() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold" data-testid="page-title">Marketing Settings</h1>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Key className="w-5 h-5 text-muted-foreground" />
              <CardTitle>API Integrations</CardTitle>
            </div>
            <CardDescription>
              Configure API keys for external marketing platforms
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              API integration settings will be available here for connecting to:
            </div>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-4">
              <li>MailChimp API credentials</li>
              <li>Constant Contact OAuth configuration</li>
              <li>Google Analytics tracking</li>
              <li>Facebook Ads integration</li>
              <li>LinkedIn Ads integration</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Webhook className="w-5 h-5 text-muted-foreground" />
              <CardTitle>Webhooks</CardTitle>
            </div>
            <CardDescription>
              Configure webhooks for real-time marketing data sync
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Webhook endpoints will allow:
            </div>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-4">
              <li>Lead capture from website forms</li>
              <li>Campaign event notifications</li>
              <li>Attribution data sync</li>
              <li>Revenue tracking updates</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Database className="w-5 h-5 text-muted-foreground" />
              <CardTitle>Data Management</CardTitle>
            </div>
            <CardDescription>
              Configure data retention and export preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Data management settings will include:
            </div>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-4">
              <li>Attribution model preferences (first-touch, last-touch, multi-touch)</li>
              <li>Data retention policies</li>
              <li>Automated data export schedules</li>
              <li>ROAS calculation methods</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <SettingsIcon className="w-5 h-5 text-muted-foreground" />
              <CardTitle>General Settings</CardTitle>
            </div>
            <CardDescription>
              General marketing module preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              General settings will include:
            </div>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-4">
              <li>Default campaign budget settings</li>
              <li>Expense approval workflows</li>
              <li>Notification preferences</li>
              <li>Team member permissions</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

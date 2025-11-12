import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, AlertCircle } from "lucide-react";

export default function EmailCampaigns() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold" data-testid="page-title">Email Campaigns</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Mail className="w-5 h-5 text-muted-foreground" />
            <CardTitle>Email Platform Integration</CardTitle>
          </div>
          <CardDescription>
            Connect your email marketing platform to sync campaign data and performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <AlertCircle className="w-4 h-4" />
            <span>Email platform integration coming soon</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">MailChimp</CardTitle>
                <CardDescription>Sync campaigns from MailChimp</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant="outline" data-testid="badge-mailchimp">Not Connected</Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Constant Contact</CardTitle>
                <CardDescription>Sync campaigns from Constant Contact</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant="outline" data-testid="badge-constant-contact">Not Connected</Badge>
              </CardContent>
            </Card>
          </div>

          <div className="border-t pt-6">
            <h3 className="font-medium mb-2">Planned Features</h3>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              <li>Sync email campaigns from MailChimp and Constant Contact</li>
              <li>Track open rates, click rates, and conversion metrics</li>
              <li>Automatic attribution linking to leads and deals</li>
              <li>Campaign performance dashboards</li>
              <li>List and segment management</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

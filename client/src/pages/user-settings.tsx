import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, User, Mail, Calendar, Settings } from "lucide-react";
import { useLocation } from "wouter";
import { EmailManagement } from "@/components/email-management";

export default function UserSettingsPage() {
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("emails");

  // Fetch user emails
  const { data: userEmails = [], isLoading: isLoadingEmails } = useQuery({
    queryKey: ['/api/user/emails'],
  });

  const typedEmails = Array.isArray(userEmails) ? userEmails : [];

  return (
    <div className="h-full bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="flex h-16 items-center gap-4 px-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            className="gap-2"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold text-foreground" data-testid="text-page-title">
              User Settings
            </h1>
            <p className="text-sm text-muted-foreground" data-testid="text-page-description">
              Manage your account preferences and calendar integration settings
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-6 p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3" data-testid="tabs-user-settings">
            <TabsTrigger value="emails" className="gap-2" data-testid="tab-emails">
              <Mail className="h-4 w-4" />
              Email Management
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2" data-testid="tab-calendar">
              <Calendar className="h-4 w-4" />
              Calendar Settings
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2" data-testid="tab-profile">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
          </TabsList>

          <TabsContent value="emails" className="space-y-6">
            <Card data-testid="card-email-management">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2" data-testid="text-email-title">
                      <Mail className="h-5 w-5" />
                      Email Management
                    </CardTitle>
                    <CardDescription data-testid="text-email-description">
                      Manage your email addresses for calendar sync and notifications
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" data-testid="badge-email-count">
                    {typedEmails.length} email{typedEmails.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <EmailManagement emails={typedEmails} isLoading={isLoadingEmails} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendar" className="space-y-6">
            <Card data-testid="card-calendar-settings">
              <CardHeader>
                <CardTitle className="flex items-center gap-2" data-testid="text-calendar-title">
                  <Calendar className="h-5 w-5" />
                  Calendar Integration Settings
                </CardTitle>
                <CardDescription data-testid="text-calendar-description">
                  Configure your default calendar provider and sync preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div>
                      <h4 className="font-medium text-foreground">Default Calendar Provider</h4>
                      <p className="text-sm text-muted-foreground">
                        Choose your preferred calendar service for sync operations
                      </p>
                    </div>
                    <Badge variant="outline">Coming Soon</Badge>
                  </div>
                  <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div>
                      <h4 className="font-medium text-foreground">Auto-Sync Settings</h4>
                      <p className="text-sm text-muted-foreground">
                        Configure automatic calendar synchronization preferences
                      </p>
                    </div>
                    <Badge variant="outline">Coming Soon</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="space-y-6">
            <Card data-testid="card-profile-settings">
              <CardHeader>
                <CardTitle className="flex items-center gap-2" data-testid="text-profile-title">
                  <User className="h-5 w-5" />
                  Profile Settings
                </CardTitle>
                <CardDescription data-testid="text-profile-description">
                  Manage your account information and preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div>
                      <h4 className="font-medium text-foreground">Account Information</h4>
                      <p className="text-sm text-muted-foreground">
                        Update your name, timezone, and other account details
                      </p>
                    </div>
                    <Badge variant="outline">Coming Soon</Badge>
                  </div>
                  <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div>
                      <h4 className="font-medium text-foreground">Notification Preferences</h4>
                      <p className="text-sm text-muted-foreground">
                        Configure global notification settings
                      </p>
                    </div>
                    <Badge variant="outline">Coming Soon</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, Settings, Bell, TestTube } from "lucide-react";
import { ContactManagement } from "../components/contact-management";
import { SubscriptionManager } from "../components/subscription-manager";
import { ProjectNotificationSettings } from "../components/project-notification-settings";
import { NotificationTester } from "../components/notification-tester";
import type { Project, ProjectSettings } from "@shared/schema";

interface NotificationSettingsPageProps {
  projectId?: string;
}

export default function NotificationSettingsPage({ projectId: propProjectId }: NotificationSettingsPageProps = {}) {
  const params = useParams();
  const [location, setLocation] = useLocation();
  const projectId = propProjectId || (params as any).id;
  const [activeTab, setActiveTab] = useState("contacts");

  // Fetch project data
  const { data: projectData, isLoading: isLoadingProject } = useQuery({
    queryKey: ['/api/dd/projects', projectId],
    enabled: !!projectId,
  });

  // Fetch project contacts
  const { data: contacts = [], isLoading: isLoadingContacts } = useQuery({
    queryKey: ['/api/dd/contacts'],
  });

  // Fetch notification subscriptions
  const { data: subscriptions = [], isLoading: isLoadingSubscriptions } = useQuery({
    queryKey: ['/api/dd/projects', projectId, 'subscriptions'],
    enabled: !!projectId,
  });
  
  // Type safety for contacts and subscriptions
  const typedContacts = Array.isArray(contacts) ? contacts : [];
  const typedSubscriptions = Array.isArray(subscriptions) ? subscriptions : [];

  if (isLoadingProject) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-muted rounded w-2/3"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!projectData || typeof projectData !== 'object' || !('project' in projectData)) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Project Not Found</h2>
          <p className="text-muted-foreground">The notification settings for this project could not be loaded.</p>
        </div>
      </div>
    );
  }

  const { project, settings } = projectData as { project: Project; settings?: ProjectSettings };

  const totalContacts = typedContacts.length;
  const activeSubscriptions = typedSubscriptions.filter((sub: any) => sub.active).length;
  const notificationsEnabled = settings?.notificationsEnabled ?? true;

  return (
    <div className="min-h-screen bg-background" data-testid="notification-settings-page">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setLocation(`/projects/${projectId}`)}
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Project
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div>
                <h1 className="text-2xl font-bold text-foreground" data-testid="page-title">
                  Notification Settings
                </h1>
                <p className="text-muted-foreground" data-testid="project-name">
                  {project.name}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Badge 
                variant={notificationsEnabled ? "default" : "secondary"}
                data-testid="badge-notification-status"
              >
                {notificationsEnabled ? "Notifications On" : "Notifications Off"}
              </Badge>
              <Badge variant="outline" data-testid="badge-contacts-count">
                {totalContacts} Contacts
              </Badge>
              <Badge variant="outline" data-testid="badge-subscriptions-count">
                {activeSubscriptions} Active Subscriptions
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4" data-testid="tabs-list">
            <TabsTrigger value="contacts" className="flex items-center space-x-2" data-testid="tab-contacts">
              <Users className="h-4 w-4" />
              <span>Contacts</span>
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="flex items-center space-x-2" data-testid="tab-subscriptions">
              <Bell className="h-4 w-4" />
              <span>Subscriptions</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center space-x-2" data-testid="tab-settings">
              <Settings className="h-4 w-4" />
              <span>Project Settings</span>
            </TabsTrigger>
            <TabsTrigger value="testing" className="flex items-center space-x-2" data-testid="tab-testing">
              <TestTube className="h-4 w-4" />
              <span>Testing</span>
            </TabsTrigger>
          </TabsList>

          {/* Contact Management Tab */}
          <TabsContent value="contacts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Contact Management</CardTitle>
                <CardDescription>
                  Manage external contacts who will receive notifications about project progress.
                  Add team members, clients, or stakeholders to keep them informed.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ContactManagement 
                  contacts={typedContacts}
                  isLoading={isLoadingContacts}
                  projectId={projectId!}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subscription Management Tab */}
          <TabsContent value="subscriptions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Subscriptions</CardTitle>
                <CardDescription>
                  Configure which contacts receive notifications for different types of events.
                  Set up alerts for status changes, deadlines, and project updates.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SubscriptionManager
                  projectId={projectId!}
                  contacts={typedContacts}
                  subscriptions={typedSubscriptions}
                  isLoading={isLoadingSubscriptions}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Project Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Project Notification Settings</CardTitle>
                <CardDescription>
                  Configure global notification preferences for this project including timing,
                  channels, and default behaviors.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProjectNotificationSettings
                  projectId={projectId!}
                  settings={settings}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notification Testing Tab */}
          <TabsContent value="testing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Testing</CardTitle>
                <CardDescription>
                  Test your notification setup by sending sample notifications to verify
                  delivery and template formatting.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <NotificationTester
                  projectId={projectId!}
                  contacts={typedContacts}
                  settings={settings}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import type { Project, ProjectSettings } from "@shared/schema";
import { useUpdateProject, useUpdateProjectSettings } from "@/hooks/use-project";

const projectFormSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
  anchorType: z.enum(["psa", "custom"]),
  psaSignedDate: z.string().optional(),
  ddExpirationDate: z.string().optional(),
  closingDate: z.string().optional(),
  // DD Timeline calculation fields
  ddPeriodDays: z.number().min(1, "DD period must be at least 1 day").optional(),
  hasExtensions: z.boolean(),
  extensionCount: z.number().min(0).max(10).optional(),
  extensionDays: z.array(z.number().min(1)).optional(),
  daysToClosing: z.number().min(1, "Days to closing must be at least 1 day").optional(),
  tz: z.string(),
});

const settingsFormSchema = z.object({
  useBusinessDays: z.boolean(),
  holidayCalendar: z.enum(["us_federal", "none"]),
  emailReminders: z.boolean(),
  slackNotifications: z.boolean(),
  slackWebhookUrl: z.string().optional(),
  ndaRequired: z.boolean(),
});

interface ProjectSetupProps {
  project: Project;
  settings?: ProjectSettings | null;
}

export function ProjectSetup({ project, settings }: ProjectSetupProps) {
  const updateProject = useUpdateProject();
  const updateSettings = useUpdateProjectSettings();
  const [extensionDaysArray, setExtensionDaysArray] = useState<number[]>(project.extensionDays || []);

  const projectForm = useForm({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: project.name,
      description: project.description || "",
      anchorType: project.anchorType,
      psaSignedDate: project.psaSignedDate || "",
      ddExpirationDate: project.ddExpirationDate || "",
      closingDate: project.closingDate || "",
      // DD Timeline fields
      ddPeriodDays: project.ddPeriodDays || undefined,
      hasExtensions: project.hasExtensions || false,
      extensionCount: project.extensionCount || 0,
      extensionDays: project.extensionDays || [],
      daysToClosing: project.daysToClosing || undefined,
      tz: project.tz,
    },
  });

  const settingsForm = useForm({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      useBusinessDays: settings?.useBusinessDays || false,
      holidayCalendar: settings?.holidayCalendar || "us_federal",
      emailReminders: true, // From notifications JSON
      slackNotifications: false,
      slackWebhookUrl: "",
      ndaRequired: settings?.ndaRequired || false,
    },
  });

  const onProjectSubmit = (data: z.infer<typeof projectFormSchema>) => {
    updateProject.mutate({
      id: project.id,
      updates: {
        name: data.name,
        description: data.description,
        anchorType: data.anchorType,
        psaSignedDate: data.psaSignedDate || null,
        ddExpirationDate: data.ddExpirationDate || null,
        closingDate: data.closingDate || null,
        // DD Timeline fields
        ddPeriodDays: data.ddPeriodDays || null,
        hasExtensions: data.hasExtensions,
        extensionCount: data.extensionCount || 0,
        extensionDays: data.extensionDays || [],
        daysToClosing: data.daysToClosing || null,
        tz: data.tz,
      },
    });
  };

  const onSettingsSubmit = (data: z.infer<typeof settingsFormSchema>) => {
    updateSettings.mutate({
      projectId: project.id,
      settings: {
        useBusinessDays: data.useBusinessDays,
        holidayCalendar: data.holidayCalendar,
        ndaRequired: data.ndaRequired,
        notificationsJson: {
          emailReminders: data.emailReminders,
          slackNotifications: data.slackNotifications,
          slackWebhookUrl: data.slackWebhookUrl,
        },
      },
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="project-setup">
      {/* Project Details */}
      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={projectForm.handleSubmit(onProjectSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                {...projectForm.register("name")}
                data-testid="input-project-name"
              />
              {projectForm.formState.errors.name && (
                <p className="text-sm text-destructive">{projectForm.formState.errors.name.message}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...projectForm.register("description")}
                placeholder="Optional project description"
                data-testid="textarea-description"
              />
            </div>
            
            <div>
              <Label htmlFor="anchorType">Anchor Type</Label>
              <Select
                value={projectForm.watch("anchorType")}
                onValueChange={(value) => projectForm.setValue("anchorType", value as "psa" | "custom")}
              >
                <SelectTrigger data-testid="select-anchor-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="psa">PSA Signed Date</SelectItem>
                  <SelectItem value="custom">Custom Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Key Dates */}
      <Card>
        <CardHeader>
          <CardTitle>Key Dates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="psaSignedDate">PSA Signed Date</Label>
              <Input
                id="psaSignedDate"
                type="date"
                {...projectForm.register("psaSignedDate")}
                data-testid="input-psa-date"
              />
            </div>
            
            <div>
              <Label htmlFor="ddExpirationDate">DD Expiration Date</Label>
              <Input
                id="ddExpirationDate"
                type="date"
                {...projectForm.register("ddExpirationDate")}
                data-testid="input-dd-expiration"
              />
            </div>
            
            <div>
              <Label htmlFor="closingDate">Closing Date</Label>
              <Input
                id="closingDate"
                type="date"
                {...projectForm.register("closingDate")}
                data-testid="input-closing-date"
              />
            </div>
            
            {/* DD Timeline Calculation Fields */}
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-medium mb-3">DD Timeline Calculation</h4>
              
              <div>
                <Label htmlFor="ddPeriodDays">DD Period (Days)</Label>
                <Input
                  id="ddPeriodDays"
                  type="number"
                  min="1"
                  placeholder="e.g., 45"
                  {...projectForm.register("ddPeriodDays", { valueAsNumber: true })}
                  data-testid="input-dd-period-days"
                />
                {projectForm.formState.errors.ddPeriodDays && (
                  <p className="text-sm text-destructive mt-1">{projectForm.formState.errors.ddPeriodDays.message}</p>
                )}
              </div>
              
              <div className="flex items-center justify-between mt-4">
                <Label htmlFor="hasExtensions">Extensions?</Label>
                <Switch
                  id="hasExtensions"
                  checked={projectForm.watch("hasExtensions")}
                  onCheckedChange={(checked) => {
                    projectForm.setValue("hasExtensions", checked);
                    if (!checked) {
                      projectForm.setValue("extensionCount", 0);
                      projectForm.setValue("extensionDays", []);
                      setExtensionDaysArray([]);
                    }
                  }}
                  data-testid="switch-has-extensions"
                />
              </div>
              
              {projectForm.watch("hasExtensions") && (
                <div className="mt-4 space-y-3">
                  <div>
                    <Label htmlFor="extensionCount">Number of Extensions</Label>
                    <Input
                      id="extensionCount"
                      type="number"
                      min="0"
                      max="10"
                      placeholder="e.g., 2"
                      {...projectForm.register("extensionCount", { 
                        valueAsNumber: true,
                        onChange: (e) => {
                          const count = parseInt(e.target.value) || 0;
                          const newExtensionDays = Array(count).fill(0).map((_, i) => extensionDaysArray[i] || 0);
                          setExtensionDaysArray(newExtensionDays);
                          projectForm.setValue("extensionDays", newExtensionDays);
                        }
                      })}
                      data-testid="input-extension-count"
                    />
                  </div>
                  
                  {extensionDaysArray.map((days, index) => (
                    <div key={index}>
                      <Label htmlFor={`extensionDays-${index}`}>Extension {index + 1} (Days)</Label>
                      <Input
                        id={`extensionDays-${index}`}
                        type="number"
                        min="1"
                        placeholder="e.g., 15"
                        value={days || ""}
                        onChange={(e) => {
                          const newValue = parseInt(e.target.value) || 0;
                          const newArray = [...extensionDaysArray];
                          newArray[index] = newValue;
                          setExtensionDaysArray(newArray);
                          projectForm.setValue("extensionDays", newArray);
                        }}
                        data-testid={`input-extension-days-${index}`}
                      />
                    </div>
                  ))}
                </div>
              )}
              
              <div className="mt-4">
                <Label htmlFor="daysToClosing">Days from DD Expiration to Closing</Label>
                <Input
                  id="daysToClosing"
                  type="number"
                  min="1"
                  placeholder="e.g., 30"
                  {...projectForm.register("daysToClosing", { valueAsNumber: true })}
                  data-testid="input-days-to-closing"
                />
                {projectForm.formState.errors.daysToClosing && (
                  <p className="text-sm text-destructive mt-1">{projectForm.formState.errors.daysToClosing.message}</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Project Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={settingsForm.handleSubmit(onSettingsSubmit)} className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="useBusinessDays">Use Business Days</Label>
              <Switch
                id="useBusinessDays"
                checked={settingsForm.watch("useBusinessDays")}
                onCheckedChange={(checked) => settingsForm.setValue("useBusinessDays", checked)}
                data-testid="switch-business-days"
              />
            </div>
            
            <div>
              <Label htmlFor="holidayCalendar">Holiday Calendar</Label>
              <Select
                value={settingsForm.watch("holidayCalendar")}
                onValueChange={(value) => settingsForm.setValue("holidayCalendar", value as "us_federal" | "none")}
              >
                <SelectTrigger data-testid="select-holiday-calendar">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="us_federal">US Federal</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="tz">Project Timezone</Label>
              <Select
                value={projectForm.watch("tz")}
                onValueChange={(value) => projectForm.setValue("tz", value)}
              >
                <SelectTrigger data-testid="select-timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">Eastern Time</SelectItem>
                  <SelectItem value="America/Chicago">Central Time</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="emailReminders">Email Reminders</Label>
              <Switch
                id="emailReminders"
                checked={settingsForm.watch("emailReminders")}
                onCheckedChange={(checked) => settingsForm.setValue("emailReminders", checked)}
                data-testid="switch-email-reminders"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="slackNotifications">Slack Notifications</Label>
              <Switch
                id="slackNotifications"
                checked={settingsForm.watch("slackNotifications")}
                onCheckedChange={(checked) => settingsForm.setValue("slackNotifications", checked)}
                data-testid="switch-slack-notifications"
              />
            </div>
            
            <div>
              <Label htmlFor="slackWebhookUrl">Slack Webhook URL</Label>
              <Input
                id="slackWebhookUrl"
                type="url"
                {...settingsForm.register("slackWebhookUrl")}
                placeholder="https://hooks.slack.com/..."
                data-testid="input-slack-webhook"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="ndaRequired">NDA Required for Sharing</Label>
              <Switch
                id="ndaRequired"
                checked={settingsForm.watch("ndaRequired")}
                onCheckedChange={(checked) => settingsForm.setValue("ndaRequired", checked)}
                data-testid="switch-nda-required"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="lg:col-span-2 flex justify-end space-x-3">
        <Button variant="outline" data-testid="button-cancel">
          Cancel
        </Button>
        <Button 
          onClick={() => {
            projectForm.handleSubmit(onProjectSubmit)();
            settingsForm.handleSubmit(onSettingsSubmit)();
          }}
          data-testid="button-save-project"
        >
          Save Project
        </Button>
      </div>
    </div>
  );
}

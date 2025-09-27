import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { TestTube, Send, Mail, MessageSquare, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Contact, ProjectSettings } from "@shared/schema";

const testNotificationSchema = z.object({
  recipientType: z.enum(["contact", "email"]),
  recipientId: z.string().min(1, "Please select a recipient"),
  templateType: z.enum(["task_status", "deadline_upcoming", "deadline_today", "overdue", "note_added"]),
  customMessage: z.string().optional(),
});

type TestNotificationData = z.infer<typeof testNotificationSchema>;

interface NotificationTesterProps {
  projectId: string;
  contacts: Contact[];
  settings?: ProjectSettings | null;
}

const templateTypes = [
  { 
    value: "task_status", 
    label: "Task Status Change", 
    description: "Test notification for when a task status changes",
    icon: CheckCircle,
  },
  { 
    value: "deadline_upcoming", 
    label: "Deadline Approaching", 
    description: "Test notification for upcoming deadlines",
    icon: Clock,
  },
  { 
    value: "deadline_today", 
    label: "Due Today", 
    description: "Test notification for tasks due today",
    icon: AlertCircle,
  },
  { 
    value: "overdue", 
    label: "Overdue Task", 
    description: "Test notification for overdue tasks",
    icon: XCircle,
  },
  { 
    value: "note_added", 
    label: "Note Added", 
    description: "Test notification for when a note is added to a task",
    icon: MessageSquare,
  },
];

interface TestResult {
  id: string;
  recipientEmail: string;
  templateType: string;
  status: "sending" | "success" | "failed";
  timestamp: Date;
  error?: string;
}

export function NotificationTester({ projectId, contacts, settings }: NotificationTesterProps) {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const { toast } = useToast();

  const form = useForm<TestNotificationData>({
    resolver: zodResolver(testNotificationSchema),
    defaultValues: {
      recipientType: "contact",
      recipientId: "",
      templateType: "deadline_upcoming",
      customMessage: "",
    },
  });

  // Test notification mutation
  const testNotificationMutation = useMutation({
    mutationFn: async (data: TestNotificationData) => {
      let recipientEmail = "";
      
      if (data.recipientType === "contact") {
        const contact = contacts.find(c => c.id === data.recipientId);
        if (!contact) throw new Error("Contact not found");
        recipientEmail = contact.email;
      } else {
        recipientEmail = data.recipientId; // Direct email
      }

      // Add test result immediately with "sending" status
      const testId = Math.random().toString(36).substr(2, 9);
      setTestResults(prev => [...prev, {
        id: testId,
        recipientEmail,
        templateType: data.templateType,
        status: "sending",
        timestamp: new Date(),
      }]);

      const response = await apiRequest("POST", "/api/dd/test-notification", {
        projectId,
        recipientEmail,
        templateType: data.templateType,
        customMessage: data.customMessage,
      });

      return { testId, ...response.json() };
    },
    onSuccess: (result) => {
      setTestResults(prev => prev.map(test => 
        test.id === result.testId 
          ? { ...test, status: "success" }
          : test
      ));
      toast({
        title: "Test Sent",
        description: "Test notification sent successfully",
      });
    },
    onError: (error, variables) => {
      const failedEmail = variables.recipientType === "contact" 
        ? contacts.find(c => c.id === variables.recipientId)?.email || ""
        : variables.recipientId;
      
      setTestResults(prev => prev.map(test => 
        test.recipientEmail === failedEmail && test.status === "sending"
          ? { ...test, status: "failed", error: error.message }
          : test
      ));
      
      toast({
        title: "Test Failed",
        description: "Failed to send test notification",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: TestNotificationData) => {
    testNotificationMutation.mutate(data);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const getStatusIcon = (status: TestResult["status"]) => {
    switch (status) {
      case "sending":
        return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: TestResult["status"]) => {
    switch (status) {
      case "sending":
        return <Badge variant="secondary">Sending...</Badge>;
      case "success":
        return <Badge className="bg-green-100 text-green-800">Sent</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
    }
  };

  const recipientType = form.watch("recipientType");
  const selectedTemplate = form.watch("templateType");
  const currentTemplate = templateTypes.find(t => t.value === selectedTemplate);

  const notificationsEnabled = settings?.notificationsEnabled ?? true;

  return (
    <div className="space-y-8" data-testid="notification-tester">
      {!notificationsEnabled && (
        <Alert className="border-orange-200 bg-orange-50">
          <div className="p-1 bg-orange-100 rounded mr-3">
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </div>
          <AlertDescription className="text-base text-orange-800">
            Notifications are currently disabled for this project. You can still send test notifications, 
            but regular notifications won't be sent until you enable them in Project Settings.
          </AlertDescription>
        </Alert>
      )}

      {/* Test Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TestTube className="h-5 w-5" />
            <span>Send Test Notification</span>
          </CardTitle>
          <CardDescription>
            Send test notifications to verify your setup and preview how they'll look to recipients
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="recipientType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipient Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-recipient-type">
                            <SelectValue placeholder="Select recipient type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="contact">Existing Contact</SelectItem>
                          <SelectItem value="email">Custom Email</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="recipientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {recipientType === "contact" ? "Contact" : "Email Address"}
                      </FormLabel>
                      {recipientType === "contact" ? (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-contact">
                              <SelectValue placeholder="Select contact" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {contacts.map((contact) => (
                              <SelectItem key={contact.id} value={contact.id}>
                                {contact.name} ({contact.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <FormControl>
                          <input
                            type="email"
                            placeholder="test@example.com"
                            {...field}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            data-testid="input-custom-email"
                          />
                        </FormControl>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="templateType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notification Template</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-template-type">
                          <SelectValue placeholder="Select template" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {templateTypes.map((template) => (
                          <SelectItem key={template.value} value={template.value}>
                            <div className="flex items-center space-x-2">
                              <template.icon className="h-4 w-4" />
                              <span>{template.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {currentTemplate && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {currentTemplate.description}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom Message (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add a custom message to include in the test notification..."
                        {...field}
                        data-testid="textarea-custom-message"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end">
                <Button 
                  type="submit" 
                  disabled={testNotificationMutation.isPending}
                  data-testid="button-send-test"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {testNotificationMutation.isPending ? "Sending..." : "Send Test"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Test Results */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Mail className="h-5 w-5" />
                <span>Test Results</span>
                <Badge variant="outline">{testResults.length} tests</Badge>
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearResults}
                data-testid="button-clear-results"
              >
                Clear Results
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3" data-testid="test-results-list">
              {testResults.map((result) => {
                const template = templateTypes.find(t => t.value === result.templateType);
                return (
                  <div 
                    key={result.id} 
                    className="flex items-center justify-between p-3 border rounded-lg"
                    data-testid={`test-result-${result.id}`}
                  >
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(result.status)}
                      <div>
                        <div className="font-medium" data-testid={`result-email-${result.id}`}>
                          {result.recipientEmail}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {template?.label} • {result.timestamp.toLocaleTimeString()}
                        </div>
                        {result.error && (
                          <div className="text-sm text-red-600 mt-1" data-testid={`result-error-${result.id}`}>
                            Error: {result.error}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(result.status)}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Help Text */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Testing Guidelines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>• Test notifications will use sample data to demonstrate how real notifications will appear</p>
            <p>• Email delivery may take a few minutes depending on your email provider</p>
            <p>• Check spam/junk folders if test emails don't arrive in the inbox</p>
            <p>• Test notifications help verify your notification templates and delivery setup</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
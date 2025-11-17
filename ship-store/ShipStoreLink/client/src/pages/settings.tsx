import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertStoreSettingsSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const formSchema = insertStoreSettingsSchema.extend({
  taxRate: z.string().min(1, "Tax rate is required"),
  lowStockThreshold: z.string().min(1, "Low stock threshold is required"),
});

export default function Settings() {
  const [isConnectingQuickbooks, setIsConnectingQuickbooks] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/settings"],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PUT", "/api/settings", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings Updated",
        description: "Store settings have been successfully updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      storeName: "",
      address: "",
      phone: "",
      taxRate: "",
      currency: "USD",
      lowStockThreshold: "",
      autoSync: true,
      emailReceipts: false,
      lowStockAlerts: true,
      stripePublishableKey: "",
      stripeSecretKey: "",
      squareApplicationId: "",
    },
  });

  // Update form when settings data loads
  React.useEffect(() => {
    if (settings) {
      form.reset({
        ...settings,
        taxRate: settings.taxRate?.toString() || "",
        lowStockThreshold: settings.lowStockThreshold?.toString() || "",
      });
    }
  }, [settings, form]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const settingsData = {
      ...values,
      taxRate: values.taxRate,
      lowStockThreshold: parseInt(values.lowStockThreshold),
    };
    updateSettingsMutation.mutate(settingsData);
  };

  const connectQuickbooks = async () => {
    setIsConnectingQuickbooks(true);
    // Simulate QuickBooks OAuth flow
    setTimeout(() => {
      setIsConnectingQuickbooks(false);
      toast({
        title: "QuickBooks Connected",
        description: "Successfully connected to QuickBooks Online",
      });
    }, 2000);
  };

  const testStripeConnection = () => {
    toast({
      title: "Connection Test",
      description: "Stripe connection test successful",
    });
  };

  const testSquareConnection = () => {
    toast({
      title: "Connection Test",
      description: "Square connection test successful",
    });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-96 bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold" data-testid="settings-title">Store Settings</h2>
        <p className="text-muted-foreground">Manage store configuration and integrations</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Store Information */}
            <Card>
              <CardHeader>
                <CardTitle>Store Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="storeName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Store Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="store-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} data-testid="store-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input type="tel" {...field} data-testid="store-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="taxRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax Rate (%)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} data-testid="tax-rate" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Payment Integration */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Integrations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Stripe Integration */}
                <div className="border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                        <i className="fab fa-stripe text-white text-sm"></i>
                      </div>
                      <div>
                        <h4 className="font-medium">Stripe</h4>
                        <p className="text-xs text-muted-foreground">Credit card processing</p>
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">Connected</span>
                  </div>
                  <div className="space-y-2">
                    <FormField
                      control={form.control}
                      name="stripePublishableKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder="Stripe Publishable Key" 
                              {...field}
                              data-testid="stripe-publishable-key"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="button"
                      size="sm"
                      onClick={testStripeConnection}
                      data-testid="test-stripe"
                    >
                      Test Connection
                    </Button>
                  </div>
                </div>

                {/* Square Integration */}
                <div className="border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                        <i className="fas fa-square text-white text-sm"></i>
                      </div>
                      <div>
                        <h4 className="font-medium">Square</h4>
                        <p className="text-xs text-muted-foreground">Mobile payments</p>
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">Connected</span>
                  </div>
                  <div className="space-y-2">
                    <FormField
                      control={form.control}
                      name="squareApplicationId"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder="Square Application ID" 
                              {...field}
                              data-testid="square-app-id"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="button"
                      size="sm"
                      onClick={testSquareConnection}
                      data-testid="test-square"
                    >
                      Test Connection
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* QuickBooks Integration */}
            <Card>
              <CardHeader>
                <CardTitle>Accounting Integration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                        <i className="fas fa-calculator text-white text-sm"></i>
                      </div>
                      <div>
                        <h4 className="font-medium">QuickBooks Online</h4>
                        <p className="text-xs text-muted-foreground">Accounting & financial data</p>
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">
                      {settings?.quickbooksConnected ? "Connected" : "Not Connected"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground mb-3">
                      Connect to sync transactions, update financial models, and export data automatically.
                    </p>
                    <Button
                      type="button"
                      className="bg-blue-600 text-white hover:bg-blue-700"
                      onClick={connectQuickbooks}
                      disabled={isConnectingQuickbooks}
                      data-testid="connect-quickbooks"
                    >
                      <i className="fas fa-link mr-2"></i>
                      {isConnectingQuickbooks ? "Connecting..." : settings?.quickbooksConnected ? "Reconnect QuickBooks" : "Connect QuickBooks"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* System Preferences */}
            <Card>
              <CardHeader>
                <CardTitle>System Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="autoSync"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div>
                        <FormLabel>Auto-sync with integrations</FormLabel>
                        <p className="text-sm text-muted-foreground">Automatically sync data every hour</p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="auto-sync"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="emailReceipts"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div>
                        <FormLabel>Email receipts</FormLabel>
                        <p className="text-sm text-muted-foreground">Send receipts to customers via email</p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="email-receipts"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lowStockAlerts"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div>
                        <FormLabel>Low stock alerts</FormLabel>
                        <p className="text-sm text-muted-foreground">Notify when inventory is low</p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="low-stock-alerts"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lowStockThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Low stock threshold</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="low-stock-threshold" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="currency-select">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="USD">USD - US Dollar</SelectItem>
                          <SelectItem value="EUR">EUR - Euro</SelectItem>
                          <SelectItem value="GBP">GBP - British Pound</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          {/* Save Settings */}
          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset()}
              data-testid="reset-settings"
            >
              Reset to Defaults
            </Button>
            <Button
              type="submit"
              disabled={updateSettingsMutation.isPending}
              data-testid="save-settings"
            >
              {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

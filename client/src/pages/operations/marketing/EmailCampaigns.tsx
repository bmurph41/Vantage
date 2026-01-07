import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Mail, 
  Check, 
  X, 
  ExternalLink, 
  RefreshCw, 
  Users, 
  Send, 
  Calendar,
  TrendingUp,
  AlertCircle,
  Loader2,
  Link2Off
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface Provider {
  slug: string;
  displayName: string;
  description: string;
  connected: boolean;
  configured: boolean;
  comingSoon?: boolean;
  connection?: {
    accountLabel?: string;
    expiresAt?: string;
    lastSyncAt?: string;
  };
}

interface CCStatus {
  connected: boolean;
  accountLabel?: string;
  expiresAt?: string;
  lastSyncAt?: string;
  needsRefresh?: boolean;
}

interface CCList {
  id: string;
  name: string;
  contactCount: number;
}

interface CCCampaign {
  id: string;
  name: string;
  status: string;
  subject?: string;
  sentAt?: string;
  createdAt: string;
}

interface Lead {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  source: string;
  syncStatus: string;
  createdAt: string;
}

export default function EmailCampaigns() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [selectedListId, setSelectedListId] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "constant_contact") {
      toast({
        title: "Connected!",
        description: "Successfully connected to Constant Contact.",
      });
      window.history.replaceState({}, "", window.location.pathname + "?tab=email-campaigns");
      queryClient.invalidateQueries({ queryKey: ["/api/email-marketing"] });
    }
    if (params.get("error")) {
      toast({
        title: "Connection Failed",
        description: "Failed to connect to Constant Contact. Please try again.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", window.location.pathname + "?tab=email-campaigns");
    }
  }, [toast]);

  const { data: providers, isLoading: providersLoading } = useQuery<Provider[]>({
    queryKey: ["/api/email-marketing/providers"],
  });

  const { data: ccStatus, isLoading: ccStatusLoading } = useQuery<CCStatus>({
    queryKey: ["/api/email-marketing/constant-contact/status"],
  });

  const { data: ccLists, isLoading: ccListsLoading } = useQuery<CCList[]>({
    queryKey: ["/api/email-marketing/constant-contact/lists"],
    enabled: ccStatus?.connected === true,
  });

  const { data: ccCampaigns, isLoading: ccCampaignsLoading } = useQuery<CCCampaign[]>({
    queryKey: ["/api/email-marketing/constant-contact/campaigns"],
    enabled: ccStatus?.connected === true,
  });

  const { data: leads, isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ["/api/email-marketing/leads"],
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/email-marketing/constant-contact/auth");
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error(data.message || "Failed to generate auth URL");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Connection Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("/api/email-marketing/constant-contact/disconnect", { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-marketing"] });
      toast({
        title: "Disconnected",
        description: "Constant Contact has been disconnected.",
      });
    },
  });

  const subscribeMutation = useMutation({
    mutationFn: async (data: { email: string; firstName?: string; lastName?: string; listIds: string[] }) => {
      return apiRequest("/api/email-marketing/constant-contact/subscribe", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      toast({
        title: "Contact Added",
        description: "Contact has been added to the selected list.",
      });
      setEmail("");
      setFirstName("");
      setLastName("");
      setSelectedListId("");
      queryClient.invalidateQueries({ queryKey: ["/api/email-marketing/leads"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add Contact",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !selectedListId) {
      toast({
        title: "Missing Information",
        description: "Please enter an email and select a list.",
        variant: "destructive",
      });
      return;
    }
    subscribeMutation.mutate({
      email,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      listIds: [selectedListId],
    });
  };

  const ccProvider = providers?.find(p => p.slug === "constant_contact");
  const isConnected = ccStatus?.connected === true;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="page-title">Email Campaigns</h1>
          <p className="text-muted-foreground mt-1">
            Connect email marketing platforms to sync contacts and track campaigns
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Mail className="w-5 h-5 text-blue-600" />
                <CardTitle>Constant Contact</CardTitle>
              </div>
              {isConnected ? (
                <Badge variant="default" className="bg-green-100 text-green-800" data-testid="badge-cc-connected">
                  <Check className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" data-testid="badge-cc-disconnected">
                  <X className="w-3 h-3 mr-1" />
                  Not Connected
                </Badge>
              )}
            </div>
            <CardDescription>
              Professional email marketing, automation, and list management
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {ccStatusLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : isConnected ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Account:</span>
                  <span className="font-medium">{ccStatus?.accountLabel || "Connected Account"}</span>
                </div>
                {ccStatus?.expiresAt && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Token Expires:</span>
                    <span className={ccStatus.needsRefresh ? "text-amber-600" : ""}>
                      {formatDistanceToNow(new Date(ccStatus.expiresAt), { addSuffix: true })}
                    </span>
                  </div>
                )}
                {ccLists && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Contact Lists:</span>
                    <span className="font-medium">{ccLists.length}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground space-y-2">
                <p>Connect Constant Contact to:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Sync contacts from MarinaMatch leads</li>
                  <li>Track email campaign performance</li>
                  <li>Manage subscriber lists</li>
                </ul>
              </div>
            )}
          </CardContent>
          <CardFooter>
            {isConnected ? (
              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/email-marketing"] })}
                  data-testid="btn-refresh-cc"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Refresh
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  data-testid="btn-disconnect-cc"
                >
                  <Link2Off className="w-4 h-4 mr-1" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending || !ccProvider?.configured}
                className="w-full"
                data-testid="btn-connect-cc"
              >
                {connectMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4 mr-2" />
                )}
                {ccProvider?.configured ? "Connect Constant Contact" : "API Keys Required"}
              </Button>
            )}
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Mail className="w-5 h-5 text-yellow-600" />
              <CardTitle>Mailchimp</CardTitle>
            </div>
            <CardDescription>
              All-in-one marketing platform for growing businesses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <AlertCircle className="w-4 h-4" />
              <span>Coming soon - integration in development</span>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" disabled className="w-full" data-testid="btn-connect-mailchimp">
              Coming Soon
            </Button>
          </CardFooter>
        </Card>
      </div>

      {isConnected && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-primary" />
                <CardTitle>Add Contact to List</CardTitle>
              </div>
              <CardDescription>
                Capture leads and sync them directly to Constant Contact
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubscribe} className="grid gap-4 md:grid-cols-5">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="contact@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    placeholder="John"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    data-testid="input-first-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    data-testid="input-last-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="list">Contact List *</Label>
                  <Select value={selectedListId} onValueChange={setSelectedListId}>
                    <SelectTrigger id="list" data-testid="select-list">
                      <SelectValue placeholder="Select a list" />
                    </SelectTrigger>
                    <SelectContent>
                      {ccListsLoading ? (
                        <div className="p-2 text-sm text-muted-foreground">Loading lists...</div>
                      ) : ccLists?.length ? (
                        ccLists.map((list) => (
                          <SelectItem key={list.id} value={list.id}>
                            {list.name} ({list.contactCount} contacts)
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-sm text-muted-foreground">No lists available</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    type="submit"
                    disabled={subscribeMutation.isPending || !email || !selectedListId}
                    className="w-full"
                    data-testid="btn-subscribe"
                  >
                    {subscribeMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Add Contact
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <CardTitle>Recent Campaigns</CardTitle>
                </div>
                <CardDescription>
                  Email campaigns from your Constant Contact account
                </CardDescription>
              </CardHeader>
              <CardContent>
                {ccCampaignsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    ))}
                  </div>
                ) : ccCampaigns?.length ? (
                  <div className="space-y-3">
                    {ccCampaigns.slice(0, 5).map((campaign) => (
                      <div key={campaign.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                        <div>
                          <p className="font-medium text-sm">{campaign.name}</p>
                          {campaign.subject && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {campaign.subject}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <Badge variant={campaign.status === "SENT" ? "default" : "secondary"} className="text-xs">
                            {campaign.status}
                          </Badge>
                          {campaign.sentAt && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(campaign.sentAt), "MMM d, yyyy")}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No campaigns found
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-primary" />
                  <CardTitle>Recent Leads</CardTitle>
                </div>
                <CardDescription>
                  Contacts added through MarinaMatch
                </CardDescription>
              </CardHeader>
              <CardContent>
                {leadsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    ))}
                  </div>
                ) : leads?.length ? (
                  <div className="space-y-3">
                    {leads.slice(0, 5).map((lead) => (
                      <div key={lead.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                        <div>
                          <p className="font-medium text-sm">{lead.email}</p>
                          {(lead.firstName || lead.lastName) && (
                            <p className="text-xs text-muted-foreground">
                              {[lead.firstName, lead.lastName].filter(Boolean).join(" ")}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <Badge
                            variant={lead.syncStatus === "synced" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {lead.syncStatus === "synced" ? "Synced" : "Pending"}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No leads captured yet
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {!isConnected && !ccStatusLoading && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Connect Your Email Platform</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Connect Constant Contact to start syncing contacts, managing lists, and tracking campaign performance directly from MarinaMatch.
            </p>
            <Button
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending || !ccProvider?.configured}
              data-testid="btn-connect-cc-cta"
            >
              {connectMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4 mr-2" />
              )}
              Get Started with Constant Contact
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

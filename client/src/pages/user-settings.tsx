import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  User, Mail, Calendar, HelpCircle, RotateCcw, Play, CheckCircle2,
  Shield, Info, Save, Phone, Globe, Bell, Lock, Smartphone, Monitor,
  Clock, MapPin, Key, AlertTriangle, Activity, Trash2, Plus, Settings,
  LogOut, ChevronRight, Eye, EyeOff, Building,
} from "lucide-react";
import { useLocation } from "wouter";
import { EmailManagement } from "@/components/email-management";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { TOUR_IDS } from "@/lib/tour-configs";
import { useAuth } from "@/contexts/AuthContext";

// ── Constants ──────────────────────────────────────────────────────────────────

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Anchorage", label: "Alaska (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii (HT)" },
  { value: "UTC", label: "UTC" },
];

const CALENDAR_PROVIDERS = [
  { value: "google", label: "Google Calendar", icon: "📅" },
  { value: "outlook", label: "Outlook", icon: "📧" },
  { value: "apple", label: "Apple Calendar", icon: "🍎" },
];

const TOUR_INFO = [
  { id: TOUR_IDS.DASHBOARD, name: "Dashboard", description: "Overview of your portfolio and pipeline", route: "/" },
  { id: TOUR_IDS.DEALS, name: "CRM Deals", description: "Manage your deal pipeline", route: "/deals" },
  { id: TOUR_IDS.DOCKET, name: "The Docket", description: "M&A intelligence feed", route: "/docket" },
  { id: TOUR_IDS.FUEL_SALES, name: "Fuel Sales", description: "Track fuel operations", route: "/operations/fuel" },
  { id: TOUR_IDS.SHIP_STORE, name: "Ship Store", description: "Retail inventory tracking", route: "/operations/ship-store" },
  { id: TOUR_IDS.COMMERCIAL_TENANTS, name: "Commercial Tenants", description: "Lease management", route: "/operations/commercial-tenants" },
  { id: TOUR_IDS.VDR, name: "Virtual Data Room", description: "Secure document storage", route: "/vdr" },
  { id: TOUR_IDS.RENT_ROLL, name: "Rent Roll", description: "Lease tracking and analysis", route: "/operations/rent-roll" },
  { id: TOUR_IDS.VALUATOR, name: "Financial Model", description: "Financial modeling", route: "/modeling" },
  { id: TOUR_IDS.SALES_COMPS, name: "Sales Comps", description: "Comparable sales analysis", route: "/analysis/sales-comps" },
];

const QUICK_START_GUIDES = [
  { title: "Getting Started", description: "Navigate the dashboard and set up your workspace", icon: "compass", link: "/" },
  { title: "CRM & Deal Pipeline", description: "Add deals, manage contacts, and track your pipeline", icon: "briefcase", link: "/deals" },
  { title: "Rent Roll & Operations", description: "Lease tracking, occupancy analysis, and NOI reporting", icon: "building", link: "/operations/rent-roll" },
  { title: "Financial Modeling", description: "Pro Forma, DCF, Monte Carlo, and exit analysis", icon: "calculator", link: "/modeling" },
];

const ROLE_BADGE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
  owner: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  investor: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  broker: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
  appraiser: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800",
  editor: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800",
  viewer: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-800",
  auditor: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
};

const AVATAR_GRADIENTS: Record<string, string> = {
  admin: "from-purple-500 to-purple-700",
  owner: "from-blue-500 to-blue-700",
  investor: "from-green-500 to-green-700",
  broker: "from-orange-500 to-orange-700",
  appraiser: "from-teal-500 to-teal-700",
  editor: "from-indigo-500 to-indigo-700",
  viewer: "from-gray-500 to-gray-700",
  auditor: "from-amber-500 to-amber-700",
};

type SectionId = "profile" | "security" | "emails" | "notifications" | "calendar" | "sessions" | "privacy" | "tours";

const SIDEBAR_SECTIONS: { id: SectionId; label: string; icon: React.ElementType }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "security", label: "Security", icon: Lock },
  { id: "emails", label: "Emails", icon: Mail },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "sessions", label: "Sessions", icon: Monitor },
  { id: "privacy", label: "Privacy", icon: Shield },
  { id: "tours", label: "Tours & Help", icon: HelpCircle },
];

const NOTIFICATION_CATEGORIES = [
  {
    id: "deals",
    label: "Deal Updates",
    description: "New deal, status change, closing alerts",
    icon: Activity,
  },
  {
    id: "crm",
    label: "CRM Activity",
    description: "New contact, task due, meeting reminders",
    icon: User,
  },
  {
    id: "financial",
    label: "Financial",
    description: "Model updates, valuation changes, report ready",
    icon: Building,
  },
  {
    id: "operations",
    label: "Operations",
    description: "Rent roll changes, fuel alerts, maintenance",
    icon: Settings,
  },
  {
    id: "system",
    label: "System",
    description: "Security alerts, account changes, announcements",
    icon: AlertTriangle,
  },
];

const ASSET_CLASS_OPTIONS = [
  "Full-Service Marina",
  "Dry Storage",
  "Fuel Dock",
  "Boatyard",
  "Mixed-Use Waterfront",
  "RV / Campground",
  "Yacht Club",
  "Commercial Port",
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score += 25;
  if (pw.length >= 12) score += 10;
  if (/[A-Z]/.test(pw)) score += 15;
  if (/[a-z]/.test(pw)) score += 15;
  if (/\d/.test(pw)) score += 15;
  if (/[^A-Za-z0-9]/.test(pw)) score += 20;
  if (score < 30) return { score, label: "Weak", color: "bg-red-500" };
  if (score < 60) return { score, label: "Fair", color: "bg-yellow-500" };
  if (score < 80) return { score, label: "Good", color: "bg-blue-500" };
  return { score: Math.min(score, 100), label: "Strong", color: "bg-green-500" };
}

function formatRelativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return d.toLocaleDateString();
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function UserSettingsPage() {
  const [, setLocation] = useLocation();
  const [activeSection, setActiveSection] = useState<SectionId>("profile");
  const { toast } = useToast();
  const { user: authUser } = useAuth();

  // ── Profile State ──────────────────────────────────────────────────────────
  const [profileName, setProfileName] = useState("");
  const [profileTz, setProfileTz] = useState("America/New_York");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileCompany, setProfileCompany] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [selectedAssetClasses, setSelectedAssetClasses] = useState<string[]>([]);

  // ── Notification State ─────────────────────────────────────────────────────
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [inAppNotifications, setInAppNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [notifCategories, setNotifCategories] = useState<Record<string, { email: boolean; inApp: boolean; sms: boolean }>>(() => {
    const defaults: Record<string, { email: boolean; inApp: boolean; sms: boolean }> = {};
    NOTIFICATION_CATEGORIES.forEach((cat) => {
      defaults[cat.id] = { email: true, inApp: true, sms: false };
    });
    return defaults;
  });
  const [digestPreference, setDigestPreference] = useState("realtime");
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState("22:00");
  const [quietHoursEnd, setQuietHoursEnd] = useState("07:00");

  // ── Calendar State ─────────────────────────────────────────────────────────
  const [calendarProvider, setCalendarProvider] = useState<string>("");
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(true);

  // ── Security State ─────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [showTokenDialog, setShowTokenDialog] = useState(false);

  // ── Session Dialogs ────────────────────────────────────────────────────────
  const [revokeSessionId, setRevokeSessionId] = useState<string | null>(null);
  const [showRevokeAllDialog, setShowRevokeAllDialog] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: settingsData, isLoading: isLoadingSettings } = useQuery<{
    settings: any;
    profile: {
      id: string;
      email: string;
      name: string;
      role: string;
      orgId: string;
      mfaEnabled: boolean;
      emailVerified: boolean;
      createdAt?: string;
      phone?: string;
      company?: string;
      bio?: string;
      assetClasses?: string[];
    };
    organization: any;
  }>({
    queryKey: ["/api/settings/me"],
  });

  const { data: userEmails = [], isLoading: isLoadingEmails } = useQuery({
    queryKey: ["/api/user/emails"],
  });

  const { data: tourProgress } = useQuery<{ tours: Record<string, boolean> }>({
    queryKey: ["/api/tour-progress"],
  });

  const { data: benchmarkingSettings, isLoading: isLoadingBenchmarking } = useQuery<{
    benchmarkOptIn: boolean;
    benchmarkingOptOut: boolean;
    dataBenchmarkingConsent: boolean;
    consentTimestamp: string | null;
    consentVersion: string | null;
  }>({
    queryKey: ["/api/benchmarking/settings"],
  });

  const { data: sessionsData, isLoading: isLoadingSessions } = useQuery<any[]>({
    queryKey: ["/api/settings/sessions"],
  });

  const { data: auditLogData, isLoading: isLoadingAudit } = useQuery<any[]>({
    queryKey: ["/api/auth/security/audit-log"],
  });

  // ── Derived ────────────────────────────────────────────────────────────────

  const completedTours = tourProgress?.tours || {};
  const typedEmails = Array.isArray(userEmails) ? userEmails : [];
  const sessions = Array.isArray(sessionsData) ? sessionsData : [];
  const auditLog = Array.isArray(auditLogData) ? auditLogData : [];
  const userRole = settingsData?.profile?.role || authUser?.role || "viewer";
  const userName = settingsData?.profile?.name || authUser?.name || "";
  const userEmail = settingsData?.profile?.email || authUser?.email || "";
  const memberSince = (settingsData?.profile as any)?.createdAt;
  const orgName = settingsData?.organization?.name || authUser?.orgName || "";
  const pwStrength = useMemo(() => passwordStrength(newPassword), [newPassword]);

  // ── Initialize state from fetched data ─────────────────────────────────────

  useEffect(() => {
    if (settingsData) {
      const p = settingsData.profile as any;
      setProfileName(p?.name || "");
      setProfilePhone(p?.phone || "");
      setProfileTz(p?.tz || settingsData.settings?.timezone || "America/New_York");
      setProfileCompany(p?.company || settingsData.organization?.name || "");
      setProfileBio(p?.bio || "");
      setSelectedAssetClasses(p?.assetClasses || []);
      setCalendarProvider(p?.defaultCalendarProvider || "");
      setCalendarSyncEnabled(p?.calendarSyncEnabled ?? true);
      setMfaEnabled(p?.mfaEnabled ?? false);
      const notifPrefs = settingsData.settings?.notificationPreferences?.channels;
      if (notifPrefs) {
        setEmailNotifications(notifPrefs.email ?? true);
        setInAppNotifications(notifPrefs.inApp ?? true);
        setSmsNotifications(notifPrefs.sms ?? false);
      }
      const catPrefs = settingsData.settings?.notificationPreferences?.categories;
      if (catPrefs) {
        setNotifCategories((prev) => ({ ...prev, ...catPrefs }));
      }
      const digest = settingsData.settings?.notificationPreferences?.digestPreference;
      if (digest) setDigestPreference(digest);
      const qh = settingsData.settings?.notificationPreferences?.quietHours;
      if (qh) {
        setQuietHoursEnabled(qh.enabled ?? false);
        setQuietHoursStart(qh.start || "22:00");
        setQuietHoursEnd(qh.end || "07:00");
      }
    }
  }, [settingsData]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const profileMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      await apiRequest("PATCH", "/api/user/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/me"] });
      toast({ title: "Profile updated", description: "Your changes have been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update profile.", variant: "destructive" });
    },
  });

  const notificationMutation = useMutation({
    mutationFn: async (channels: { inApp: boolean; email: boolean; sms: boolean }) => {
      await apiRequest("PUT", "/api/settings/me", {
        notificationPreferences: {
          channels,
          categories: notifCategories,
          digestPreference,
          quietHours: {
            enabled: quietHoursEnabled,
            start: quietHoursStart,
            end: quietHoursEnd,
          },
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/me"] });
      toast({ title: "Preferences saved", description: "Notification preferences updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update notification preferences.", variant: "destructive" });
    },
  });

  const updateBenchmarkingMutation = useMutation({
    mutationFn: async (benchmarkingOptOut: boolean) => {
      const response = await apiRequest("PATCH", "/api/benchmarking/settings", {
        benchmarkingOptOut,
        benchmarkOptIn: !benchmarkingOptOut,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/benchmarking/settings"] });
      toast({ title: "Settings updated", description: "Your privacy preferences have been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update privacy settings. Please try again.", variant: "destructive" });
    },
  });

  const resetTourMutation = useMutation({
    mutationFn: async (tourId: string) => {
      await apiRequest("DELETE", `/api/tour-progress/${tourId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tour-progress"] });
      toast({ title: "Tour reset", description: "You'll see this tour again when you visit the page." });
    },
  });

  const resetAllToursMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/tour-progress");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tour-progress"] });
      toast({ title: "All tours reset", description: "Page tours will show again when you visit each page." });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      await apiRequest("POST", "/api/auth/change-password", data);
    },
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password changed", description: "Your password has been updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to change password. Check your current password and try again.", variant: "destructive" });
    },
  });

  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await apiRequest("DELETE", `/api/settings/sessions/${sessionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/sessions"] });
      setRevokeSessionId(null);
      toast({ title: "Session revoked", description: "The session has been terminated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to revoke session.", variant: "destructive" });
    },
  });

  const revokeAllSessionsMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/settings/sessions/revoke-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/sessions"] });
      setShowRevokeAllDialog(false);
      toast({ title: "All sessions revoked", description: "All other sessions have been terminated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to revoke sessions.", variant: "destructive" });
    },
  });

  // ── Notification category toggle helper ────────────────────────────────────

  function toggleCategoryChannel(catId: string, channel: "email" | "inApp" | "sms") {
    setNotifCategories((prev) => ({
      ...prev,
      [catId]: {
        ...prev[catId],
        [channel]: !prev[catId]?.[channel],
      },
    }));
  }

  function toggleAssetClass(cls: string) {
    setSelectedAssetClasses((prev) =>
      prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls]
    );
  }

  // ── Role-specific quick stats ──────────────────────────────────────────────

  function renderRoleStats() {
    switch (userRole) {
      case "investor":
        return (
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-border bg-muted/30">
              <p className="text-xs text-muted-foreground">Active Investments</p>
              <p className="text-lg font-semibold text-foreground">--</p>
            </div>
            <div className="p-3 rounded-lg border border-border bg-muted/30">
              <p className="text-xs text-muted-foreground">Total AUM</p>
              <p className="text-lg font-semibold text-foreground">--</p>
            </div>
          </div>
        );
      case "broker":
        return (
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-border bg-muted/30">
              <p className="text-xs text-muted-foreground">Active Listings</p>
              <p className="text-lg font-semibold text-foreground">--</p>
            </div>
            <div className="p-3 rounded-lg border border-border bg-muted/30">
              <p className="text-xs text-muted-foreground">Recent Closings</p>
              <p className="text-lg font-semibold text-foreground">--</p>
            </div>
          </div>
        );
      case "admin":
      case "owner":
        return (
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-border bg-muted/30">
              <p className="text-xs text-muted-foreground">Team Members</p>
              <p className="text-lg font-semibold text-foreground">--</p>
            </div>
            <div className="p-3 rounded-lg border border-border bg-muted/30">
              <p className="text-xs text-muted-foreground">Active Projects</p>
              <p className="text-lg font-semibold text-foreground">--</p>
            </div>
          </div>
        );
      default:
        return (
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-border bg-muted/30">
              <p className="text-xs text-muted-foreground">Recent Items</p>
              <p className="text-lg font-semibold text-foreground">--</p>
            </div>
            <div className="p-3 rounded-lg border border-border bg-muted/30">
              <p className="text-xs text-muted-foreground">Last Active</p>
              <p className="text-lg font-semibold text-foreground">Today</p>
            </div>
          </div>
        );
    }
  }

  function roleStatsTitle() {
    switch (userRole) {
      case "investor": return "Portfolio Overview";
      case "broker": return "Deal Activity";
      case "admin":
      case "owner": return "Organization";
      default: return "Activity";
    }
  }

  // ── Section renderers ──────────────────────────────────────────────────────

  function renderProfile() {
    return (
      <div className="space-y-6">
        {/* Avatar and basic info header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-6">
              <div className={`h-20 w-20 rounded-full bg-gradient-to-br ${AVATAR_GRADIENTS[userRole] || AVATAR_GRADIENTS.viewer} flex items-center justify-center flex-shrink-0`}>
                <span className="text-2xl font-bold text-white">{getInitials(profileName || userName)}</span>
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <h2 className="text-xl font-semibold text-foreground truncate">{profileName || userName || "User"}</h2>
                <p className="text-sm text-muted-foreground">{userEmail}</p>
                <div className="flex items-center gap-2 pt-1">
                  <Badge variant="outline" className={`text-xs ${ROLE_BADGE_COLORS[userRole] || ROLE_BADGE_COLORS.viewer}`}>
                    {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                  </Badge>
                  {orgName && (
                    <Badge variant="secondary" className="text-xs">
                      <Building className="h-3 w-3 mr-1" />
                      {orgName}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Role-specific quick stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              {roleStatsTitle()}
            </CardTitle>
          </CardHeader>
          <CardContent>{renderRoleStats()}</CardContent>
        </Card>

        {/* Editable profile fields */}
        <Card data-testid="card-profile-settings">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="text-profile-title">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <CardDescription data-testid="text-profile-description">
              Manage your account information and preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Your display name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailReadonly">Email</Label>
                  <Input id="emailReadonly" value={userEmail} readOnly className="bg-muted/50 cursor-not-allowed" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">
                    <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Phone Number</span>
                  </Label>
                  <Input
                    id="phone"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    type="tel"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">
                    <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Timezone</span>
                  </Label>
                  <Select value={profileTz} onValueChange={setProfileTz}>
                    <SelectTrigger id="timezone">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="company">
                    <span className="flex items-center gap-1.5"><Building className="h-3.5 w-3.5" /> Company / Organization</span>
                  </Label>
                  <Input
                    id="company"
                    value={profileCompany}
                    onChange={(e) => setProfileCompany(e.target.value)}
                    placeholder="Your organization name"
                  />
                </div>
              </div>

              <Separator />

              {/* Asset class interests */}
              <div className="space-y-3">
                <Label>Asset Class Interests</Label>
                <p className="text-sm text-muted-foreground">Select the asset classes you track or invest in</p>
                <div className="flex flex-wrap gap-2">
                  {ASSET_CLASS_OPTIONS.map((cls) => (
                    <Badge
                      key={cls}
                      variant={selectedAssetClasses.includes(cls) ? "default" : "outline"}
                      className="cursor-pointer transition-colors hover:opacity-80"
                      onClick={() => toggleAssetClass(cls)}
                    >
                      {cls}
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Bio */}
              <div className="space-y-2">
                <Label htmlFor="bio">Bio / Notes</Label>
                <Textarea
                  id="bio"
                  value={profileBio}
                  onChange={(e) => setProfileBio(e.target.value)}
                  placeholder="Tell us a bit about yourself or add any notes..."
                  rows={4}
                />
              </div>

              <Button
                onClick={() =>
                  profileMutation.mutate({
                    name: profileName,
                    tz: profileTz,
                    phone: profilePhone,
                    company: profileCompany,
                    bio: profileBio,
                    assetClasses: selectedAssetClasses,
                  })
                }
                disabled={profileMutation.isPending}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {profileMutation.isPending ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  function renderSecurity() {
    return (
      <div className="space-y-6">
        {/* Change password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Change Password
            </CardTitle>
            <CardDescription>Update your account password. Use a strong, unique password.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPw ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                  >
                    {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setShowNewPw(!showNewPw)}
                  >
                    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {newPassword && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${pwStrength.color}`}
                          style={{ width: `${pwStrength.score}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">{pwStrength.label}</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPw ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setShowConfirmPw(!showConfirmPw)}
                  >
                    {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-destructive">Passwords do not match</p>
                )}
              </div>
              <Button
                onClick={() => {
                  if (!currentPassword || !newPassword) {
                    toast({ title: "Missing fields", description: "Please fill in all password fields.", variant: "destructive" });
                    return;
                  }
                  if (newPassword !== confirmPassword) {
                    toast({ title: "Mismatch", description: "New passwords do not match.", variant: "destructive" });
                    return;
                  }
                  changePasswordMutation.mutate({ currentPassword, newPassword });
                }}
                disabled={changePasswordMutation.isPending || !currentPassword || !newPassword || newPassword !== confirmPassword}
                className="gap-2"
              >
                <Lock className="h-4 w-4" />
                {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* MFA */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Multi-Factor Authentication
            </CardTitle>
            <CardDescription>Add an extra layer of security to your account</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border border-border rounded-lg">
              <div>
                <h4 className="font-medium text-foreground">MFA Status</h4>
                <p className="text-sm text-muted-foreground">
                  {mfaEnabled ? "Multi-factor authentication is enabled" : "Multi-factor authentication is disabled"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={mfaEnabled ? "default" : "secondary"}>
                  {mfaEnabled ? "Enabled" : "Disabled"}
                </Badge>
                <Switch
                  checked={mfaEnabled}
                  onCheckedChange={(checked) => {
                    setMfaEnabled(checked);
                    profileMutation.mutate({ mfaEnabled: checked });
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Tokens */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  API Tokens
                </CardTitle>
                <CardDescription>Manage API tokens for programmatic access</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowTokenDialog(true)}>
                <Plus className="h-4 w-4" />
                Create Token
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-sm text-muted-foreground">
              <Key className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>No API tokens created yet.</p>
              <p className="text-xs mt-1">Create a token to access the API programmatically.</p>
            </div>
          </CardContent>
        </Card>

        {/* Recent security events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Recent Security Events
            </CardTitle>
            <CardDescription>Login attempts, password changes, and other security-related activity</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingAudit ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded-lg bg-muted/50 animate-pulse" />
                ))}
              </div>
            ) : auditLog.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <Shield className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>No recent security events.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {auditLog.slice(0, 10).map((event: any, idx: number) => (
                  <div key={event.id || idx} className="flex items-center justify-between p-3 border border-border rounded-lg text-sm">
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full flex-shrink-0 ${event.success !== false ? "bg-green-500" : "bg-red-500"}`} />
                      <div>
                        <p className="font-medium text-foreground">{event.action || event.type || "Security event"}</p>
                        <p className="text-xs text-muted-foreground">
                          {event.ip && `IP: ${event.ip}`}
                          {event.ip && event.userAgent && " - "}
                          {event.userAgent && event.userAgent.substring(0, 60)}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {event.createdAt ? formatRelativeTime(event.createdAt) : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Token creation dialog */}
        <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create API Token</DialogTitle>
              <DialogDescription>Create a new API token for programmatic access. The token will only be shown once.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="tokenName">Token Name</Label>
                <Input
                  id="tokenName"
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                  placeholder="e.g., CI/CD Pipeline"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTokenDialog(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  toast({ title: "Token created", description: "Your new API token has been generated." });
                  setShowTokenDialog(false);
                  setNewTokenName("");
                }}
                disabled={!newTokenName.trim()}
              >
                Create Token
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  function renderEmails() {
    return (
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
              {typedEmails.length} email{typedEmails.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <EmailManagement emails={typedEmails} isLoading={isLoadingEmails} />
        </CardContent>
      </Card>
    );
  }

  function renderNotifications() {
    return (
      <div className="space-y-6">
        {/* Channel toggles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Channels
            </CardTitle>
            <CardDescription>Choose how you receive notifications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <h4 className="font-medium text-foreground text-sm">Email Notifications</h4>
                    <p className="text-xs text-muted-foreground">Receive updates via email</p>
                  </div>
                </div>
                <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
              </div>
              <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                <div className="flex items-center gap-3">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <h4 className="font-medium text-foreground text-sm">In-App Notifications</h4>
                    <p className="text-xs text-muted-foreground">Show notifications within the application</p>
                  </div>
                </div>
                <Switch checked={inAppNotifications} onCheckedChange={setInAppNotifications} />
              </div>
              <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <h4 className="font-medium text-foreground text-sm">SMS Notifications</h4>
                    <p className="text-xs text-muted-foreground">Receive text message alerts</p>
                  </div>
                </div>
                <Switch checked={smsNotifications} onCheckedChange={setSmsNotifications} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Granular notification categories */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Notification Categories</CardTitle>
            <CardDescription>Control notifications per category and channel</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_60px_60px_60px] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
                <span>Category</span>
                <span className="text-center">Email</span>
                <span className="text-center">In-App</span>
                <span className="text-center">SMS</span>
              </div>
              {NOTIFICATION_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <div key={cat.id} className="grid grid-cols-[1fr_60px_60px_60px] gap-2 items-center px-3 py-3 border border-border rounded-lg">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{cat.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{cat.description}</p>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <Switch
                        checked={notifCategories[cat.id]?.email ?? true}
                        onCheckedChange={() => toggleCategoryChannel(cat.id, "email")}
                        className="scale-75"
                      />
                    </div>
                    <div className="flex justify-center">
                      <Switch
                        checked={notifCategories[cat.id]?.inApp ?? true}
                        onCheckedChange={() => toggleCategoryChannel(cat.id, "inApp")}
                        className="scale-75"
                      />
                    </div>
                    <div className="flex justify-center">
                      <Switch
                        checked={notifCategories[cat.id]?.sms ?? false}
                        onCheckedChange={() => toggleCategoryChannel(cat.id, "sms")}
                        className="scale-75"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Digest preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Digest Preferences
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Delivery frequency</Label>
                <Select value={digestPreference} onValueChange={setDigestPreference}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realtime">Real-time</SelectItem>
                    <SelectItem value="daily">Daily digest</SelectItem>
                    <SelectItem value="weekly">Weekly summary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quiet hours */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Quiet Hours
                </CardTitle>
                <CardDescription>Pause non-critical notifications during set hours</CardDescription>
              </div>
              <Switch checked={quietHoursEnabled} onCheckedChange={setQuietHoursEnabled} />
            </div>
          </CardHeader>
          {quietHoursEnabled && (
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="qhStart">Start time</Label>
                  <Input
                    id="qhStart"
                    type="time"
                    value={quietHoursStart}
                    onChange={(e) => setQuietHoursStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qhEnd">End time</Label>
                  <Input
                    id="qhEnd"
                    type="time"
                    value={quietHoursEnd}
                    onChange={(e) => setQuietHoursEnd(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Timezone: {TIMEZONES.find((t) => t.value === profileTz)?.label || profileTz}
              </p>
            </CardContent>
          )}
        </Card>

        <Button
          onClick={() =>
            notificationMutation.mutate({
              email: emailNotifications,
              inApp: inAppNotifications,
              sms: smsNotifications,
            })
          }
          disabled={notificationMutation.isPending}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {notificationMutation.isPending ? "Saving..." : "Save Notification Preferences"}
        </Button>
      </div>
    );
  }

  function renderCalendar() {
    return (
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
          <div className="space-y-6">
            <div>
              <Label className="text-sm font-medium">Default Calendar Provider</Label>
              <p className="text-sm text-muted-foreground mb-3">Choose your preferred calendar service for sync operations</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {CALENDAR_PROVIDERS.map((provider) => (
                  <div
                    key={provider.value}
                    onClick={() => setCalendarProvider(provider.value)}
                    className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                      calendarProvider === provider.value
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <span className="text-2xl">{provider.icon}</span>
                    <span className="font-medium text-foreground">{provider.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between p-4 border border-border rounded-lg">
              <div>
                <h4 className="font-medium text-foreground">Auto-Sync</h4>
                <p className="text-sm text-muted-foreground">
                  Automatically synchronize events with your calendar
                </p>
              </div>
              <Switch checked={calendarSyncEnabled} onCheckedChange={setCalendarSyncEnabled} />
            </div>
            <Button
              onClick={() =>
                profileMutation.mutate({
                  defaultCalendarProvider: calendarProvider || null,
                  calendarSyncEnabled,
                })
              }
              disabled={profileMutation.isPending}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {profileMutation.isPending ? "Saving..." : "Save Calendar Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderSessions() {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  Active Sessions
                </CardTitle>
                <CardDescription>
                  Devices currently signed into your account
                </CardDescription>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={() => setShowRevokeAllDialog(true)}
                disabled={sessions.length <= 1}
              >
                <LogOut className="h-4 w-4" />
                Sign Out Everywhere
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingSessions ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <Monitor className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>No active sessions found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((session: any, idx: number) => {
                  const isCurrent = session.current === true;
                  return (
                    <div
                      key={session.id || idx}
                      className={`flex items-center justify-between p-4 border rounded-lg ${
                        isCurrent ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0">
                          {session.device === "mobile" || session.deviceType === "mobile" ? (
                            <Smartphone className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <Monitor className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {session.browser || session.device || "Unknown device"}
                            </p>
                            {isCurrent && (
                              <Badge variant="default" className="text-xs">Current</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            {session.ip && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {session.ip}
                              </span>
                            )}
                            {session.location && (
                              <span>{session.location}</span>
                            )}
                            {session.lastActive && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatRelativeTime(session.lastActive)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {!isCurrent && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setRevokeSessionId(session.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revoke single session dialog */}
        <Dialog open={!!revokeSessionId} onOpenChange={(open) => !open && setRevokeSessionId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Revoke Session</DialogTitle>
              <DialogDescription>Are you sure you want to revoke this session? The device will be signed out immediately.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRevokeSessionId(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => revokeSessionId && revokeSessionMutation.mutate(revokeSessionId)}
                disabled={revokeSessionMutation.isPending}
              >
                {revokeSessionMutation.isPending ? "Revoking..." : "Revoke Session"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Revoke all sessions dialog */}
        <Dialog open={showRevokeAllDialog} onOpenChange={setShowRevokeAllDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sign Out Everywhere</DialogTitle>
              <DialogDescription>This will terminate all other active sessions. You will remain signed in on this device.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRevokeAllDialog(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => revokeAllSessionsMutation.mutate()}
                disabled={revokeAllSessionsMutation.isPending}
              >
                {revokeAllSessionsMutation.isPending ? "Revoking..." : "Sign Out All Other Sessions"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  function renderPrivacy() {
    return (
      <Card data-testid="card-privacy-settings">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="text-privacy-title">
            <Shield className="h-5 w-5" />
            Privacy & Data
          </CardTitle>
          <CardDescription data-testid="text-privacy-description">
            Manage how your data is used for industry benchmarks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex items-start justify-between p-4 border border-border rounded-lg">
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-foreground">Contribute to anonymized industry benchmarks</h4>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Anonymized benchmarking means your data is combined with many others and cannot be traced back to your marina.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  This helps improve industry analytics for all MarinaMatch users. Your marina's identity is never disclosed. You can opt out at any time.
                </p>
                {benchmarkingSettings?.benchmarkingOptOut && (
                  <p className="text-xs text-muted-foreground mt-2">Currently opted out of benchmarking</p>
                )}
              </div>
              <Switch
                checked={!benchmarkingSettings?.benchmarkingOptOut}
                onCheckedChange={(checked) => updateBenchmarkingMutation.mutate(!checked)}
                disabled={isLoadingBenchmarking || updateBenchmarkingMutation.isPending}
                data-testid="switch-benchmarking"
              />
            </div>

            {benchmarkingSettings?.dataBenchmarkingConsent && (
              <div className="p-4 bg-muted/30 rounded-lg">
                <h4 className="font-medium text-foreground text-sm">Consent Information</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  You agreed to the Data Use & Anonymized Benchmarking Terms
                  {benchmarkingSettings.consentTimestamp && (
                    <> on {new Date(benchmarkingSettings.consentTimestamp).toLocaleDateString()}</>
                  )}
                  {benchmarkingSettings.consentVersion && (
                    <> (Version: {benchmarkingSettings.consentVersion})</>
                  )}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderTours() {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  Page Tours
                </CardTitle>
                <CardDescription>
                  Interactive guides that walk you through each page's features
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => resetAllToursMutation.mutate()}
                disabled={resetAllToursMutation.isPending}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Reset All Tours
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {TOUR_INFO.map((tour) => {
                const isCompleted = completedTours[tour.id];
                return (
                  <div
                    key={tour.id}
                    className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                      )}
                      <div>
                        <h4 className="font-medium text-foreground">{tour.name}</h4>
                        <p className="text-sm text-muted-foreground">{tour.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isCompleted && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => resetTourMutation.mutate(tour.id)}
                          disabled={resetTourMutation.isPending}
                          className="gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Reset
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (isCompleted) {
                            resetTourMutation.mutate(tour.id);
                          }
                          setLocation(tour.route);
                        }}
                        className="gap-1"
                      >
                        <Play className="h-3 w-3" />
                        {isCompleted ? "Replay" : "Start"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Quick Start Guides
            </CardTitle>
            <CardDescription>
              Jump into key platform features
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {QUICK_START_GUIDES.map((guide, index) => (
                <div
                  key={index}
                  onClick={() => setLocation(guide.link)}
                  className="flex items-center gap-4 p-4 border border-border rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/60 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground truncate">{guide.title}</h4>
                    <p className="text-sm text-muted-foreground truncate">{guide.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Section router ─────────────────────────────────────────────────────────

  function renderActiveSection() {
    switch (activeSection) {
      case "profile": return renderProfile();
      case "security": return renderSecurity();
      case "emails": return renderEmails();
      case "notifications": return renderNotifications();
      case "calendar": return renderCalendar();
      case "sessions": return renderSessions();
      case "privacy": return renderPrivacy();
      case "tours": return renderTours();
      default: return renderProfile();
    }
  }

  // ── Layout ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full bg-background" data-testid="user-settings-page">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="flex h-14 items-center gap-4 px-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            className="gap-2"
            data-testid="button-back"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex-1">
            <h1 className="font-semibold text-foreground" data-testid="text-page-title">
              User Settings
            </h1>
          </div>
        </div>
      </div>

      {/* Body: sidebar + content */}
      <div className="flex h-[calc(100dvh-3.5rem)] overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0 border-r border-border bg-card overflow-y-auto">
          {/* User avatar area */}
          <div className="p-5 border-b border-border">
            <div className="flex items-center gap-3">
              <div className={`h-11 w-11 rounded-full bg-gradient-to-br ${AVATAR_GRADIENTS[userRole] || AVATAR_GRADIENTS.viewer} flex items-center justify-center flex-shrink-0`}>
                <span className="text-sm font-bold text-white">{getInitials(profileName || userName)}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{profileName || userName || "User"}</p>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${ROLE_BADGE_COLORS[userRole] || ROLE_BADGE_COLORS.viewer}`}>
                  {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                </Badge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 truncate">{userEmail}</p>
            {memberSince && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Member since {new Date(memberSince).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
              </p>
            )}
          </div>

          {/* Navigation */}
          <nav className="p-2">
            {SIDEBAR_SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors mb-0.5 ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {section.label}
                  {isActive && <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <ScrollArea className="h-full">
            <div className="max-w-3xl mx-auto p-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-foreground">
                  {SIDEBAR_SECTIONS.find((s) => s.id === activeSection)?.label}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5" data-testid="text-page-description">
                  {activeSection === "profile" && "Manage your account information and preferences"}
                  {activeSection === "security" && "Password, authentication, and API access"}
                  {activeSection === "emails" && "Manage your email addresses for sync and notifications"}
                  {activeSection === "notifications" && "Configure how and when you receive notifications"}
                  {activeSection === "calendar" && "Calendar provider and sync preferences"}
                  {activeSection === "sessions" && "View and manage your active sessions"}
                  {activeSection === "privacy" && "Control how your data is shared and used"}
                  {activeSection === "tours" && "Interactive guides and video tutorials"}
                </p>
              </div>
              {renderActiveSection()}
            </div>
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}

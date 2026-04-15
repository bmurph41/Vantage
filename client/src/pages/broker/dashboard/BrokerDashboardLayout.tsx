import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMyBrokerProfile } from "@/hooks/use-broker-dashboard";

const NAV_ITEMS = [
  { href: "/broker/dashboard", label: "Overview" },
  { href: "/broker/dashboard/profile", label: "Profile" },
  { href: "/broker/dashboard/listings", label: "Listings" },
  { href: "/broker/dashboard/advisory-packages", label: "Advisory Packages" },
  { href: "/broker/dashboard/content", label: "Content" },
  { href: "/broker/dashboard/subscribers", label: "Subscribers" },
  { href: "/broker/dashboard/analytics", label: "Analytics" },
];

export default function BrokerDashboardLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { data, isLoading, error } = useMyBrokerProfile();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error && (error as any)?.message === "NO_BROKER_PROFILE") {
    return (
      <div className="max-w-2xl mx-auto py-16 px-6">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <h2 className="text-xl font-semibold">You don't have a broker profile yet</h2>
            <p className="text-sm text-muted-foreground">
              Apply to become a MarinaMatch broker to unlock the broker dashboard and start
              publishing listings, advisory packages, and content.
            </p>
            <Link href="/broker/register">
              <Button>Apply to become a broker</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;
  const { profile, stats, tierDefinition } = data;

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <aside className="w-60 border-r bg-muted/20 p-4 space-y-4 shrink-0">
        <div>
          <div className="font-semibold truncate" data-testid="broker-display-name">
            {profile.displayName}
          </div>
          <div className="text-xs text-muted-foreground truncate">{profile.companyName}</div>
          <div className="mt-2 flex items-center gap-2">
            {tierDefinition && <Badge variant="secondary">{tierDefinition.label}</Badge>}
            {profile.isPublishable ? (
              <Badge variant="default">Published</Badge>
            ) : (
              <Badge variant="outline">Draft</Badge>
            )}
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/broker/dashboard"
                ? location === item.href
                : location.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <a
                  className={`px-3 py-2 rounded text-sm ${
                    active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {item.label}
                </a>
              </Link>
            );
          })}
        </nav>
        <div className="text-xs text-muted-foreground space-y-1 border-t pt-3">
          <div>Followers: {stats.followerCount}</div>
          <div>Advisory subs: {stats.advisorySubscriberCount}</div>
          <div>Listings: {stats.listingsCount}</div>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-6">{children}</main>
    </div>
  );
}

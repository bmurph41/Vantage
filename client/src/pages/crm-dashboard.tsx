import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Building2, DollarSign, TrendingUp, Phone, Mail, Calendar, ArrowRight, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/utils";
import { FeatureChecklist } from "@/components/ui/feature-highlight";
import { QuickStatBanner } from "@/components/ui/testimonial-quote";

export default function CRMDashboard() {
  const { data: dealsData, isLoading: dealsLoading } = useQuery({
    queryKey: ['/api/crm/deals'],
  });

  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ['/api/crm/leads'],
  });

  const { data: contactsData, isLoading: contactsLoading } = useQuery({
    queryKey: ['/api/crm/contacts'],
  });

  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ['/api/crm/companies'],
  });

  const deals = Array.isArray(dealsData) ? dealsData : (dealsData?.deals || dealsData?.data || []);
  const leads = Array.isArray(leadsData) ? leadsData : (leadsData?.leads || leadsData?.data || []);
  const contacts = Array.isArray(contactsData) ? contactsData : (contactsData?.contacts || contactsData?.data || []);
  const companies = Array.isArray(companiesData) ? companiesData : (companiesData?.companies || companiesData?.data || []);

  const safeDeals = Array.isArray(deals) ? deals : [];
  const safeLeads = Array.isArray(leads) ? leads : [];
  const safeContacts = Array.isArray(contacts) ? contacts : [];
  const safeCompanies = Array.isArray(companies) ? companies : [];

  const totalDealValue = safeDeals.reduce((sum: number, deal: any) => {
    const value = parseFloat(deal.value || deal.amount || '0');
    return sum + (isNaN(value) ? 0 : value);
  }, 0);

  const stats = [
    {
      title: "Total Deals",
      value: safeDeals.length,
      icon: DollarSign,
      description: `${formatCurrency(totalDealValue)} in pipeline`,
      link: "/crm/deals",
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Active Leads",
      value: safeLeads.filter((l: any) => l.leadStatus !== 'converted' && l.leadStatus !== 'unqualified').length,
      icon: TrendingUp,
      description: `${safeLeads.length} total leads`,
      link: "/crm/leads",
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Contacts",
      value: safeContacts.length,
      icon: Users,
      description: "Active contacts",
      link: "/crm/contacts",
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "Companies",
      value: safeCompanies.length,
      icon: Building2,
      description: "Active companies",
      link: "/crm/companies",
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
  ];

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">CRM Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your marina acquisition pipeline
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/crm/deals">
            <Button data-testid="button-new-deal">
              <DollarSign className="w-4 h-4 mr-2" />
              New Deal
            </Button>
          </Link>
          <Link href="/crm/leads">
            <Button variant="outline" data-testid="button-new-lead">
              <TrendingUp className="w-4 h-4 mr-2" />
              New Lead
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.title} href={stat.link}>
              <Card className="cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group border-2 hover:border-primary/20" data-testid={`card-stat-${stat.title.toLowerCase().replace(' ', '-')}`}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2.5 rounded-xl ${stat.bgColor} group-hover:scale-110 transition-transform`}>
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold" data-testid={`text-${stat.title.toLowerCase().replace(' ', '-')}-count`}>
                    {dealsLoading || leadsLoading || contactsLoading || companiesLoading ? "..." : stat.value}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-muted-foreground">
                      {stat.description}
                    </p>
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Recent Deals */}
      <Card data-testid="card-recent-deals">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Recent Deals</CardTitle>
              <CardDescription>Latest opportunities in your pipeline</CardDescription>
            </div>
            <Link href="/crm/deals">
              <Button variant="ghost" size="sm" data-testid="button-view-all-deals">
                View All
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {dealsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading deals...</div>
          ) : deals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No deals yet. Create your first deal to get started!
            </div>
          ) : (
            <div className="space-y-4">
              {deals.slice(0, 5).map((deal: any) => (
                <div
                  key={deal.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                  data-testid={`row-deal-${deal.id}`}
                >
                  <div className="flex-1">
                    <h3 className="font-medium" data-testid={`text-deal-title-${deal.id}`}>{deal.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {deal.marinaName || deal.description || "No description"}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-lg" data-testid={`text-deal-value-${deal.id}`}>
                      {formatCurrency(parseFloat(deal.value || deal.amount || 0))}
                    </div>
                    <div className="text-sm text-muted-foreground capitalize">
                      {deal.stage || "New"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card data-testid="card-quick-actions" className="border-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common CRM tasks</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/crm/activities">
              <Button variant="outline" className="w-full justify-start h-auto py-4 hover:bg-primary/5 hover:border-primary/30 transition-all group" data-testid="button-log-call">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 mr-3 group-hover:scale-110 transition-transform">
                  <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Log a Call</div>
                  <div className="text-xs text-muted-foreground">Track conversations</div>
                </div>
              </Button>
            </Link>
            <Link href="/crm/activities">
              <Button variant="outline" className="w-full justify-start h-auto py-4 hover:bg-primary/5 hover:border-primary/30 transition-all group" data-testid="button-send-email">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 mr-3 group-hover:scale-110 transition-transform">
                  <Mail className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Send Email</div>
                  <div className="text-xs text-muted-foreground">Compose message</div>
                </div>
              </Button>
            </Link>
            <Link href="/crm/activities">
              <Button variant="outline" className="w-full justify-start h-auto py-4 hover:bg-primary/5 hover:border-primary/30 transition-all group" data-testid="button-schedule-meeting">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 mr-3 group-hover:scale-110 transition-transform">
                  <Calendar className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Schedule Meeting</div>
                  <div className="text-xs text-muted-foreground">Set up a call</div>
                </div>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Platform Capabilities */}
      <Card className="bg-gradient-to-br from-primary/5 via-white to-teal-50/30 dark:from-primary/10 dark:via-gray-900 dark:to-teal-950/20 border-2 border-primary/10">
        <CardHeader>
          <CardTitle className="text-lg">MarinaMatch CRM Includes:</CardTitle>
        </CardHeader>
        <CardContent>
          <FeatureChecklist
            items={[
              { text: "Deal Pipeline Management" },
              { text: "Lead Tracking & Qualification" },
              { text: "Contact & Company Database" },
              { text: "Activity Logging & History" },
              { text: "Email Sequence Automation" },
              { text: "Due Diligence Integration" },
            ]}
            columns={3}
            variant="accent"
          />
        </CardContent>
      </Card>
    </div>
  );
}

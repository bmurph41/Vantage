import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Building2, DollarSign, TrendingUp, Phone, Mail, Calendar } from "lucide-react";
import { Link } from "wouter";

export default function CRMDashboard() {
  const { data: deals = [], isLoading: dealsLoading } = useQuery({
    queryKey: ['/api/crm/deals'],
  });

  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['/api/crm/leads'],
  });

  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ['/api/crm/contacts'],
  });

  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ['/api/crm/companies'],
  });

  const totalDealValue = deals.reduce((sum: number, deal: any) => 
    sum + (parseFloat(deal.value || deal.amount || 0)), 0
  );

  const stats = [
    {
      title: "Total Deals",
      value: deals.length,
      icon: DollarSign,
      description: `$${totalDealValue.toLocaleString()} in pipeline`,
      link: "/crm/deals",
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Active Leads",
      value: leads.filter((l: any) => l.leadStatus !== 'converted' && l.leadStatus !== 'unqualified').length,
      icon: TrendingUp,
      description: `${leads.length} total leads`,
      link: "/crm/leads",
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Contacts",
      value: contacts.length,
      icon: Users,
      description: "Active contacts",
      link: "/crm/contacts",
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "Companies",
      value: companies.length,
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
              <Card className="cursor-pointer hover:shadow-lg transition-shadow" data-testid={`card-stat-${stat.title.toLowerCase().replace(' ', '-')}`}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2 rounded-full ${stat.bgColor}`}>
                    <Icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid={`text-${stat.title.toLowerCase().replace(' ', '-')}-count`}>
                    {dealsLoading || leadsLoading || contactsLoading || companiesLoading ? "..." : stat.value}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.description}
                  </p>
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
                      ${parseFloat(deal.value || deal.amount || 0).toLocaleString()}
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
      <Card data-testid="card-quick-actions">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common CRM tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/crm/activities">
              <Button variant="outline" className="w-full justify-start" data-testid="button-log-call">
                <Phone className="w-4 h-4 mr-2" />
                Log a Call
              </Button>
            </Link>
            <Link href="/crm/activities">
              <Button variant="outline" className="w-full justify-start" data-testid="button-send-email">
                <Mail className="w-4 h-4 mr-2" />
                Send Email
              </Button>
            </Link>
            <Link href="/crm/activities">
              <Button variant="outline" className="w-full justify-start" data-testid="button-schedule-meeting">
                <Calendar className="w-4 h-4 mr-2" />
                Schedule Meeting
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

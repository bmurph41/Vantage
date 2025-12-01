import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Anchor, Ship, Calendar, CreditCard, Users, BarChart3, Shield, Zap } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900">
      <nav className="flex items-center justify-between p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <Anchor className="h-8 w-8 text-white" />
          <span className="text-2xl font-bold text-white">MarinaHub</span>
        </div>
        <Button 
          variant="secondary" 
          onClick={() => window.location.href = '/api/login'}
          data-testid="button-login"
        >
          Sign In
        </Button>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <section className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-6">
            Complete Marina Management Platform
          </h1>
          <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
            Streamline your marina operations with our comprehensive management solution. 
            From slip inventory to dry stack launches, customer billing to financial analytics.
          </p>
          <div className="flex gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={() => window.location.href = '/api/login'}
              data-testid="button-get-started"
            >
              Get Started
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="text-white border-white hover:bg-white/10"
              onClick={() => window.location.href = '/book'}
              data-testid="button-book-slip"
            >
              Book a Slip
            </Button>
          </div>
        </section>

        <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card className="bg-white/10 border-white/20 text-white">
            <CardHeader>
              <Ship className="h-10 w-10 mb-2 text-blue-300" />
              <CardTitle>Slip Management</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-blue-100">
                Track slip inventory, manage leases, and handle reservations with an interactive marina map.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-white/10 border-white/20 text-white">
            <CardHeader>
              <Calendar className="h-10 w-10 mb-2 text-blue-300" />
              <CardTitle>Launch Scheduling</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-blue-100">
                Dry stack boat launch scheduling with real-time queue management and customer notifications.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-white/10 border-white/20 text-white">
            <CardHeader>
              <CreditCard className="h-10 w-10 mb-2 text-blue-300" />
              <CardTitle>Billing & Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-blue-100">
                Automated recurring billing, Stripe payment processing, and accounts receivable tracking.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-white/10 border-white/20 text-white">
            <CardHeader>
              <BarChart3 className="h-10 w-10 mb-2 text-blue-300" />
              <CardTitle>Financial Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-blue-100">
                Revenue tracking, occupancy rates, aging reports, and comprehensive financial dashboards.
              </CardDescription>
            </CardContent>
          </Card>
        </section>

        <section className="text-center mb-16">
          <h2 className="text-3xl font-bold text-white mb-8">Enterprise Features</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-white">
              <div className="w-16 h-16 rounded-full bg-blue-500/30 flex items-center justify-center mb-4">
                <Users className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Multi-Marina Portfolio</h3>
              <p className="text-blue-100">Manage multiple properties with consolidated dashboards and cross-property analytics.</p>
            </div>
            <div className="flex flex-col items-center text-white">
              <div className="w-16 h-16 rounded-full bg-blue-500/30 flex items-center justify-center mb-4">
                <Shield className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Role-Based Access</h3>
              <p className="text-blue-100">Corporate, regional, site, and staff roles with granular permission controls.</p>
            </div>
            <div className="flex flex-col items-center text-white">
              <div className="w-16 h-16 rounded-full bg-blue-500/30 flex items-center justify-center mb-4">
                <Zap className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold mb-2">API Integration</h3>
              <p className="text-blue-100">Connect with SpeedyDock, Dockwa, Snag-a-Slip, and other marina systems.</p>
            </div>
          </div>
        </section>

        <section className="bg-white/5 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Ready to modernize your marina?</h2>
          <p className="text-blue-100 mb-6">
            Join marinas across the country using our platform for efficient operations.
          </p>
          <Button 
            size="lg" 
            onClick={() => window.location.href = '/api/login'}
            data-testid="button-sign-in-cta"
          >
            Sign In to Get Started
          </Button>
        </section>
      </main>

      <footer className="text-center py-8 text-blue-200">
        <p>Marina Management Platform</p>
      </footer>
    </div>
  );
}

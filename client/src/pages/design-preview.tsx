import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Anchor, 
  FileText, 
  Users, 
  BarChart3,
  ArrowRight,
  CheckCircle2,
  Shield,
  Zap,
  LineChart,
  FolderLock,
  Target,
  Calculator,
  PieChart
} from "lucide-react";

const platformFeatures = [
  { 
    title: "CRM & Pipeline", 
    description: "Track leads, contacts, companies, and deals through your entire acquisition funnel. Email sequences, task automation, and deal analytics.",
    icon: Users,
    color: "bg-blue-500",
    highlights: ["Deal Pipeline Kanban", "Contact Management", "Email Automation", "Activity Tracking"]
  },
  { 
    title: "Due Diligence", 
    description: "Comprehensive DD project tracking with templates, task management, and team collaboration built for marina transactions.",
    icon: FileText,
    color: "bg-emerald-500",
    highlights: ["DD Templates", "Task Checklists", "Document Management", "Progress Reports"]
  },
  { 
    title: "Financial Modeling", 
    description: "Pro forma analysis, exit strategy suite, capital stack modeling, and scenario comparison purpose-built for marina valuations.",
    icon: Calculator,
    color: "bg-violet-500",
    highlights: ["Pro Forma Builder", "Exit Scenarios", "IRR Calculator", "Sensitivity Analysis"]
  },
  { 
    title: "Rent Roll Analytics", 
    description: "Marina-specific lease management with slip inventory, occupancy tracking, and cash flow projections.",
    icon: PieChart,
    color: "bg-amber-500",
    highlights: ["Slip Inventory", "Lease Management", "Occupancy Trends", "Revenue Forecasting"]
  },
  { 
    title: "Market Intelligence", 
    description: "Sales comps, rate benchmarking, demographics data, and industry news aggregation to inform your investment decisions.",
    icon: LineChart,
    color: "bg-cyan-500",
    highlights: ["Sales Comparables", "Rate Comps", "Demographics", "Industry News"]
  },
  { 
    title: "Virtual Data Room", 
    description: "Secure document sharing with granular permissions, external user access, and complete audit trails.",
    icon: FolderLock,
    color: "bg-rose-500",
    highlights: ["Secure Sharing", "Permission Controls", "Audit Logging", "External Access"]
  },
];

const benefits = [
  {
    icon: Zap,
    title: "Close Deals Faster",
    description: "Streamlined workflows reduce time from LOI to closing by up to 40%"
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "Bank-grade encryption, role-based access, and comprehensive audit trails"
  },
  {
    icon: Target,
    title: "Marina-Specific",
    description: "Purpose-built for marina acquisitions, not adapted from generic CRM tools"
  },
  {
    icon: BarChart3,
    title: "Data-Driven Decisions",
    description: "Market intelligence and analytics to identify and validate opportunities"
  },
];

const pricingTiers = [
  {
    name: "Starter",
    price: "Free",
    description: "Get started with core CRM and pipeline management",
    features: [
      "Up to 50 contacts",
      "Basic deal pipeline",
      "5 active deals",
      "Email integration",
      "Mobile access"
    ],
    cta: "Start Free",
    popular: false
  },
  {
    name: "Professional",
    price: "$199",
    period: "/month",
    description: "Full platform access for active acquirers",
    features: [
      "Unlimited contacts & deals",
      "Due diligence tracking",
      "Financial modeling",
      "Rent roll analytics",
      "Market intelligence",
      "Virtual data room",
      "Priority support"
    ],
    cta: "Start 14-Day Trial",
    popular: true
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For institutional investors and portfolio operators",
    features: [
      "Everything in Professional",
      "Multi-portfolio management",
      "LP Portal access",
      "Fund management tools",
      "API access",
      "Dedicated success manager",
      "Custom integrations"
    ],
    cta: "Contact Sales",
    popular: false
  },
];

export default function DesignPreview() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
                <Anchor className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight">MARINAMATCH</span>
            </div>
            <div className="hidden md:flex items-center gap-6 text-sm">
              <a href="#features" className="text-slate-300 hover:text-white cursor-pointer">Features</a>
              <a href="#pricing" className="text-slate-300 hover:text-white cursor-pointer">Pricing</a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <span className="text-slate-300 hover:text-white text-sm cursor-pointer">Sign In</span>
            </Link>
            <Link href="/signup">
              <Button className="bg-cyan-500 hover:bg-cyan-600 text-white">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-24 md:py-32 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-cyan-950 to-slate-900" />
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0id2F2ZXMiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiIHdpZHRoPSIxMDAiIGhlaWdodD0iMjAiPjxwYXRoIGQ9Ik0wIDEwIFEgMjUgMCwgNTAgMTAgVCA1MCAxMCBRIDc1IDIwLCAxMDAgMTAiIHN0cm9rZT0iIzA4OTFiMiIgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI3dhdmVzKSIvPjwvc3ZnPg==')] bg-repeat" />
        </div>
        
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <div className="mb-8 flex justify-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-2xl shadow-cyan-500/30">
              <Anchor className="h-12 w-12 text-white" />
            </div>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight mb-6">
            The Complete Marina Acquisition Platform
          </h1>
          
          <p className="text-lg md:text-xl text-cyan-200 font-light mb-8 max-w-2xl mx-auto">
            CRM, Due Diligence, Financial Modeling, and Market Intelligence - unified in one purpose-built platform for marina investors.
          </p>
          
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/signup">
              <Button size="lg" className="bg-cyan-500 hover:bg-cyan-600 text-white px-8">
                Start Free Trial <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="border-cyan-400 text-cyan-300 hover:bg-cyan-950 px-8">
                Sign In
              </Button>
            </Link>
          </div>
          
          <p className="text-slate-400 text-sm mt-4">
            No credit card required. 14-day free trial.
          </p>
        </div>
      </section>

      {/* Benefits Grid */}
      <section className="bg-slate-900 py-16 border-y border-slate-700">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-14 h-14 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                    <benefit.icon className="h-7 w-7 text-cyan-400" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{benefit.title}</h3>
                <p className="text-slate-400 text-sm">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Features */}
      <section id="features" className="py-20 bg-slate-950">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 mb-4">PLATFORM FEATURES</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Everything You Need to Close Marina Deals
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              From first contact to closing, Vantage powers every step of your acquisition journey.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {platformFeatures.map((feature, index) => (
              <Card key={index} className="bg-slate-900 border-slate-700 overflow-hidden hover:border-cyan-500/50 transition-all">
                <CardContent className="p-6">
                  <div className={`w-12 h-12 ${feature.color} rounded-lg flex items-center justify-center mb-4`}>
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-slate-400 text-sm mb-4">{feature.description}</p>
                  <ul className="space-y-2">
                    {feature.highlights.map((highlight, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                        <CheckCircle2 className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                        {highlight}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-slate-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 mb-4">PRICING</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Start free and scale as your portfolio grows.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingTiers.map((tier, index) => (
              <Card key={index} className={`bg-slate-800 border-slate-700 overflow-hidden relative ${tier.popular ? 'ring-2 ring-cyan-500' : ''}`}>
                {tier.popular && (
                  <div className="absolute top-0 left-0 right-0 bg-cyan-500 text-white text-center text-sm py-1 font-medium">
                    Most Popular
                  </div>
                )}
                <CardContent className={`p-6 ${tier.popular ? 'pt-10' : ''}`}>
                  <h3 className="text-xl font-semibold text-white mb-2">{tier.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-white">{tier.price}</span>
                    {tier.period && <span className="text-slate-400">{tier.period}</span>}
                  </div>
                  <p className="text-slate-400 text-sm mb-6">{tier.description}</p>
                  
                  <ul className="space-y-3 mb-6">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                        <CheckCircle2 className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  
                  <Link href="/signup">
                    <Button className={`w-full ${tier.popular ? 'bg-cyan-500 hover:bg-cyan-600' : 'bg-slate-700 hover:bg-slate-600'} text-white`}>
                      {tier.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-b from-cyan-950 to-slate-900">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Transform Your Marina Acquisitions?
          </h2>
          <p className="text-cyan-200 text-lg mb-8">
            Join marina investment firms using Vantage to source, analyze, and close deals faster.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/signup">
              <Button size="lg" className="bg-cyan-500 hover:bg-cyan-600 text-white px-8">
                Start Free Trial
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="border-cyan-400 text-cyan-300 hover:bg-cyan-950 px-8">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
                <Anchor className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white">MARINAMATCH</span>
            </div>
            <p className="text-slate-500 text-sm">
              © 2026 Vantage. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

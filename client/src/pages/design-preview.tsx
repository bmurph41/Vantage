import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Anchor, 
  Building2, 
  TrendingUp, 
  FileText, 
  Users, 
  BarChart3,
  ChevronDown,
  ExternalLink,
  ArrowRight,
  Waves,
  Ship,
  MapPin,
  DollarSign,
  Calendar,
  Newspaper
} from "lucide-react";

const stats = [
  { value: "$2.4B+", label: "Marina Assets Analyzed", icon: TrendingUp },
  { value: "847", label: "Active Deals Tracked", icon: Building2 },
  { value: "156", label: "Marinas in Database", icon: Anchor },
  { value: "12,400+", label: "Slip Inventory Managed", icon: Ship },
];

const servicePillars = [
  { 
    title: "CRM & Pipeline", 
    description: "Complete relationship management for marina acquisitions",
    icon: Users,
    color: "bg-blue-500"
  },
  { 
    title: "Due Diligence", 
    description: "Comprehensive DD tracking with automated task management",
    icon: FileText,
    color: "bg-emerald-500"
  },
  { 
    title: "Financial Modeling", 
    description: "Pro forma analysis with exit strategy suite",
    icon: BarChart3,
    color: "bg-violet-500"
  },
  { 
    title: "Rent Roll Analytics", 
    description: "Marina-specific lease management and cash flow analysis",
    icon: TrendingUp,
    color: "bg-amber-500"
  },
  { 
    title: "Market Intelligence", 
    description: "Industry news, sales comps, and rate benchmarking",
    icon: Newspaper,
    color: "bg-rose-500"
  },
];

const featuredDeals = [
  { 
    name: "Sunset Marina & Yacht Club",
    location: "Naples, FL",
    askingPrice: "$24,500,000",
    slips: 186,
    capRate: "6.25%",
    status: "Under LOI"
  },
  { 
    name: "Harbor Point Marina",
    location: "Annapolis, MD",
    askingPrice: "$18,750,000",
    slips: 142,
    capRate: "5.85%",
    status: "Active"
  },
  { 
    name: "Pacific Coast Yacht Harbor",
    location: "San Diego, CA",
    askingPrice: "$42,000,000",
    slips: 312,
    capRate: "5.20%",
    status: "Due Diligence"
  },
  { 
    name: "Lakefront Marina Resort",
    location: "Lake Geneva, WI",
    askingPrice: "$12,200,000",
    slips: 98,
    capRate: "7.10%",
    status: "Active"
  },
];

const newsArticles = [
  {
    category: "M&A Activity",
    title: "Safe Harbor Acquires Three Gulf Coast Marinas in $67M Deal",
    excerpt: "The acquisition adds 450 slips to Safe Harbor's growing portfolio...",
    date: "Jan 12, 2026"
  },
  {
    category: "Market Trends",
    title: "Marina Cap Rates Compress as Institutional Interest Grows",
    excerpt: "Average cap rates for Class A marinas have dropped to 5.2%...",
    date: "Jan 10, 2026"
  },
  {
    category: "Industry News",
    title: "NMMA Reports Record Boat Sales for 2025 Season",
    excerpt: "Strong demand continues to drive marina occupancy rates...",
    date: "Jan 8, 2026"
  },
];

const mediaLogos = [
  "Marina Dock Age",
  "Boating Industry",
  "Trade Only Today",
  "Marina World",
  "Soundings Trade Only",
  "PropellMM",
];

export default function DesignPreview() {
  const [expandedService, setExpandedService] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background">
      {/* Announcement Banner */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white py-2 px-4 text-center text-sm font-medium">
        <span className="flex items-center justify-center gap-2">
          MarinaMatch 2.0 Now Available - Introducing AI-Powered Document Intelligence
          <ExternalLink className="h-3.5 w-3.5" />
        </span>
      </div>

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
              <span className="text-slate-300 hover:text-white cursor-pointer">CRM</span>
              <span className="text-slate-300 hover:text-white cursor-pointer">Due Diligence</span>
              <span className="text-slate-300 hover:text-white cursor-pointer">Modeling</span>
              <span className="text-slate-300 hover:text-white cursor-pointer">Rent Roll</span>
              <span className="text-slate-300 hover:text-white cursor-pointer">Analytics</span>
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

      {/* Hero Section - Surmount Style */}
      <section className="relative h-[85vh] flex items-center justify-center overflow-hidden">
        {/* Background gradient simulating marina imagery */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-cyan-950 to-slate-900" />
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0id2F2ZXMiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiIHdpZHRoPSIxMDAiIGhlaWdodD0iMjAiPjxwYXRoIGQ9Ik0wIDEwIFEgMjUgMCwgNTAgMTAgVCA1MCAxMCBRIDc1IDIwLCAxMDAgMTAiIHN0cm9rZT0iIzA4OTFiMiIgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI3dhdmVzKSIvPjwvc3ZnPg==')] bg-repeat" />
        </div>
        
        <div className="relative z-10 text-center px-6">
          {/* Logo Icon */}
          <div className="mb-8 flex justify-center">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-2xl shadow-cyan-500/30">
              <Anchor className="h-14 w-14 text-white" />
            </div>
          </div>
          
          {/* Brand Name */}
          <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight mb-4">
            MARINAMATCH
          </h1>
          
          {/* Tagline */}
          <p className="text-xl md:text-2xl text-cyan-200 font-light mb-8">
            The Complete Marina Acquisition Intelligence Platform
          </p>
          
          {/* CTA Buttons */}
          <div className="flex items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="bg-cyan-500 hover:bg-cyan-600 text-white px-8">
                Get Started Free
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="border-cyan-400 text-cyan-300 hover:bg-cyan-950 px-8">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-cyan-400 rounded-full flex items-start justify-center p-1">
            <div className="w-1.5 h-3 bg-cyan-400 rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="bg-slate-900 py-16 border-y border-slate-700">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="flex justify-center mb-3">
                  <stat.icon className="h-8 w-8 text-cyan-400" />
                </div>
                <div className="text-4xl md:text-5xl font-bold text-white mb-2">
                  {stat.value}
                </div>
                <div className="text-slate-400 text-sm uppercase tracking-wider">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Service Pillars */}
      <section className="py-20 bg-slate-950">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              One Platform. Complete Marina Intelligence.
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              From first contact to closing, MarinaMatch powers every step of your marina acquisition journey.
            </p>
          </div>
          
          <div className="grid md:grid-cols-5 gap-4">
            {servicePillars.map((service, index) => (
              <div 
                key={index}
                className="group bg-slate-900 border border-slate-700 rounded-xl p-6 hover:border-cyan-500/50 transition-all cursor-pointer"
                onClick={() => setExpandedService(expandedService === index ? null : index)}
              >
                <div className={`w-12 h-12 ${service.color} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <service.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{service.title}</h3>
                <p className="text-slate-400 text-sm">{service.description}</p>
                <ChevronDown className={`h-4 w-4 text-slate-500 mt-4 transition-transform ${expandedService === index ? 'rotate-180' : ''}`} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Deals - Property Cards */}
      <section className="py-20 bg-slate-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between mb-12">
            <div>
              <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 mb-2">ACTIVE OPPORTUNITIES</Badge>
              <h2 className="text-3xl font-bold text-white">Featured Deals</h2>
            </div>
            <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
              View All Listings <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
          
          <div className="grid md:grid-cols-4 gap-6">
            {featuredDeals.map((deal, index) => (
              <Card key={index} className="bg-slate-800 border-slate-700 overflow-hidden group hover:border-cyan-500/50 transition-all">
                {/* Image Placeholder */}
                <div className="h-40 bg-gradient-to-br from-cyan-900 to-slate-800 flex items-center justify-center relative">
                  <Waves className="h-16 w-16 text-cyan-600/30" />
                  <Badge className={`absolute top-3 left-3 ${
                    deal.status === 'Under LOI' ? 'bg-amber-500' :
                    deal.status === 'Due Diligence' ? 'bg-violet-500' : 'bg-emerald-500'
                  }`}>
                    {deal.status}
                  </Badge>
                </div>
                
                <CardContent className="p-4">
                  {/* Price */}
                  <div className="text-2xl font-bold text-white mb-1">
                    {deal.askingPrice}
                  </div>
                  
                  {/* Cap Rate Badge */}
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline" className="text-cyan-400 border-cyan-500/30">
                      Cap Rate: {deal.capRate}
                    </Badge>
                    <Badge variant="outline" className="text-slate-400 border-slate-600">
                      {deal.slips} Slips
                    </Badge>
                  </div>
                  
                  {/* Name & Location */}
                  <h3 className="font-semibold text-white mb-1 group-hover:text-cyan-400 transition-colors">
                    {deal.name}
                  </h3>
                  <div className="flex items-center gap-1 text-slate-400 text-sm">
                    <MapPin className="h-3.5 w-3.5" />
                    {deal.location}
                  </div>
                  
                  {/* CTA */}
                  <Button className="w-full mt-4 bg-slate-700 hover:bg-cyan-600 text-white">
                    View Details
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Media/News Section */}
      <section className="py-20 bg-slate-950">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-3xl font-bold text-white">Industry Intelligence</h2>
            <Button variant="link" className="text-cyan-400">
              View All News <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {newsArticles.map((article, index) => (
              <Card key={index} className="bg-slate-900 border-slate-700 overflow-hidden group hover:border-cyan-500/50 transition-all cursor-pointer">
                <div className="h-48 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                  <Newspaper className="h-16 w-16 text-slate-700" />
                </div>
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                      {article.category}
                    </Badge>
                    <span className="text-slate-500 text-xs">{article.date}</span>
                  </div>
                  <h3 className="font-semibold text-white mb-2 group-hover:text-cyan-400 transition-colors line-clamp-2">
                    {article.title}
                  </h3>
                  <p className="text-slate-400 text-sm line-clamp-2">{article.excerpt}</p>
                  <Button variant="link" className="text-cyan-400 px-0 mt-3">
                    Read More <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Featured In - Logo Carousel */}
      <section className="py-12 bg-slate-900 border-y border-slate-700 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-slate-500 text-sm uppercase tracking-wider mb-8">
            Trusted by Industry Leaders
          </p>
          <div className="flex items-center justify-center gap-12 flex-wrap opacity-60">
            {mediaLogos.map((logo, index) => (
              <div key={index} className="text-slate-400 font-semibold text-lg hover:text-white transition-colors cursor-pointer">
                {logo}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-b from-cyan-950 to-slate-900">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Transform Your Marina Acquisitions?
          </h2>
          <p className="text-cyan-200 text-lg mb-8">
            Join the leading marina investment firms using MarinaMatch to source, analyze, and close deals faster.
          </p>
          <div className="flex items-center justify-center gap-4">
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
                <Anchor className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white">MARINAMATCH</span>
            </div>
            <p className="text-slate-500 text-sm">
              © 2026 MarinaMatch. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

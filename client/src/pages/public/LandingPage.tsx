import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { PublicLayout } from "@/components/layout/PublicLayout";
import {
  BarChart3,
  Building2,
  FileSearch,
  ShieldCheck,
  TrendingUp,
  Users,
  ChevronRight,
  Anchor,
} from "lucide-react";

const FEATURES = [
  {
    icon: Users,
    title: "CRM & Deal Pipeline",
    description:
      "Track every lead, contact, and acquisition target from first outreach to close. Custom pipeline stages, automated follow-ups, and full activity history in one place.",
  },
  {
    icon: BarChart3,
    title: "Institutional Financial Modeling",
    description:
      "Pro-forma P&L engine, DCF analysis, exit strategy suite, debt scenario modeling, and scenario versioning — built for marina and CRE underwriting at institutional scale.",
  },
  {
    icon: FileSearch,
    title: "AI-Powered Due Diligence",
    description:
      "Upload rent rolls, P&Ls, and operating statements. AI extracts, normalizes, and flags anomalies automatically — cutting weeks of manual review down to hours.",
  },
  {
    icon: TrendingUp,
    title: "Portfolio Analytics",
    description:
      "Unified dashboard across all assets. Benchmark KPIs against industry standards, track utilization, and run stress tests across your entire portfolio.",
  },
  {
    icon: Building2,
    title: "Operations Management",
    description:
      "Vendor management, work orders, lease abstraction, and waitlist tools. Everything operators need to run assets after acquisition.",
  },
  {
    icon: ShieldCheck,
    title: "Virtual Data Room",
    description:
      "Secure document sharing with permission controls, audit trails, and LP portal access — purpose-built for marina and CRE deal closings.",
  },
];

const SOCIAL_PROOF = [
  { label: "Deals tracked", value: "2,400+" },
  { label: "Assets under analysis", value: "$4.2B+" },
  { label: "Due diligence hours saved", value: "18,000+" },
  { label: "Investment firms", value: "120+" },
];

export default function LandingPage() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-[hsl(221,83%,18%)] via-[hsl(221,83%,25%)] to-[hsl(221,60%,35%)] text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-300 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-teal-300 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-36 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm text-blue-100 mb-8">
            <Anchor className="h-3.5 w-3.5" />
            Built for marina and CRE acquisition teams
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-tight mb-6">
            Institutional-grade acquisition
            <br />
            <span className="text-blue-300">platform for marina investors</span>
          </h1>
          <p className="text-lg md:text-xl text-blue-100 max-w-3xl mx-auto mb-10 leading-relaxed">
            From lead to close — CRM, AI due diligence, financial modeling, and portfolio
            analytics in a single platform purpose-built for marina and CRE investors.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button
                size="lg"
                className="bg-white text-[hsl(221,83%,30%)] hover:bg-blue-50 font-semibold px-8 h-12 text-base shadow-lg"
              >
                Start free
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button
                size="lg"
                variant="outline"
                className="border-white/40 text-white hover:bg-white/10 font-semibold px-8 h-12 text-base bg-transparent"
              >
                See pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Social proof strip */}
      <section className="bg-gray-50 border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <p className="text-center text-sm text-gray-500 mb-8 font-medium uppercase tracking-wide">
            Trusted by acquisition teams managing
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {SOCIAL_PROOF.map(({ label, value }) => (
              <div key={label}>
                <div className="text-3xl font-bold text-[hsl(221,83%,35%)]">{value}</div>
                <div className="text-sm text-gray-500 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Everything your acquisition team needs
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Purpose-built modules that work together — no duct tape required.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md hover:border-[hsl(221,83%,70%)] transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-[hsl(221,83%,95%)] flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-[hsl(221,83%,35%)]" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="bg-[hsl(221,83%,35%)] text-white py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to close your next deal faster?
          </h2>
          <p className="text-blue-100 text-lg mb-8">
            Start free — no credit card required. Upgrade when your team is ready.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button
                size="lg"
                className="bg-white text-[hsl(221,83%,30%)] hover:bg-blue-50 font-semibold px-8 h-12 text-base"
              >
                Start free today
              </Button>
            </Link>
            <Link href="/pricing">
              <Button
                size="lg"
                variant="outline"
                className="border-white/40 text-white hover:bg-white/10 font-semibold px-8 h-12 text-base bg-transparent"
              >
                View pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

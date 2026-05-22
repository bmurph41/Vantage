import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Check, Minus } from "lucide-react";
import { TIER_LIMITS, type SubscriptionTierSlug } from "@shared/tier-packs";

interface TierData {
  slug: SubscriptionTierSlug;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  tagline: string;
  cta: string;
  ctaVariant: "default" | "outline";
  highlighted: boolean;
  features: string[];
}

const TIERS: TierData[] = [
  {
    slug: "starter",
    name: "Starter",
    priceMonthly: 0,
    priceAnnual: 0,
    tagline: "For solo investors getting started.",
    cta: "Start free",
    ctaVariant: "outline",
    highlighted: false,
    features: [
      "1 active deal",
      "Basic CRM",
      "Document vault",
      "DD checklist",
      "1 seat",
    ],
  },
  {
    slug: "investor",
    name: "Investor",
    priceMonthly: 89,
    priceAnnual: 890,
    tagline: "For active investors running multiple deals.",
    cta: "Get started",
    ctaVariant: "default",
    highlighted: false,
    features: [
      "Unlimited deals",
      "Financial modeling & DCF",
      "AI underwriting",
      "Deal analysis & narratives",
      "25 GB storage",
      "200 AI queries / mo",
      "Up to 3 seats",
    ],
  },
  {
    slug: "broker",
    name: "Broker",
    priceMonthly: 179,
    priceAnnual: 1790,
    tagline: "For brokers and advisory teams.",
    cta: "Get started",
    ctaVariant: "default",
    highlighted: true,
    features: [
      "Everything in Investor",
      "Full CRM pipeline",
      "Custom deal stages & automation",
      "Prospecting & email integration",
      "SMS alerts",
      "100 GB storage",
      "1,000 AI queries / mo",
      "Up to 10 seats",
    ],
  },
  {
    slug: "owner-operator",
    name: "Owner / Operator",
    priceMonthly: 249,
    priceAnnual: 2490,
    tagline: "For operators managing acquired assets.",
    cta: "Get started",
    ctaVariant: "default",
    highlighted: false,
    features: [
      "Everything in Broker",
      "Operations management",
      "Vendor management & work orders",
      "Lease abstractor",
      "AI document intelligence",
      "Waitlist & utilization tools",
      "500 GB storage",
      "2,500 AI queries / mo",
      "Up to 25 seats",
      "25 LP investors",
    ],
  },
  {
    slug: "institutional",
    name: "Institutional",
    priceMonthly: 1999,
    priceAnnual: 1649,
    tagline: "For institutional funds and large platforms.",
    cta: "Contact sales",
    ctaVariant: "default",
    highlighted: false,
    features: [
      "Everything in Owner / Operator",
      "Fund management & LP portal",
      "Capital calls & distributions",
      "Waterfall engine",
      "Advanced portfolio analytics",
      "API access",
      "SSO & audit trail",
      "1 TB storage",
      "Unlimited AI queries",
      "Unlimited seats",
      "Unlimited LP investors",
    ],
  },
];

function formatPrice(cents: number) {
  if (cents === 0) return "Free";
  return `$${cents.toLocaleString()}`;
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <PublicLayout>
      {/* Header */}
      <section className="bg-gradient-to-br from-[hsl(221,83%,18%)] to-[hsl(221,83%,30%)] text-white py-20 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Simple, transparent pricing</h1>
        <p className="text-blue-100 text-lg max-w-2xl mx-auto mb-8">
          Start free. Scale as your portfolio grows. All plans include a 14-day trial of
          paid features.
        </p>

        {/* Toggle */}
        <div className="inline-flex items-center gap-3 bg-white/10 border border-white/20 rounded-full p-1.5">
          <button
            onClick={() => setAnnual(false)}
            className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all ${
              !annual ? "bg-white text-[hsl(221,83%,30%)] shadow" : "text-white/70 hover:text-white"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
              annual ? "bg-white text-[hsl(221,83%,30%)] shadow" : "text-white/70 hover:text-white"
            }`}
          >
            Annual
            <span className="bg-green-400 text-green-900 text-xs font-bold px-2 py-0.5 rounded-full">
              Save up to 17%
            </span>
          </button>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {TIERS.map((tier) => {
              const price = annual ? tier.priceAnnual : tier.priceMonthly;
              const monthlyEquiv =
                annual && tier.priceAnnual > 0
                  ? Math.round(tier.priceAnnual / 12)
                  : tier.priceMonthly;
              const savePct =
                annual && tier.priceMonthly > 0
                  ? Math.round(
                      ((tier.priceMonthly * 12 - tier.priceAnnual) /
                        (tier.priceMonthly * 12)) *
                        100
                    )
                  : 0;

              return (
                <div
                  key={tier.slug}
                  className={`relative rounded-2xl flex flex-col p-6 ${
                    tier.highlighted
                      ? "bg-[hsl(221,83%,35%)] text-white shadow-2xl ring-2 ring-[hsl(221,83%,35%)] scale-[1.02]"
                      : "bg-white border border-gray-200 shadow-sm"
                  }`}
                >
                  {tier.highlighted && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                      Most popular
                    </div>
                  )}

                  <div className="mb-6">
                    <h3
                      className={`text-lg font-bold mb-1 ${
                        tier.highlighted ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {tier.name}
                    </h3>
                    <p
                      className={`text-sm mb-4 ${
                        tier.highlighted ? "text-blue-100" : "text-gray-500"
                      }`}
                    >
                      {tier.tagline}
                    </p>

                    {tier.priceMonthly === 0 ? (
                      <div
                        className={`text-3xl font-bold ${
                          tier.highlighted ? "text-white" : "text-gray-900"
                        }`}
                      >
                        Free
                      </div>
                    ) : (
                      <>
                        <div
                          className={`text-3xl font-bold ${
                            tier.highlighted ? "text-white" : "text-gray-900"
                          }`}
                        >
                          ${monthlyEquiv}
                          <span
                            className={`text-base font-normal ${
                              tier.highlighted ? "text-blue-100" : "text-gray-500"
                            }`}
                          >
                            /mo
                          </span>
                        </div>
                        {annual && (
                          <div
                            className={`text-xs mt-1 ${
                              tier.highlighted ? "text-blue-200" : "text-gray-500"
                            }`}
                          >
                            ${price.toLocaleString()} billed annually
                            {savePct > 0 && (
                              <span className="ml-1 text-green-500 font-semibold">
                                (save {savePct}%)
                              </span>
                            )}
                          </div>
                        )}
                        {!annual && (
                          <div
                            className={`text-xs mt-1 ${
                              tier.highlighted ? "text-blue-200" : "text-gray-400"
                            }`}
                          >
                            billed monthly
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <Link
                    href={tier.slug === "institutional" ? "mailto:hello@vantage.com" : "/signup"}
                  >
                    <Button
                      className={`w-full mb-6 font-semibold ${
                        tier.highlighted
                          ? "bg-white text-[hsl(221,83%,30%)] hover:bg-blue-50"
                          : ""
                      }`}
                      variant={tier.highlighted ? "default" : tier.ctaVariant}
                    >
                      {tier.cta}
                    </Button>
                  </Link>

                  <ul className="space-y-2.5 flex-1">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check
                          className={`h-4 w-4 mt-0.5 shrink-0 ${
                            tier.highlighted ? "text-blue-200" : "text-[hsl(221,83%,35%)]"
                          }`}
                        />
                        <span
                          className={`text-sm ${
                            tier.highlighted ? "text-blue-50" : "text-gray-600"
                          }`}
                        >
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Limits comparison callout */}
          <p className="text-center text-sm text-gray-500 mt-8">
            All paid plans include a 14-day free trial. No credit card required for Starter.{" "}
            <a href="mailto:hello@vantage.com" className="text-[hsl(221,83%,35%)] hover:underline">
              Questions? Talk to us.
            </a>
          </p>
        </div>
      </section>

      {/* FAQ / trust strip */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">
          Frequently asked questions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[
            {
              q: "Can I change plans later?",
              a: "Yes — upgrade or downgrade at any time. When upgrading, you're charged the prorated difference for the remainder of your billing period.",
            },
            {
              q: "What counts as a seat?",
              a: "A seat is one active user account in your organization. Admins and read-only viewers both count toward your seat limit.",
            },
            {
              q: "Is there a free trial for paid plans?",
              a: "All paid plans include a 14-day trial. You won't be charged until the trial ends and you choose to continue.",
            },
            {
              q: "How does the AI query limit work?",
              a: "Each AI-powered action (document extraction, narrative generation, anomaly detection) counts as one query. Unused queries do not roll over.",
            },
          ].map(({ q, a }) => (
            <div key={q}>
              <h3 className="font-semibold text-gray-900 mb-2">{q}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}

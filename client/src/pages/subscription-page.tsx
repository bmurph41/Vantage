// SubscriptionPage.tsx
// Place this file in: src/pages/SubscriptionPage.tsx (or src/components/SubscriptionPage.tsx)
// Subscription selection and management page

import React, { useState } from 'react';
import { Check, Sparkles, Building2, TrendingUp, Anchor, Briefcase, HelpCircle, Landmark, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEntitlements } from '@/contexts/EntitlementsContext';
import { useStripeStatus } from '@/hooks/useStripeStatus';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  SUBSCRIPTION_PACKAGES,
  PERSONA_OPTIONS,
  SubscriptionPackage,
  MODULE_INFO,
  FeatureModule,
  getModuleCategories,
  getModulesByCategory,
} from '@/config/featureModules';

// ═══════════════════════════════════════════════════════════════
// ICON MAPPING
// ═══════════════════════════════════════════════════════════════

const PersonaIcons: Record<string, React.ElementType> = {
  TrendingUp,
  Handshake: Briefcase, // Fallback since Handshake might not exist
  Anchor,
  Landmark,
  Briefcase,
  HelpCircle,
};

// ═══════════════════════════════════════════════════════════════
// MAIN SUBSCRIPTION PAGE
// ═══════════════════════════════════════════════════════════════

export function SubscriptionPage() {
  const [step, setStep] = useState<'persona' | 'packages' | 'customize'>('persona');
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [addOnModules, setAddOnModules] = useState<Set<FeatureModule>>(new Set());
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const { subscription, upgradeToPackage, addModule } = useEntitlements();
  const { isStripeConfigured } = useStripeStatus();
  const { toast } = useToast();

  const checkoutMutation = useMutation({
    mutationFn: async ({ packType, billingCycle }: { packType: string; billingCycle: string }) => {
      const res = await apiRequest("POST", "/api/stripe/checkout", { packType, billingCycle });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err: any) => {
      toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
    },
  });

  // ─────────────────────────────────────────────────────────────
  // Get recommended package based on persona
  // ─────────────────────────────────────────────────────────────
  const recommendedPackageSlug = selectedPersona 
    ? PERSONA_OPTIONS.find(p => p.id === selectedPersona)?.recommendedPackage 
    : null;

  // ─────────────────────────────────────────────────────────────
  // Handle package selection
  // ─────────────────────────────────────────────────────────────
  const handleSelectPackage = (packageSlug: string) => {
    setSelectedPackage(packageSlug);
    setStep('customize');
  };

  // ─────────────────────────────────────────────────────────────
  // Handle final subscription
  // ─────────────────────────────────────────────────────────────
  const handleSubscribe = () => {
    if (!selectedPackage) return;

    if (isStripeConfigured) {
      // Route through Stripe checkout for paid subscription
      checkoutMutation.mutate({ packType: selectedPackage, billingCycle });
    } else {
      // Stripe not configured — activate locally (beta/trial mode)
      upgradeToPackage(selectedPackage);
      addOnModules.forEach(m => addModule(m));
      toast({ title: "Plan activated", description: "Your subscription has been activated. Free trial active during beta." });
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Calculate total price
  // ─────────────────────────────────────────────────────────────
  const selectedPkg = SUBSCRIPTION_PACKAGES.find(p => p.slug === selectedPackage);
  const basePrice = selectedPkg 
    ? (billingCycle === 'monthly' ? selectedPkg.priceMonthly : selectedPkg.priceYearly / 12)
    : 0;
  
  const addOnPrice = Array.from(addOnModules).reduce((sum, module) => {
    const info = MODULE_INFO[module];
    return sum + (info?.price || 0);
  }, 0);

  const totalPrice = basePrice + addOnPrice;

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* ─────────────────────────────────────────────────────── */}
      {/* Header */}
      {/* ─────────────────────────────────────────────────────── */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">Choose Your Plan</h1>
        <p className="text-muted-foreground">
          {step === 'persona' && "Tell us about yourself so we can recommend the best plan"}
          {step === 'packages' && "Select a plan that fits your needs"}
          {step === 'customize' && "Customize your plan with add-on modules"}
        </p>
      </div>

      {/* ─────────────────────────────────────────────────────── */}
      {/* Step 1: Persona Selection */}
      {/* ─────────────────────────────────────────────────────── */}
      {step === 'persona' && (
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-semibold mb-4 text-center">What best describes you?</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {PERSONA_OPTIONS.map((persona) => {
              const Icon = PersonaIcons[persona.icon] || HelpCircle;
              return (
                <button
                  key={persona.id}
                  onClick={() => {
                    setSelectedPersona(persona.id);
                    setSelectedPackage(persona.recommendedPackage);
                    setStep('packages');
                  }}
                  className={cn(
                    "p-6 rounded-xl border-2 text-left transition-all hover:border-primary hover:bg-primary/5",
                    selectedPersona === persona.id && "border-primary bg-primary/5"
                  )}
                >
                  <Icon className="h-8 w-8 mb-3 text-primary" />
                  <div className="font-semibold mb-1">{persona.name}</div>
                  <div className="text-sm text-muted-foreground">{persona.description}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────── */}
      {/* Step 2: Package Selection */}
      {/* ─────────────────────────────────────────────────────── */}
      {step === 'packages' && (
        <div>
          {/* Billing toggle */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center bg-muted rounded-lg p-1">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  billingCycle === 'monthly' && "bg-background shadow"
                )}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  billingCycle === 'yearly' && "bg-background shadow"
                )}
              >
                Yearly
                <span className="ml-1 text-xs text-green-600">Save 17%</span>
              </button>
            </div>
          </div>

          {/* Package cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {SUBSCRIPTION_PACKAGES.map((pkg) => (
              <PackageCard
                key={pkg.id}
                package={pkg}
                isRecommended={pkg.slug === recommendedPackageSlug}
                isSelected={selectedPackage === pkg.slug}
                isCurrent={subscription.packageSlug === pkg.slug}
                billingCycle={billingCycle}
                onSelect={() => handleSelectPackage(pkg.slug)}
              />
            ))}
          </div>

          {/* Back button */}
          <div className="mt-8 text-center">
            <button
              onClick={() => setStep('persona')}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to persona selection
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────── */}
      {/* Step 3: Customize with Add-ons */}
      {/* ─────────────────────────────────────────────────────── */}
      {step === 'customize' && selectedPkg && (
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Add-on modules */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-semibold mb-4">Customize Your Plan</h2>
            <p className="text-muted-foreground mb-6">
              Your <span className="font-medium text-foreground">{selectedPkg.name}</span> plan 
              includes the modules below. Add more modules à la carte.
            </p>

            {getModuleCategories().map((category) => (
              <ModuleCategorySection
                key={category}
                category={category}
                modules={getModulesByCategory(category)}
                includedModules={new Set(selectedPkg.modules)}
                addOnModules={addOnModules}
                onToggleAddOn={(module) => {
                  setAddOnModules(prev => {
                    const next = new Set(prev);
                    if (next.has(module)) {
                      next.delete(module);
                    } else {
                      next.add(module);
                    }
                    return next;
                  });
                }}
              />
            ))}

            {/* Back button */}
            <button
              onClick={() => setStep('packages')}
              className="mt-6 text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to package selection
            </button>
          </div>

          {/* Order summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 bg-muted/50 rounded-xl p-6">
              <h3 className="font-semibold mb-4">Order Summary</h3>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span>{selectedPkg.name}</span>
                  <span>${billingCycle === 'monthly' ? selectedPkg.priceMonthly : (selectedPkg.priceYearly / 12).toFixed(0)}/mo</span>
                </div>
                
                {Array.from(addOnModules).map((module) => {
                  const info = MODULE_INFO[module];
                  return (
                    <div key={module} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{info?.name}</span>
                      <span>${info?.price || 0}/mo</span>
                    </div>
                  );
                })}
              </div>

              <div className="border-t pt-4 mb-6">
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span>${totalPrice.toFixed(0)}/mo</span>
                </div>
                {billingCycle === 'yearly' && (
                  <div className="text-sm text-muted-foreground">
                    Billed annually (${(totalPrice * 12).toFixed(0)}/year)
                  </div>
                )}
              </div>

              <button
                onClick={handleSubscribe}
                className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                {subscription.packageSlug ? 'Update Subscription' : 'Start Free Trial'}
              </button>
              
              <p className="text-xs text-muted-foreground text-center mt-3">
                14-day free trial • Cancel anytime
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PACKAGE CARD COMPONENT
// ═══════════════════════════════════════════════════════════════

interface PackageCardProps {
  package: SubscriptionPackage;
  isRecommended: boolean;
  isSelected: boolean;
  isCurrent: boolean;
  billingCycle: 'monthly' | 'yearly';
  onSelect: () => void;
}

function PackageCard({ 
  package: pkg, 
  isRecommended, 
  isSelected,
  isCurrent,
  billingCycle,
  onSelect 
}: PackageCardProps) {
  const price = billingCycle === 'monthly' ? pkg.priceMonthly : pkg.priceYearly / 12;

  return (
    <div
      className={cn(
        "relative rounded-xl border-2 p-6 transition-all",
        isRecommended && "border-primary shadow-lg",
        isSelected && !isRecommended && "border-primary/50",
        !isRecommended && !isSelected && "border-border hover:border-primary/30"
      )}
    >
      {/* Badges */}
      {(isRecommended || pkg.popular) && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className={cn(
            "px-3 py-1 rounded-full text-xs font-medium",
            isRecommended 
              ? "bg-primary text-primary-foreground" 
              : "bg-amber-100 text-amber-700"
          )}>
            {isRecommended ? 'Recommended' : 'Popular'}
          </span>
        </div>
      )}

      {isCurrent && (
        <div className="absolute -top-3 right-4">
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            Current Plan
          </span>
        </div>
      )}

      {/* Header */}
      <div className="mb-4">
        <h3 className="text-xl font-semibold">{pkg.name}</h3>
        <p className="text-sm text-muted-foreground">{pkg.description}</p>
      </div>

      {/* Price */}
      <div className="mb-6">
        <span className="text-3xl font-bold">${price.toFixed(0)}</span>
        <span className="text-muted-foreground">/month</span>
        {billingCycle === 'yearly' && (
          <div className="text-sm text-green-600">
            Save ${(pkg.priceMonthly * 12 - pkg.priceYearly).toFixed(0)}/year
          </div>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-2 mb-6">
        {pkg.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={onSelect}
        disabled={isCurrent}
        className={cn(
          "w-full py-2.5 rounded-lg font-medium transition-colors",
          isRecommended
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "border hover:bg-muted",
          isCurrent && "opacity-50 cursor-not-allowed"
        )}
      >
        {isCurrent ? 'Current Plan' : 'Select Plan'}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODULE CATEGORY SECTION
// ═══════════════════════════════════════════════════════════════

interface ModuleCategorySectionProps {
  category: string;
  modules: { key: FeatureModule; name: string; description: string; price?: number }[];
  includedModules: Set<FeatureModule>;
  addOnModules: Set<FeatureModule>;
  onToggleAddOn: (module: FeatureModule) => void;
}

function ModuleCategorySection({
  category,
  modules,
  includedModules,
  addOnModules,
  onToggleAddOn,
}: ModuleCategorySectionProps) {
  return (
    <div className="mb-6">
      <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider mb-3">
        {category}
      </h3>
      <div className="space-y-2">
        {modules.map((module) => {
          const isIncluded = includedModules.has(module.key);
          const isAddOn = addOnModules.has(module.key);
          
          return (
            <div
              key={module.key}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border",
                isIncluded && "bg-primary/5 border-primary/20",
                isAddOn && !isIncluded && "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-5 h-5 rounded flex items-center justify-center",
                  (isIncluded || isAddOn) ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  {(isIncluded || isAddOn) && <Check className="h-3 w-3" />}
                </div>
                <div>
                  <div className="font-medium text-sm">{module.name}</div>
                  <div className="text-xs text-muted-foreground">{module.description}</div>
                </div>
              </div>
              
              {isIncluded ? (
                <span className="text-xs text-primary font-medium">Included</span>
              ) : module.price ? (
                <button
                  onClick={() => onToggleAddOn(module.key)}
                  className={cn(
                    "px-3 py-1 rounded text-sm font-medium transition-colors",
                    isAddOn
                      ? "bg-amber-200 text-amber-800 hover:bg-amber-300 dark:bg-amber-800 dark:text-amber-200"
                      : "bg-muted hover:bg-muted/80"
                  )}
                >
                  {isAddOn ? 'Remove' : `+$${module.price}/mo`}
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">Contact us</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SubscriptionPage;

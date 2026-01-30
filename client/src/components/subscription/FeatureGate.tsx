// FeatureGate.tsx
// Place this file in: src/components/FeatureGate.tsx
// Component to gate features/routes based on user's modules

import React from 'react';
import { Link } from 'wouter';
import { Lock, ArrowRight, Sparkles } from 'lucide-react';
import { useEntitlements, useUpgradePrompt } from '@/contexts/EntitlementsContext';
import { FeatureModule } from '@/config/featureModules';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════
// FEATURE GATE COMPONENT
// ═══════════════════════════════════════════════════════════════
// Wraps content that requires specific modules.
// Shows upgrade prompt if user doesn't have access.

interface FeatureGateProps {
  requiredModules: FeatureModule[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
}

export function FeatureGate({ 
  requiredModules, 
  children, 
  fallback,
  className 
}: FeatureGateProps) {
  const { hasAnyModule } = useEntitlements();
  
  if (hasAnyModule(requiredModules)) {
    return <>{children}</>;
  }
  
  if (fallback) {
    return <>{fallback}</>;
  }
  
  return (
    <div className={cn("p-8", className)}>
      <UpgradePrompt requiredModules={requiredModules} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// UPGRADE PROMPT COMPONENT
// ═══════════════════════════════════════════════════════════════

interface UpgradePromptProps {
  requiredModules: FeatureModule[];
  title?: string;
  description?: string;
  onUpgradeClick?: () => void;
}

export function UpgradePrompt({ 
  requiredModules,
  title,
  description,
}: UpgradePromptProps) {
  const { missingModuleInfo, suggestedPackage } = useUpgradePrompt(requiredModules);
  
  const moduleNames = missingModuleInfo
    .map(m => m?.name)
    .filter(Boolean)
    .join(', ');

  return (
    <div className="max-w-md mx-auto text-center">
      {/* Icon */}
      <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
        <Lock className="h-8 w-8 text-primary" />
      </div>
      
      {/* Title */}
      <h2 className="text-2xl font-semibold mb-2">
        {title || 'Upgrade to Access'}
      </h2>
      
      {/* Description */}
      <p className="text-muted-foreground mb-6">
        {description || `This feature requires: ${moduleNames || 'additional modules'}`}
      </p>
      
      {/* Suggested package */}
      {suggestedPackage && (
        <div className="bg-muted/50 rounded-lg p-4 mb-6 text-left">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium">Recommended</span>
          </div>
          <div className="text-lg font-semibold">{suggestedPackage.name}</div>
          <div className="text-sm text-muted-foreground mb-2">
            ${suggestedPackage.priceMonthly}/month
          </div>
          <ul className="text-sm space-y-1">
            {suggestedPackage.features.slice(0, 4).map((feature, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="text-primary">✓</span>
                {feature}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* CTA Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/settings/subscription"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          Upgrade Now
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/pricing"
          className="inline-flex items-center justify-center px-6 py-3 border rounded-lg font-medium hover:bg-muted/50 transition-colors"
        >
          View All Plans
        </Link>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// INLINE UPGRADE BADGE
// ═══════════════════════════════════════════════════════════════
// Small badge to show next to locked features in lists/menus

interface UpgradeBadgeProps {
  className?: string;
}

export function UpgradeBadge({ className }: UpgradeBadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      className
    )}>
      <Lock className="h-3 w-3" />
      Pro
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
// FEATURE CHECK HOOK COMPONENT
// ═══════════════════════════════════════════════════════════════
// Render prop component for conditional rendering

interface FeatureCheckProps {
  modules: FeatureModule[];
  children: (hasAccess: boolean) => React.ReactNode;
}

export function FeatureCheck({ modules, children }: FeatureCheckProps) {
  const { hasAnyModule } = useEntitlements();
  return <>{children(hasAnyModule(modules))}</>;
}

// ═══════════════════════════════════════════════════════════════
// LOCKED OVERLAY
// ═══════════════════════════════════════════════════════════════
// Overlay to show on locked content (blurred preview)

interface LockedOverlayProps {
  requiredModules: FeatureModule[];
  children: React.ReactNode;
  showPreview?: boolean;
}

export function LockedOverlay({ 
  requiredModules, 
  children, 
  showPreview = true 
}: LockedOverlayProps) {
  const { hasAnyModule } = useEntitlements();
  
  if (hasAnyModule(requiredModules)) {
    return <>{children}</>;
  }
  
  return (
    <div className="relative">
      {showPreview && (
        <div className="blur-sm pointer-events-none select-none">
          {children}
        </div>
      )}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
        <div className="text-center p-4">
          <Lock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-3">
            Upgrade to access this feature
          </p>
          <Link
            href="/settings/subscription"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            View Plans <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

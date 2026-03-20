import { ReactNode } from "react";
import { Redirect } from "wouter";
import { useEnabledOpsModules } from "@/hooks/use-enabled-ops-modules";

interface OpsModuleGuardProps {
  moduleKey: string;
  children: ReactNode;
}

/**
 * Route guard that checks if an operations module is enabled
 * for the current user's owned asset classes.
 * If not enabled, redirects to the operations landing page.
 */
export function OpsModuleGuard({ moduleKey, children }: OpsModuleGuardProps) {
  const { isModuleEnabled, isLoading, enabledModules } = useEnabledOpsModules();

  // While loading, show the content (prevents flash)
  if (isLoading) {
    return <>{children}</>;
  }

  // If no modules data (no owned assets), show all modules
  if (enabledModules.length === 0) {
    return <>{children}</>;
  }

  // If module is not enabled for this user's asset classes, redirect
  if (!isModuleEnabled(moduleKey)) {
    return <Redirect to="/portfolio" />;
  }

  return <>{children}</>;
}

import { apiRequest } from "@/lib/queryClient";

export interface IntegrationCapabilities {
  dataRead: string[];
  dataWrite: string[];
  actions: string[];
  uiHooks: string[];
}

export interface SettingsField {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "select" | "secret";
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
  helpText?: string;
}

export interface ConnectionGuide {
  overview: string;
  prerequisites: string[];
  steps: Array<{
    title: string;
    description: string;
    screenshot?: string;
  }>;
  supportUrl?: string;
  apiDocsUrl?: string;
  estimatedTime: string;
}

export interface DataMapping {
  sourceEntity: string;
  targetModule: string;
  targetEntity: string;
  fields: Array<{
    source: string;
    target: string;
    transform?: string;
  }>;
  syncDirection: "read" | "write" | "bidirectional";
  frequency: "realtime" | "hourly" | "daily" | "weekly" | "manual";
}

export interface MigrationSupport {
  canExportAll: boolean;
  supportsHistoricalImport: boolean;
  migrationComplexity: "low" | "medium" | "high";
  estimatedMigrationDays: number;
}

export interface IntegrationItem {
  key: string;
  name: string;
  description: string | null;
  category: string;
  contexts: string[];
  uiPlacements?: string[];
  authType: "oauth" | "apiKey" | "none";
  websiteUrl: string | null;
  iconUrl: string | null;
  logoColor?: string | null;
  capabilities: IntegrationCapabilities;
  settingsSchema: { fields: SettingsField[] };
  connectionGuide?: ConnectionGuide | null;
  dataMappings?: DataMapping[];
  migrationSupport?: MigrationSupport | null;
  status: "available" | "connected" | "pending" | "error";
  lastSyncAt?: string | null;
  errorMessage?: string | null;
  settings?: Record<string, any>;
}

export interface IntegrationsListResponse {
  items: IntegrationItem[];
}

export interface ContextIntegrationsResponse {
  contextKey: string;
  items: IntegrationItem[];
}

export interface ConnectResponse {
  success?: boolean;
  status?: string;
  authorizeUrl?: string;
  message?: string;
}

export async function fetchIntegrations(): Promise<IntegrationsListResponse> {
  const res = await fetch("/api/integrations", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch integrations");
  return res.json();
}

export async function fetchIntegrationsForContext(contextKey: string): Promise<ContextIntegrationsResponse> {
  const res = await fetch(`/api/integrations/context/${encodeURIComponent(contextKey)}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load context integrations");
  return res.json();
}

export async function fetchIntegration(key: string): Promise<IntegrationItem> {
  const res = await fetch(`/api/integrations/${encodeURIComponent(key)}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch integration");
  return res.json();
}

export async function connectIntegration(key: string, payload?: { apiKey?: string; settings?: Record<string, any> }): Promise<ConnectResponse> {
  const res = await apiRequest("POST", `/api/integrations/${encodeURIComponent(key)}/connect`, payload || {});
  return res.json();
}

export async function disconnectIntegration(key: string): Promise<{ success: boolean }> {
  const res = await apiRequest("POST", `/api/integrations/${encodeURIComponent(key)}/disconnect`);
  return res.json();
}

export async function updateIntegrationSettings(key: string, settings: Record<string, any>): Promise<{ success: boolean }> {
  const res = await apiRequest("PATCH", `/api/integrations/${encodeURIComponent(key)}/settings`, { settings });
  return res.json();
}

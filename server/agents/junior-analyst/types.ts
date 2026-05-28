export type AgentId =
  | 'document_intake'
  | 'underwriting'
  | 'deal_scout'
  | 'dd_coordinator'
  | 'rent_roll'
  | 'market_pulse'
  | 'outreach';

export type SuggestionPriority = 'low' | 'normal' | 'high' | 'critical';
export type SuggestionStatus = 'pending' | 'approved' | 'dismissed' | 'acted';
export type JaMode = 'manual' | 'assisted';

export interface CreateSuggestionInput {
  orgId: string;
  projectId?: string;
  dealId?: string;
  agentId: AgentId;
  agentName: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: SuggestionPriority;
  triggeredBy?: string;
}

export type JaEventMap = {
  'doc:uploaded': { orgId: string; projectId: string; uploadId: string; filename: string; docType?: string };
  'doc:parsed': { orgId: string; projectId: string; uploadId: string; itemCount: number; highConfidence: number };
  'deal:created': { orgId: string; dealId: string; dealName: string; stage: string; address?: string; askPrice?: number; assetClass?: string };
  'deal:stage_changed': { orgId: string; dealId: string; dealName: string; from: string; to: string };
  'pnl:imported': { orgId: string; projectId: string; year: number; lineItemCount: number; ebitda?: number };
  'rent_roll:imported': { orgId: string; projectId: string; unitCount: number; occupancyRate?: number };
  'dd:item_overdue': { orgId: string; dealId: string; itemId: string; itemName: string; daysOverdue: number };
};

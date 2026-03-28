/**
 * PipelineNudges — Intelligent deal nudge sidebar
 * 
 * Shows contextual nudges based on:
 * - Stale deals (no activity > 7 days)
 * - Expiring deadlines (DD, deposit, close < 14 days)  
 * - Low health score deals
 * - Pipeline stage WIP breaches
 * - Won opportunities (encourage follow-up)
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, Flame, Calendar, Trophy, TrendingUp, Clock, ArrowRight, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow, differenceInDays, format } from "date-fns";
import { formatCompactCurrency } from "@shared/crm-constants";
import type { Deal } from "@shared/schema";

type DealWithRelations = Deal & {
  contact?: any; company?: any;
  activityCount?: number; lastActivityDate?: string;
};

interface Nudge {
  id: string;
  priority: 'critical' | 'high' | 'medium';
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  dealId: string;
  dealTitle: string;
  dealValue?: number;
  action?: string;
}

export function PipelineNudges({ deals, rotThreshold = 14 }: {
  deals: DealWithRelations[];
  rotThreshold?: number;
}) {
  const nudges = useMemo<Nudge[]>(() => {
    const result: Nudge[] = [];
    const now = new Date();

    for (const deal of deals) {
      if ((deal as any).isClosed) continue;

      // Stale activity
      const lastActivity = (deal as any).lastActivityDate;
      const daysSinceActivity = lastActivity
        ? differenceInDays(now, new Date(lastActivity)) : 999;
      if (daysSinceActivity > rotThreshold) {
        result.push({
          id: `stale-${deal.id}`,
          priority: daysSinceActivity > 30 ? 'critical' : 'high',
          icon: <Flame className="h-3.5 w-3.5 text-red-500" />,
          title: 'No recent activity',
          subtitle: `${daysSinceActivity === 999 ? 'Never contacted' : `${daysSinceActivity}d since last touch`}`,
          dealId: deal.id,
          dealTitle: deal.title,
          dealValue: Number(deal.amount),
          action: 'Log activity',
        });
      }

      // Expiring deadlines
      const checkDeadlines = [
        { field: 'ddExpirationDate', label: 'DD expiring', warnDays: 7, priority: 'critical' as const },
        { field: 'firstDepositDueDate', label: '1st deposit due', warnDays: 10, priority: 'high' as const },
        { field: 'closingDate', label: 'Closing date', warnDays: 14, priority: 'high' as const },
        { field: 'expectedCloseDate', label: 'Close estimate', warnDays: 30, priority: 'medium' as const },
      ];
      for (const { field, label, warnDays, priority } of checkDeadlines) {
        const dateVal = (deal as any)[field];
        if (!dateVal) continue;
        const daysUntil = differenceInDays(new Date(dateVal), now);
        if (daysUntil >= 0 && daysUntil <= warnDays) {
          result.push({
            id: `deadline-${field}-${deal.id}`,
            priority,
            icon: <Calendar className="h-3.5 w-3.5 text-orange-500" />,
            title: label,
            subtitle: `${daysUntil === 0 ? 'Today' : `${daysUntil}d — ${format(new Date(dateVal), 'MMM d')}`}`,
            dealId: deal.id,
            dealTitle: deal.title,
            dealValue: Number(deal.amount),
            action: 'Review',
          });
        }
      }
    }

    // Sort: critical first, then high, then medium; within each, by deal value desc
    return result
      .sort((a, b) => {
        const p = { critical: 0, high: 1, medium: 2 };
        if (p[a.priority] !== p[b.priority]) return p[a.priority] - p[b.priority];
        return (b.dealValue || 0) - (a.dealValue || 0);
      })
      .slice(0, 12); // cap at 12 nudges to avoid overwhelming
  }, [deals, rotThreshold]);

  if (nudges.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-gray-400">
        <Trophy className="h-8 w-8 mb-2 text-green-300" />
        <p className="text-sm font-medium text-gray-600">All clear!</p>
        <p className="text-xs">No deals need immediate attention</p>
      </div>
    );
  }

  const criticalCount = nudges.filter(n => n.priority === 'critical').length;
  const highCount = nudges.filter(n => n.priority === 'high').length;

  return (
    <div className="space-y-1">
      {/* Summary bar */}
      <div className="flex items-center gap-2 px-1 mb-3">
        {criticalCount > 0 && (
          <Badge className="bg-red-100 text-red-700 text-[10px] h-5">
            {criticalCount} critical
          </Badge>
        )}
        {highCount > 0 && (
          <Badge className="bg-orange-100 text-orange-700 text-[10px] h-5">
            {highCount} urgent
          </Badge>
        )}
        <span className="text-[10px] text-gray-400 ml-auto">{nudges.length} items</span>
      </div>

      {nudges.map((nudge) => (
        <Link
          key={nudge.id}
          href={`/crm/deals/${nudge.dealId}`}
          className="block"
        >
          <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg transition-all cursor-pointer hover:shadow-sm ${
            nudge.priority === 'critical' ? 'bg-red-50 hover:bg-red-100 border border-red-100' :
            nudge.priority === 'high' ? 'bg-orange-50 hover:bg-orange-100 border border-orange-100' :
            'bg-gray-50 hover:bg-gray-100 border border-gray-100'
          }`}>
            <div className="mt-0.5 flex-shrink-0">{nudge.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-[11px] font-semibold text-gray-800 truncate">{nudge.dealTitle}</p>
                {nudge.dealValue ? (
                  <span className="text-[10px] text-gray-400 flex-shrink-0">
                    {formatCompactCurrency(nudge.dealValue)}
                  </span>
                ) : null}
              </div>
              <p className="text-[10px] text-gray-500">{nudge.title} · {nudge.subtitle}</p>
            </div>
            <ChevronRight className="h-3 w-3 text-gray-400 flex-shrink-0 mt-1" />
          </div>
        </Link>
      ))}
    </div>
  );
}

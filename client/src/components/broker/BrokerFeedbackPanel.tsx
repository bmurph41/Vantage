/**
 * BrokerFeedbackPanel
 *
 * Reusable panel rendered on (a) the marketplace listing detail sheet and
 * (b) the modeling project workspace overview tab. Shows verdicts from every
 * broker the user follows, with matched/failed criteria chips and — for
 * Marketplace+ Pro subscribers — a generated narrative in the broker's voice.
 *
 * Free/Solo users see the verdict + score + chips but no narrative (narrative
 * is stripped server-side). An inline upgrade prompt is shown instead.
 */

import { useListingBrokerFeedback, useModelingProjectBrokerFeedback, type BrokerFeedbackItem } from "@/hooks/use-broker-feedback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, TrendingUp, Eye, Ban, Lock } from "lucide-react";

type Props =
  | { targetType: "listing"; targetId: string }
  | { targetType: "modeling-project"; targetId: string };

const VERDICT_STYLE = {
  pursue: { label: "Would pursue", Icon: TrendingUp, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  watch: { label: "Worth watching", Icon: Eye, color: "text-amber-700 bg-amber-50 border-amber-200" },
  pass: { label: "Would pass", Icon: Ban, color: "text-slate-600 bg-slate-50 border-slate-200" },
} as const;

export function BrokerFeedbackPanel(props: Props) {
  const listingQ = useListingBrokerFeedback(
    props.targetType === "listing" ? props.targetId : null,
  );
  const modelingQ = useModelingProjectBrokerFeedback(
    props.targetType === "modeling-project" ? props.targetId : null,
  );
  const query = props.targetType === "listing" ? listingQ : modelingQ;

  if (query.isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Broker feedback</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading broker verdicts…
          </div>
        </CardContent>
      </Card>
    );
  }

  if (query.isError) {
    const msg = (query.error as Error)?.message || "";
    const isTierBlock = msg.toLowerCase().includes("pro");
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            {isTierBlock && <Lock className="h-3.5 w-3.5" />}
            Broker feedback
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">
            {isTierBlock ? (
              <>
                Broker feedback on modeling projects requires Marketplace+ Pro.{" "}
                <a className="underline" href="/settings/billing?upgrade=marketplace_plus&feature=broker_feedback_modeling">
                  Upgrade
                </a>
              </>
            ) : (
              msg || "Failed to load broker feedback"
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const data = query.data;
  if (!data) return null;

  if (data.feedback.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Broker feedback</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">
            Follow brokers from the{" "}
            <a className="underline" href="/brokers">directory</a> to see their take on this {props.targetType === "listing" ? "deal" : "project"}.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span>Broker feedback</span>
          <span className="text-[10px] font-normal text-muted-foreground">
            {data.feedback.length} broker{data.feedback.length === 1 ? "" : "s"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.feedback.map((item) => (
          <FeedbackRow key={item.id} item={item} canSeeNarrative={data.canSeeNarrative} />
        ))}
        {!data.canSeeNarrative && (
          <div className="rounded border border-dashed border-slate-200 p-3 text-xs text-muted-foreground">
            Upgrade to{" "}
            <a className="underline font-medium" href="/settings/billing?upgrade=marketplace_plus&feature=broker_feedback_narrative">
              Marketplace+ Pro
            </a>{" "}
            to see each broker's narrative reasoning in their own voice.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FeedbackRow({ item, canSeeNarrative }: { item: BrokerFeedbackItem; canSeeNarrative: boolean }) {
  const style = VERDICT_STYLE[item.verdict];
  const Icon = style.Icon;
  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${style.color}`}>
          <Icon className="h-3 w-3" /> {style.label}
        </span>
        <span className="text-[10px] text-muted-foreground font-mono">{item.score}/100</span>
      </div>

      {canSeeNarrative && item.narrative && (
        <p className="text-xs italic text-slate-700 leading-relaxed">"{item.narrative}"</p>
      )}

      {item.matchedCriteria.length > 0 && (
        <div className="space-y-1">
          {item.matchedCriteria.map((c) => (
            <div key={c.key} className="flex items-start gap-1.5 text-[11px] text-emerald-700">
              <CheckCircle2 className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>
                <span className="font-medium">{c.label}:</span> {c.detail}
              </span>
            </div>
          ))}
        </div>
      )}

      {item.failedCriteria.length > 0 && (
        <div className="space-y-1">
          {item.failedCriteria.map((c) => (
            <div key={c.key} className="flex items-start gap-1.5 text-[11px] text-slate-500">
              <XCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>
                <span className="font-medium">{c.label}:</span> {c.detail}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default BrokerFeedbackPanel;

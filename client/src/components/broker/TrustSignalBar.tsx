import { Badge } from "@/components/ui/badge";
import type { BrokerTrustSignals } from "@/hooks/use-broker-subscriptions";

function formatCurrency(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "$0";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function formatHours(h: number | null): string {
  if (h == null || !Number.isFinite(h)) return "—";
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

function licenseLabel(level: BrokerTrustSignals["licenseStatus"]["level"], daysUntil: number | null, state: string | null): {
  label: string;
  tone: "ok" | "warning" | "danger" | "neutral";
} {
  if (level === "expired") return { label: state ? `${state} license expired` : "License expired", tone: "danger" };
  if (level === "missing") return { label: "License on file", tone: "neutral" };
  if (level === "critical") return {
    label: `${state ? state + " " : ""}license · ${daysUntil ?? 0}d left`,
    tone: "danger",
  };
  if (level === "warning") return {
    label: `${state ? state + " " : ""}license · ${daysUntil ?? 0}d left`,
    tone: "warning",
  };
  return { label: state ? `${state} license · current` : "License current", tone: "ok" };
}

export function TrustStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-lg font-semibold text-slate-900" data-testid={`trust-${label.toLowerCase().replace(/\s+/g, "-")}`}>
        {value}
      </div>
      {hint && <div className="text-xs text-slate-400 mt-0.5">{hint}</div>}
    </div>
  );
}

export function TrustSignalBar({
  signals,
  compact = false,
}: {
  signals: BrokerTrustSignals;
  compact?: boolean;
}) {
  const lic = licenseLabel(signals.licenseStatus.level, signals.licenseStatus.daysUntilExpiry, signals.licenseState);
  const toneClass: Record<"ok" | "warning" | "danger" | "neutral", string> = {
    ok: "bg-emerald-50 text-emerald-800 border-emerald-200",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
    danger: "bg-rose-50 text-rose-800 border-rose-200",
    neutral: "bg-slate-50 text-slate-700 border-slate-200",
  };

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {signals.verifiedClosedDealsCount > 0 && (
          <Badge variant="secondary" className="font-normal">
            {signals.verifiedClosedDealsCount} verified closed · {formatCurrency(signals.verifiedClosedDealsVolume)}
          </Badge>
        )}
        {signals.medianResponseHours != null && (
          <Badge variant="secondary" className="font-normal">
            Responds in ~{formatHours(signals.medianResponseHours)}
          </Badge>
        )}
        {signals.responseRate30d != null && signals.responseSamples30d >= 3 && (
          <Badge variant="secondary" className="font-normal">
            {Math.round(signals.responseRate30d)}% reply rate
          </Badge>
        )}
        <Badge variant="outline" className={`font-normal border ${toneClass[lic.tone]}`}>
          {lic.label}
        </Badge>
        {signals.isFeatured && (
          <Badge className="font-normal bg-teal-700 hover:bg-teal-700">Featured</Badge>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <TrustStat
          label="Verified closed"
          value={signals.verifiedClosedDealsCount.toString()}
          hint={signals.verifiedClosedDealsCount > 0 ? formatCurrency(signals.verifiedClosedDealsVolume) + " volume" : "No verified closes yet"}
        />
        <TrustStat
          label="Response time"
          value={formatHours(signals.medianResponseHours ?? signals.averageResponseHours)}
          hint={
            signals.responseSamples30d >= 3
              ? `${signals.responseSamples30d} samples · last 30d`
              : "Insufficient data"
          }
        />
        <TrustStat
          label="Reply rate"
          value={
            signals.responseRate30d != null && signals.responseSamples30d >= 3
              ? `${Math.round(signals.responseRate30d)}%`
              : "—"
          }
          hint="Last 30 days"
        />
        <TrustStat
          label="Followers"
          value={signals.followerCount.toLocaleString()}
          hint={`${signals.advisorySubscriberCount} advisory subs`}
        />
        <TrustStat
          label="Experience"
          value={signals.yearsExperience != null ? `${signals.yearsExperience}y` : "—"}
          hint="Years active"
        />
      </div>
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={`font-normal border ${toneClass[lic.tone]}`} data-testid="trust-license">
          {lic.label}
        </Badge>
        {signals.verifiedClosedDealsAssetClasses.length > 0 && (
          <span className="text-xs text-slate-500">
            Asset classes:{" "}
            <span className="text-slate-700">
              {signals.verifiedClosedDealsAssetClasses.slice(0, 6).join(", ")}
              {signals.verifiedClosedDealsAssetClasses.length > 6 ? "…" : ""}
            </span>
          </span>
        )}
        {signals.isFeatured && (
          <Badge className="font-normal bg-teal-700 hover:bg-teal-700 ml-auto">Featured broker</Badge>
        )}
      </div>
    </div>
  );
}

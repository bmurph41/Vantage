#!/usr/bin/env bash
# Route smoke test for MarinaMatch. Hits representative GET endpoints in each
# major surface; demo auth is active in dev so no cookie needed.

set -u
BASE="http://127.0.0.1:5000"
PID="6b3a9021-f393-489d-9274-321ac76eae08"
LOG="/tmp/smoke_results.tsv"
FAIL="/tmp/smoke_failures.txt"
: > "$LOG"
: > "$FAIL"

endpoints=(
  # Health & config
  "GET /api/health"
  "GET /health/live"
  "GET /health/ready"
  "GET /api/config"
  "GET /api/auth/me"
  "GET /api/subscription/tiers"
  "GET /api/organization/features"

  # CRM core
  "GET /api/crm/contacts"
  "GET /api/crm/companies"
  "GET /api/crm/deals"
  "GET /api/crm/leads"
  "GET /api/crm/activities"
  "GET /api/crm/timeline"
  "GET /api/crm/saved-views"
  "GET /api/crm/notes"
  "GET /api/crm/analytics/pipeline"
  "GET /api/pipeline/analytics/pipeline"
  "GET /api/crm/forecasting/forecast"
  "GET /api/crm/playbooks"
  "GET /api/comments"

  # Broker marketplace
  "GET /api/broker-subscriptions/directory"
  "GET /api/broker-subscriptions/feature-flags"
  "GET /api/broker-subscriptions/me/subscriptions"
  "GET /api/broker-dashboard/my-profile"
  "GET /api/broker-dashboard/advisory-packages"
  "GET /api/broker-dashboard/content"
  "GET /api/broker-registration/status"
  "GET /api/broker-feedback/inbound"

  # Billing & fund
  "GET /api/billing/plans"
  "GET /api/billing/subscription"
  "GET /api/fund-management/funds"

  # Workflow
  "GET /api/workflow-automations"
  "GET /api/workflow-automations/meta/triggers"
  "GET /api/workflow-automations/meta/templates"
  "GET /api/workflow-v2/webhooks"
  "GET /api/workflow-v2/scheduled-triggers"
  "GET /api/workflow-v2/pipelines"

  # Modeling
  "GET /api/modeling/projects/$PID/pnl-lines"
  "GET /api/modeling/projects/$PID/pnl-summary"
  "GET /api/modeling/projects/$PID/documents"
  "GET /api/modeling/projects/$PID/validation-warnings"
  "GET /api/modeling/projects/$PID/benchmarks"
  "GET /api/modeling/projects/$PID/sensitivity-matrices"
  "GET /api/modeling/projects/$PID/threads"
  "GET /api/modeling/projects/$PID/approval-requests"
  "GET /api/modeling/projects/$PID/exit/metrics"
  "GET /api/modeling/projects/$PID/exit/scenarios"
  "GET /api/modeling/portfolio/risk-metrics"
  "GET /api/modeling/pending-approvals"
  "GET /api/modeling-enhanced/approvals"
  "GET /api/modeling-enhanced/approvals/pending/me"

  # Leases
  "GET /api/commercial-leases/operations/leases"
  "GET /api/commercial-leases/operations/stats"
  "GET /api/tenant-leases"
  "GET /api/tenant-leases/kpis"

  # LP / Investors
  "GET /api/lp/investors"
  "GET /api/investors"

  # Marketplace / listings
  "GET /api/marketplace/sources"
  "GET /api/marketplace/status"
  "GET /api/marketplace/duplicates"

  # Analytics / reporting / accounting
  "GET /api/analytics/marina/summary"
  "GET /api/analytics/kpi-definitions"
  "GET /api/portfolio/summary"
  "GET /api/reporting/schedules"
  "GET /api/reporting/custom-reports"
  "GET /api/reporting/dashboards"
  "GET /api/gl-accounts"
  "GET /api/gl-mappings"
  "GET /api/reconciliation-records"
  "GET /api/report-packages"
  "GET /api/cohort/analysis"
  "GET /api/analysis/hub-stats"

  # Settings / org / asset classes
  "GET /api/settings/me"
  "GET /api/settings/sessions"
  "GET /api/settings/tokens"
  "GET /api/org-settings"
  "GET /api/org-settings/branding"
  "GET /api/org-settings/team"
  "GET /api/asset-classes/context"

  # VDR / misc
  "GET /api/vdr/documents"
)

printf "%-6s\t%-70s\n" "STATUS" "PATH" >> "$LOG"
for line in "${endpoints[@]}"; do
  method="${line%% *}"
  path="${line#* }"
  body=$(curl -sS -o /tmp/resp.bin -w "%{http_code}" -X "$method" "$BASE$path" --max-time 15 2>/dev/null) || body="ERR"
  printf "%-6s\t%-70s\n" "$body" "$path" >> "$LOG"
  if [[ "$body" =~ ^(4|5|ERR) ]]; then
    size=$(stat -c%s /tmp/resp.bin 2>/dev/null || echo 0)
    echo "=== $body  $method $path  (${size}B) ===" >> "$FAIL"
    head -c 600 /tmp/resp.bin >> "$FAIL"
    echo >> "$FAIL"
    echo >> "$FAIL"
  fi
done

echo "---- summary ----"
awk 'NR>1{c[substr($1,1,1)]++; total++} END{for (k in c) print k"xx: "c[k]; print "total: "total}' "$LOG"
echo "---- results ----"
cat "$LOG"

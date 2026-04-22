import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  useContractExtractionStatus,
  useExtractedDates,
  useStartContractExtraction,
  useUpdateDateStatus,
  type ContractExtractedDate,
} from '@/hooks/use-contract-parser';
import { PromoteDatesDialog } from './PromoteDatesDialog';

interface ContractReviewPanelProps {
  documentId: string;
  filename: string;
  documentClass: 'loi' | 'psa' | 'asa' | null;
}

function confidenceBadge(confidence: number) {
  if (confidence >= 0.85) {
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{(confidence * 100).toFixed(0)}%</Badge>;
  }
  if (confidence >= 0.5) {
    return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">{(confidence * 100).toFixed(0)}%</Badge>;
  }
  return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">{(confidence * 100).toFixed(0)}%</Badge>;
}

export function ContractReviewPanel({
  documentId,
  filename,
  documentClass,
}: ContractReviewPanelProps) {
  const [showPromote, setShowPromote] = useState(false);
  const [expandedSource, setExpandedSource] = useState<string | null>(null);

  const { data: status, isLoading: statusLoading } = useContractExtractionStatus(
    documentId,
  );
  const { data: dates = [], isLoading: datesLoading } = useExtractedDates(
    documentId,
    { enabled: status?.status === 'parsed' },
  );
  const startMutation = useStartContractExtraction(documentId);
  const updateStatusMutation = useUpdateDateStatus(documentId);

  const envelope = status?.extraction;
  const parties = envelope?.data?.parties ?? {};
  const money = envelope?.data?.money ?? {};
  const flags = envelope?.data?.flags ?? {};
  const confidences = envelope?.confidence_scores ?? {};

  const approvedIds = useMemo(
    () => dates.filter((d) => d.userStatus === 'approved').map((d) => d.id),
    [dates],
  );
  const pendingCount = dates.filter((d) => d.userStatus === 'pending').length;

  // Loading / idle states for the extraction job.
  const jobStatus = status?.status ?? 'pending';
  const isRunning = jobStatus === 'parsing' || jobStatus === 'pending';
  const hasRun = jobStatus === 'parsed' || jobStatus === 'failed';

  const typeLabel =
    documentClass === 'loi' ? 'Letter of Intent' :
    documentClass === 'psa' ? 'Purchase & Sale Agreement' :
    documentClass === 'asa' ? 'Asset Sale Agreement' : 'Contract';

  const assignmentFlag = flags.assignment_allowed;

  return (
    <Card className="border-blue-200 bg-blue-50/40">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{typeLabel}</CardTitle>
            <Badge variant="outline" className="bg-white">
              {filename}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {isRunning && (
              <Badge variant="outline" className="gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Parsing…
              </Badge>
            )}
            {jobStatus === 'parsed' && (
              <Badge variant="outline" className="gap-1 bg-green-50 text-green-800">
                <CheckCircle2 className="h-3 w-3" /> Parsed
              </Badge>
            )}
            {jobStatus === 'failed' && (
              <Badge variant="outline" className="gap-1 bg-red-50 text-red-800">
                <AlertTriangle className="h-3 w-3" /> Failed
              </Badge>
            )}
            {(!hasRun && !isRunning) && (
              <Button
                size="sm"
                onClick={() => startMutation.mutate({})}
                disabled={startMutation.isPending}
              >
                {startMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Extract dates'
                )}
              </Button>
            )}
            {hasRun && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => startMutation.mutate({ forceReclassify: true })}
                disabled={startMutation.isPending}
                title="Re-run extraction"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {statusLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading status…
          </div>
        )}

        {jobStatus === 'failed' && status?.error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Extraction failed</AlertTitle>
            <AlertDescription className="text-xs">{status.error}</AlertDescription>
          </Alert>
        )}

        {/* Legal-review banner for assignment-rights flag. */}
        {jobStatus === 'parsed' && (assignmentFlag === false || assignmentFlag === null) && (
          <Alert className="border-amber-300 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
            <AlertTitle className="text-amber-900">Legal review recommended</AlertTitle>
            <AlertDescription className="text-amber-900">
              {assignmentFlag === false
                ? 'This contract appears to restrict assignment. Confirm with counsel before proceeding.'
                : 'The contract is silent or ambiguous on assignment. Have counsel review before relying on assignability.'}
            </AlertDescription>
          </Alert>
        )}

        {jobStatus === 'parsed' && envelope && (
          <>
            {/* Parties */}
            <section>
              <h4 className="mb-2 text-sm font-semibold text-gray-700">Parties</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <FieldRow
                  label="Buyer"
                  value={parties.buyer}
                  confidence={confidences['parties.buyer']}
                />
                <FieldRow
                  label="Seller"
                  value={parties.seller}
                  confidence={confidences['parties.seller']}
                />
                <FieldRow
                  label="Property"
                  value={parties.property_address}
                  confidence={confidences['parties.property_address']}
                />
                <FieldRow
                  label="APN"
                  value={parties.apn}
                  confidence={confidences['parties.apn']}
                />
              </div>
            </section>

            {/* Money */}
            <section>
              <h4 className="mb-2 text-sm font-semibold text-gray-700">Money</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <FieldRow
                  label="Purchase price"
                  value={money.purchase_price != null ? `$${money.purchase_price.toLocaleString()}` : null}
                  confidence={confidences['money.purchase_price']}
                />
                <FieldRow
                  label="Earnest money"
                  value={money.earnest_money != null ? `$${money.earnest_money.toLocaleString()}` : null}
                  confidence={confidences['money.earnest_money']}
                />
              </div>
            </section>

            {/* Dates */}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-700">Dates</h4>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{pendingCount} pending</span>
                  <span>•</span>
                  <span>{approvedIds.length} approved</span>
                </div>
              </div>
              {datesLoading && <div className="text-sm text-gray-500">Loading dates…</div>}
              <div className="space-y-1">
                {dates.map((d) => (
                  <DateRow
                    key={d.id}
                    date={d}
                    expanded={expandedSource === d.id}
                    onToggle={() => setExpandedSource(expandedSource === d.id ? null : d.id)}
                    onApprove={() => updateStatusMutation.mutate({ id: d.id, user_status: 'approved' })}
                    onReject={() => updateStatusMutation.mutate({ id: d.id, user_status: 'rejected' })}
                    disabled={updateStatusMutation.isPending}
                  />
                ))}
                {dates.length === 0 && (
                  <div className="text-sm text-gray-500">No dates extracted.</div>
                )}
              </div>
            </section>

            {/* Promote button */}
            <div className="flex items-center justify-between border-t pt-3">
              <div className="text-sm text-gray-600">
                {approvedIds.length > 0
                  ? `${approvedIds.length} date${approvedIds.length === 1 ? '' : 's'} ready to promote`
                  : 'Approve dates above, then promote to the DD timeline.'}
              </div>
              <Button
                onClick={() => setShowPromote(true)}
                disabled={approvedIds.length === 0}
              >
                Promote to timeline
              </Button>
            </div>

            {envelope.extraction_notes && envelope.extraction_notes.length > 0 && (
              <Alert>
                <AlertTitle className="text-xs">Extractor notes</AlertTitle>
                <AlertDescription className="text-xs">
                  <ul className="list-disc pl-4">
                    {envelope.extraction_notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>

      {showPromote && (
        <PromoteDatesDialog
          open={showPromote}
          onOpenChange={setShowPromote}
          documentId={documentId}
          approvedDates={dates.filter((d) => d.userStatus === 'approved')}
        />
      )}
    </Card>
  );
}

function FieldRow({
  label,
  value,
  confidence,
}: {
  label: string;
  value?: string | null;
  confidence?: number;
}) {
  return (
    <div className="flex items-center justify-between rounded border bg-white px-2 py-1">
      <div>
        <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
        <div className="text-sm font-medium">{value ?? <span className="italic text-gray-400">not found</span>}</div>
      </div>
      {value != null && confidence != null && confidenceBadge(confidence)}
    </div>
  );
}

function DateRow({
  date,
  expanded,
  onToggle,
  onApprove,
  onReject,
  disabled,
}: {
  date: ContractExtractedDate;
  expanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
  disabled: boolean;
}) {
  const isApproved = date.userStatus === 'approved';
  const isRejected = date.userStatus === 'rejected';
  const isPromoted = date.userStatus === 'promoted';

  const displayValue = date.extractedDate ??
    (date.offsetDays != null
      ? `${date.offsetDays} days from ${date.anchorField ?? 'effective date'}`
      : '—');

  return (
    <Collapsible open={expanded}>
      <div className={`rounded border px-3 py-2 ${
        isApproved ? 'border-green-300 bg-green-50' :
        isRejected ? 'border-red-200 bg-red-50 opacity-70' :
        isPromoted ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'
      }`}>
        <div className="flex items-center justify-between gap-2">
          <CollapsibleTrigger asChild>
            <button
              className="flex flex-1 items-center gap-2 text-left"
              onClick={onToggle}
            >
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <span className="text-sm font-medium">{date.fieldLabel}</span>
              <span className="text-sm text-gray-600">{displayValue}</span>
            </button>
          </CollapsibleTrigger>
          <div className="flex items-center gap-1">
            {confidenceBadge(date.confidence)}
            {isPromoted ? (
              <Badge variant="outline" className="bg-blue-100 text-blue-800">Promoted</Badge>
            ) : (
              <>
                <Button
                  size="sm"
                  variant={isApproved ? 'default' : 'outline'}
                  className="h-7 w-7 p-0"
                  onClick={onApprove}
                  disabled={disabled || isApproved}
                  title="Approve"
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant={isRejected ? 'destructive' : 'outline'}
                  className="h-7 w-7 p-0"
                  onClick={onReject}
                  disabled={disabled || isRejected}
                  title="Reject"
                >
                  <X className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </div>
        <CollapsibleContent>
          {date.sourceSnippet && (
            <div className="mt-2 rounded bg-gray-50 p-2 text-xs text-gray-700">
              <div className="mb-1 flex items-center gap-1 text-gray-500">
                <Clock className="h-3 w-3" />
                Source: page {date.sourcePage ?? '—'}
              </div>
              <div className="italic">"{date.sourceSnippet}"</div>
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
